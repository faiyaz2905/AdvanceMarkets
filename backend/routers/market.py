"""
AdvanceMarkets Terminal — Market Data Router
Proxies requests to Twelve Data API with caching
"""
from fastapi import APIRouter, HTTPException, Query
import httpx

from backend.config import settings
from backend.core.cache import quote_cache, series_cache

router = APIRouter()

TWELVE_DATA_BASE = "https://api.twelvedata.com"


@router.get("/quote")
async def get_quote(symbol: str = Query(..., description="Ticker symbol (e.g. KRBN)")):
    """Get real-time quote for a symbol from Twelve Data"""
    cache_key = f"quote_{symbol}"

    if cache_key in quote_cache:
        return quote_cache[cache_key]

    if not settings.TWELVE_DATA_API_KEY:
        raise HTTPException(status_code=500, detail="TWELVE_DATA_API_KEY not configured")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{TWELVE_DATA_BASE}/quote",
                params={"symbol": symbol, "apikey": settings.TWELVE_DATA_API_KEY}
            )
            data = resp.json()

        if "code" in data and data["code"] != 200:
            raise HTTPException(status_code=500, detail=data.get("message", "API Error"))

        quote_cache[cache_key] = data
        return data

    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch quote: {str(e)}")


@router.get("/time_series")
async def get_time_series(
    symbol: str = Query(..., description="Ticker symbol"),
    interval: str = Query("1day", description="Time interval (e.g. 1day, 1h, 15min)"),
    outputsize: int = Query(30, description="Number of data points")
):
    """Get historical time series data from Twelve Data"""
    cache_key = f"ts_{symbol}_{interval}_{outputsize}"

    if cache_key in series_cache:
        return series_cache[cache_key]

    if not settings.TWELVE_DATA_API_KEY:
        raise HTTPException(status_code=500, detail="TWELVE_DATA_API_KEY not configured")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{TWELVE_DATA_BASE}/time_series",
                params={
                    "symbol": symbol,
                    "interval": interval,
                    "outputsize": outputsize,
                    "apikey": settings.TWELVE_DATA_API_KEY
                }
            )
            data = resp.json()

        if "code" in data and data["code"] != 200:
            raise HTTPException(status_code=500, detail=data.get("message", "API Error"))

        series_cache[cache_key] = data
        return data

    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch time series: {str(e)}")
