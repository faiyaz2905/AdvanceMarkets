"""Trusted market-data proxy with explicit freshness metadata."""

import asyncio
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

from backend.config import settings
from backend.core.cache import last_quote_cache, quote_cache, series_cache

router = APIRouter()
TWELVE_DATA_BASE = "https://api.twelvedata.com"

# Only instruments with a direct and current carbon-market relationship are
# exposed. Prices are exchange-traded security prices, not $/tCO2e spot prices.
INSTRUMENTS = {
    "KRBN": {"name": "Global Carbon Strategy ETF", "market": "Global compliance", "kind": "ETF proxy"},
    "KCCA": {"name": "California Carbon Allowance Strategy ETF", "market": "California/Quebec", "kind": "ETF proxy"},
    "CTWO": {"name": "Physical European Carbon Allowance Trust", "market": "EU ETS", "kind": "Physical trust"},
    "GRN": {"name": "iPath Series B Carbon ETN", "market": "Global compliance", "kind": "ETN proxy"},
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_symbol(symbol: str) -> str:
    normalized = symbol.upper().strip()
    if normalized not in INSTRUMENTS:
        raise HTTPException(status_code=400, detail="Unsupported market symbol")
    return normalized


def normalize_quote(symbol: str, data: dict[str, Any], *, stale: bool = False) -> dict[str, Any]:
    instrument = INSTRUMENTS[symbol]
    return {
        "symbol": symbol,
        "name": instrument["name"],
        "market": instrument["market"],
        "instrument_type": instrument["kind"],
        "currency": data.get("currency", "USD"),
        "close": data.get("close"),
        "change": data.get("change"),
        "percent_change": data.get("percent_change"),
        "volume": data.get("volume"),
        "fifty_two_week": data.get("fifty_two_week"),
        "exchange": data.get("exchange"),
        "datetime": data.get("datetime"),
        "fetched_at": data.get("fetched_at") or utc_now(),
        "source": data.get("source", "Twelve Data"),
        "status": "stale" if stale else "live",
    }


async def fetch_live_quote(symbol: str) -> dict[str, Any]:
    if not settings.TWELVE_DATA_API_KEY:
        raise RuntimeError("Market data provider is not configured")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{TWELVE_DATA_BASE}/quote",
            params={"symbol": symbol, "apikey": settings.TWELVE_DATA_API_KEY},
        )
        response.raise_for_status()
        data = response.json()

    if data.get("code") and data.get("code") != 200:
        raise RuntimeError("Market data provider rejected the request")
    if data.get("close") in (None, ""):
        raise RuntimeError("Market data provider returned no price")

    data["fetched_at"] = utc_now()
    data["source"] = "Twelve Data"
    return normalize_quote(symbol, data)


async def quote_for_symbol(symbol: str) -> dict[str, Any]:
    cache_key = f"quote_{symbol}"
    if cache_key in quote_cache:
        return quote_cache[cache_key]

    try:
        quote = await fetch_live_quote(symbol)
        quote_cache[cache_key] = quote
        last_quote_cache[symbol] = quote
        return quote
    except Exception:
        previous = last_quote_cache.get(symbol)
        if previous:
            return {**previous, "status": "stale"}
        raise


@router.get("/instruments")
async def get_instruments():
    return {"instruments": [{"symbol": symbol, **meta} for symbol, meta in INSTRUMENTS.items()]}


@router.get("/quotes")
async def get_quotes():
    results = await asyncio.gather(
        *(quote_for_symbol(symbol) for symbol in INSTRUMENTS),
        return_exceptions=True,
    )
    quotes = {}
    for symbol, result in zip(INSTRUMENTS, results):
        quotes[symbol] = None if isinstance(result, Exception) else result
    available = sum(value is not None for value in quotes.values())
    return {
        "quotes": quotes,
        "available": available,
        "total": len(INSTRUMENTS),
        "status": "ok" if available == len(INSTRUMENTS) else "partial" if available else "unavailable",
        "requested_at": utc_now(),
    }


@router.get("/quote")
async def get_quote(symbol: str = Query(..., description="Supported market symbol")):
    normalized = validate_symbol(symbol)
    try:
        return await quote_for_symbol(normalized)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Market price is temporarily unavailable") from exc


@router.get("/time_series")
async def get_time_series(
    symbol: str = Query(...),
    interval: str = Query("1day", pattern="^(15min|1h|1day|1week)$"),
    outputsize: int = Query(30, ge=2, le=366),
):
    normalized = validate_symbol(symbol)
    cache_key = f"ts_{normalized}_{interval}_{outputsize}"
    if cache_key in series_cache:
        return series_cache[cache_key]
    if not settings.TWELVE_DATA_API_KEY:
        raise HTTPException(status_code=503, detail="Historical market data is temporarily unavailable")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{TWELVE_DATA_BASE}/time_series",
                params={
                    "symbol": normalized,
                    "interval": interval,
                    "outputsize": outputsize,
                    "apikey": settings.TWELVE_DATA_API_KEY,
                    "order": "ASC",
                },
            )
            response.raise_for_status()
            data = response.json()
        if data.get("code") and data.get("code") != 200:
            raise RuntimeError("Historical data request failed")
        if not data.get("values"):
            raise RuntimeError("No historical values returned")
        payload = {
            "symbol": normalized,
            "interval": interval,
            "values": data["values"],
            "status": "live",
            "source": "Twelve Data",
            "fetched_at": utc_now(),
        }
        series_cache[cache_key] = payload
        return payload
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Historical market data is temporarily unavailable") from exc
