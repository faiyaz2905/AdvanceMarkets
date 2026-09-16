"""
AdvanceMarkets Terminal — RSS Feed Service
Fetches news from multiple RSS feeds and filters for carbon market content.
"""
import httpx
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import re
import asyncio
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import List, Dict
from urllib.parse import urlparse

RSS_SOURCES = [
    {
        "name": "Google News Carbon",
        "url": "https://news.google.com/rss/search?q=carbon+market+OR+carbon+credits+OR+EU+ETS+OR+carbon+offset+OR+voluntary+carbon&hl=en-US&gl=US&ceid=US:en",
        "default_cat": "market"
    },
    {
        "name": "CarbonCredits.com",
        "url": "https://carboncredits.com/feed/",
        "default_cat": "market"
    },
    {
        "name": "CleanTechnica",
        "url": "https://cleantechnica.com/feed/",
        "default_cat": "science"
    },
    {
        "name": "ESG Today",
        "url": "https://www.esgtoday.com/feed/",
        "default_cat": "policy"
    }
]

CARBON_KEYWORDS = [
    "carbon", "ets", "eua", "co2", "offset", "credit", "emissions", 
    "rggi", "cca", "biochar", "cap-and-trade", "decarbonization", 
    "climate policy", "dac", "redd+", "clean energy", "net zero",
    "verra", "gold standard", "puro.earth", "article 6", "cbam"
]

def is_carbon_related(title: str, description: str = "") -> bool:
    """Filter to ensure article is related to carbon markets & sustainability"""
    text = f"{title} {description}".lower()
    return any(kw in text for kw in CARBON_KEYWORDS)

def classify_article(title: str) -> str:
    """Classify article into market, policy, science, or deals category"""
    title_lower = title.lower()
    if any(kw in title_lower for kw in ["science", "tech", "research", "breakthrough", "study", "dac", "biochar"]):
        return "science"
    if any(kw in title_lower for kw in ["policy", "regulat", "law", "government", "sec ", "cbam", "eu ets", "article 6"]):
        return "policy"
    if any(kw in title_lower for kw in ["deal", "buy", "purchase", "agreement", "fund", "invest", "million", "billion"]):
        return "deals"
    return "market"

def clean_html(text: str) -> str:
    """Strip HTML tags from RSS descriptions"""
    if not text:
        return ""
    soup = BeautifulSoup(text, "html.parser")
    clean_text = soup.get_text(strip=True)
    return re.sub(r'\s+', ' ', clean_text)

async def fetch_and_filter_rss() -> List[Dict]:
    """Fetch all RSS feeds, parse XML, filter for carbon markets, and aggregate items"""
    aggregated_news = []
    seen_titles = set()

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*"
    }

    async with httpx.AsyncClient(timeout=12.0, headers=headers, follow_redirects=True) as client:
        responses = await asyncio.gather(
            *(client.get(source["url"]) for source in RSS_SOURCES),
            return_exceptions=True,
        )

    for source, response in zip(RSS_SOURCES, responses):
        if isinstance(response, Exception) or response.status_code != 200:
            continue
        for item in parse_rss_xml(response.text, source["name"]):
            title = item.get("text", "").strip()
            url = item.get("url", "").strip()
            description = item.get("description", "")
            parsed_url = urlparse(url)
            if (
                not title
                or title.casefold() in seen_titles
                or parsed_url.scheme not in {"http", "https"}
                or not parsed_url.netloc
                or not is_carbon_related(title, description)
            ):
                continue
            seen_titles.add(title.casefold())
            item["cat"] = classify_article(title)
            item["published_at"] = normalize_date(item.pop("pubDate", ""))
            item.pop("description", None)
            aggregated_news.append(item)

    aggregated_news.sort(key=lambda item: item.get("published_at", ""), reverse=True)
    return aggregated_news[:40]


def normalize_date(value: str) -> str:
    if not value:
        return ""
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError):
        return ""

def parse_rss_xml(xml_content: str, source_name: str) -> List[Dict]:
    """Parse RSS XML content using ElementTree with BeautifulSoup fallback"""
    parsed_items = []
    
    try:
        root = ET.fromstring(xml_content)
        # Search for item tags in channel
        for item in root.findall(".//item"):
            title_el = item.find("title")
            link_el = item.find("link")
            desc_el = item.find("description")
            pub_date_el = item.find("pubDate")

            title = title_el.text if title_el is not None and title_el.text else ""
            link = link_el.text if link_el is not None and link_el.text else ""
            desc = clean_html(desc_el.text) if desc_el is not None and desc_el.text else ""
            pub_date = pub_date_el.text if pub_date_el is not None and pub_date_el.text else ""

            if title:
                parsed_items.append({
                    "cat": "market",
                    "text": title,
                    "url": link,
                    "source": source_name,
                    "description": desc,
                    "pubDate": pub_date
                })
    except Exception:
        # Fallback to BeautifulSoup XML parsing
        try:
            soup = BeautifulSoup(xml_content, "xml")
            for item in soup.find_all("item"):
                title = item.find("title").get_text(strip=True) if item.find("title") else ""
                link = item.find("link").get_text(strip=True) if item.find("link") else ""
                desc = clean_html(item.find("description").get_text(strip=True)) if item.find("description") else ""

                if title:
                    parsed_items.append({
                        "cat": "market",
                        "text": title,
                        "url": link,
                        "source": source_name,
                        "description": desc
                    })
        except Exception as bs_err:
            print(f"[RSS Service] Error parsing XML from {source_name}: {bs_err}")

    return parsed_items
