"""
AdvanceMarkets Terminal — FastAPI Entry Point
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routers import market, news, ai
from backend.config import settings

app = FastAPI(
    title="AdvanceMarkets Terminal API",
    version="3.0.0",
    description="Carbon & Sustainability Market Intelligence Terminal"
)

# CORS — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API Routes ───────────────────────────────────────────────
app.include_router(market.router, prefix="/api", tags=["Market Data"])
app.include_router(news.router, prefix="/api", tags=["News"])
app.include_router(ai.router, prefix="/api", tags=["AI Analytics"])


# ─── Health Check ─────────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "version": "3.0.0",
        "services": {
            "twelve_data": bool(settings.TWELVE_DATA_API_KEY),
            "gemini_ai": bool(settings.GEMINI_API_KEY),
        }
    }


# ─── Serve Frontend Static Files ─────────────────────────────
# This must be LAST so it doesn't override API routes
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
