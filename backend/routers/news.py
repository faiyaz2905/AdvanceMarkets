"""
AdvanceMarkets Terminal — News Router
Scrapes carbon market news from multiple sources
"""
from fastapi import APIRouter
import httpx
from bs4 import BeautifulSoup

from backend.core.cache import news_cache

router = APIRouter()

# Fallback headlines if scraping fails
FALLBACK_NEWS = [
    {"cat": "market", "text": "EU ETS carbon allowance prices fall 2.3% as power sector emissions decline across Western Europe", "url": "https://carbon-pulse.com"},
    {"cat": "science", "text": "Stanford researchers develop biochar process that captures 40% more CO₂ per ton — published in Nature Energy", "url": "https://www.nature.com/nenergy/"},
    {"cat": "deals", "text": "Microsoft purchases 500K high-quality biochar removal credits from Charm Industrial at $155/mt", "url": "https://www.cdr.fyi"},
    {"cat": "policy", "text": "EU CBAM Phase 2 regulations finalized — expanded coverage for aluminum and chemicals from Jan 2027", "url": "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en"},
    {"cat": "market", "text": "California carbon allowance auction clears at $38.52/mt — highest since Q3 2024", "url": "https://ww2.arb.ca.gov/our-work/programs/cap-and-trade-program"},
    {"cat": "science", "text": "ETH Zurich team achieves breakthrough in direct air capture efficiency — cost down to $250/ton", "url": "https://ethz.ch/en/research.html"},
    {"cat": "deals", "text": "Google signs 10-year carbon removal agreement with Climeworks worth estimated $180M", "url": "https://climeworks.com"},
    {"cat": "policy", "text": "US SEC finalizes climate disclosure rules requiring Scope 1 & 2 emissions reporting for large filers", "url": "https://www.sec.gov/climate-disclosures"},
    {"cat": "market", "text": "RGGI carbon permit prices steady at $14.80 amid increased auction participation from utilities", "url": "https://www.rggi.org"},
    {"cat": "science", "text": "Ocean-based carbon removal startup Running Tide completes 10,000 ton verification milestone", "url": "https://www.runningtide.com"},
    {"cat": "deals", "text": "Stripe Climate funds $8M in new biochar projects across Southeast Asia through Frontier portfolio", "url": "https://frontierclimate.com"},
    {"cat": "policy", "text": "Article 6 carbon credit framework sees first cross-border transaction — Switzerland and Thailand", "url": "https://unfccc.int/process-and-meetings/the-paris-agreement/article-64-mechanism"},
]


def classify_news(title: str) -> str:
    """Classify a news title into a category"""
    title_lower = title.lower()
    if any(kw in title_lower for kw in ["science", "tech", "research", "breakthrough", "study"]):
        return "science"
    if any(kw in title_lower for kw in ["policy", "regulat", "law", "government", "sec ", "cbam"]):
        return "policy"
    if any(kw in title_lower for kw in ["deal", "buy", "purchase", "agreement", "fund"]):
        return "deals"
    return "market"


async def scrape_carboncredits() -> list:
    """Scrape news from carboncredits.com"""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://carboncredits.com/news/",
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )

        soup = BeautifulSoup(resp.text, "lxml")
        news = []

        for article in soup.select(".elementor-post")[:12]:
            title_el = article.select_one(".elementor-post__title a")
            if title_el:
                title = title_el.get_text(strip=True)
                url = title_el.get("href", "")
                if title and url:
                    news.append({
                        "cat": classify_news(title),
                        "text": title,
                        "url": url,
                        "source": "carboncredits.com"
                    })

        return news
    except Exception as e:
        print(f"[ERROR] Scraper error (carboncredits): {e}")
        return []


@router.get("/news")
async def get_news():
    """Get aggregated carbon market news"""
    cache_key = "market_news"

    if cache_key in news_cache:
        return news_cache[cache_key]

    # Scrape from sources
    news = await scrape_carboncredits()

    # Use fallback if scraping returned nothing
    if not news:
        news = FALLBACK_NEWS

    news_cache[cache_key] = news
    return news
