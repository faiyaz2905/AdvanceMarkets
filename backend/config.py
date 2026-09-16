"""
AdvanceMarkets Terminal — Configuration
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    PORT: int = int(os.getenv("PORT", "8000"))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # API Keys
    TWELVE_DATA_API_KEY: str = os.getenv("TWELVE_DATA_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    ALLOWED_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "https://advance-markets.vercel.app,http://localhost:8000,http://127.0.0.1:8000"
        ).split(",")
        if origin.strip()
    ]

    # Conservative public-site limits. These are process-local safeguards; a
    # distributed rate-limit store can be added if traffic outgrows one region.
    AI_DAILY_LIMIT: int = int(os.getenv("AI_DAILY_LIMIT", "20"))
    AI_MINUTE_LIMIT: int = int(os.getenv("AI_MINUTE_LIMIT", "4"))

    # Cache TTLs (seconds)
    CACHE_QUOTE_TTL: int = int(os.getenv("CACHE_QUOTE_TTL", "300"))       # 5 min
    CACHE_SERIES_TTL: int = int(os.getenv("CACHE_SERIES_TTL", "600"))     # 10 min
    CACHE_NEWS_TTL: int = int(os.getenv("CACHE_NEWS_TTL", "1800"))        # 30 min


settings = Settings()
