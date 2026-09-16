"""Carbon-market news endpoint. No fabricated headline fallback."""

from datetime import datetime, timezone

from fastapi import APIRouter

from backend.core.cache import news_cache
from backend.services.rss_service import fetch_and_filter_rss

router = APIRouter()


@router.get("/news")
async def get_news():
    cache_key = "market_news_rss_v2"
    if cache_key in news_cache:
        return news_cache[cache_key]

    news = await fetch_and_filter_rss()
    payload = {
        "items": news[:40],
        "status": "live" if news else "unavailable",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    if news:
        news_cache[cache_key] = payload
    return payload
