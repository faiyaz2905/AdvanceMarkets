"""AdvanceMarkets FastAPI application."""

import os
import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.routers import ai, market, news

app = FastAPI(
    title="AdvanceMarkets Terminal API",
    version="4.0.0",
    description="Carbon allowance market intelligence",
    docs_url=None if settings.ENVIRONMENT == "production" else "/api/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

minute_requests: dict[tuple[str, str], deque] = defaultdict(deque)
daily_ai_requests: dict[tuple[str, str], int] = defaultdict(int)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def security_and_rate_limits(request: Request, call_next):
    now = time.time()
    ip = client_ip(request)
    is_ai = request.url.path in {"/api/ai-chat", "/api/ai-summary"}
    is_chat = request.url.path == "/api/ai-chat"
    bucket = "ai" if is_ai else "general"
    window = minute_requests[(ip, bucket)]
    while window and now - window[0] > 60:
        window.popleft()

    minute_limit = settings.AI_MINUTE_LIMIT if is_ai else 120
    if len(window) >= minute_limit:
        return JSONResponse({"detail": "Rate limit exceeded. Please try again shortly."}, status_code=429)

    if is_chat:
        day = time.strftime("%Y-%m-%d", time.gmtime(now))
        daily_key = (ip, day)
        if daily_ai_requests[daily_key] >= settings.AI_DAILY_LIMIT:
            return JSONResponse({"detail": "Daily AI limit reached. Please try again tomorrow."}, status_code=429)
        daily_ai_requests[daily_key] += 1

    window.append(now)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
        "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"
    )
    return response


app.include_router(market.router, prefix="/api", tags=["Market Data"])
app.include_router(news.router, prefix="/api", tags=["News"])
app.include_router(ai.router, prefix="/api", tags=["AI Analytics"])


@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "version": "4.0.0",
        "services": {
            "market_data": bool(settings.TWELVE_DATA_API_KEY),
            "ai": bool(settings.GEMINI_API_KEY),
        },
    }


frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
