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

    # Cache TTLs (seconds)
    CACHE_QUOTE_TTL: int = int(os.getenv("CACHE_QUOTE_TTL", "300"))       # 5 min
    CACHE_SERIES_TTL: int = int(os.getenv("CACHE_SERIES_TTL", "600"))     # 10 min
    CACHE_NEWS_TTL: int = int(os.getenv("CACHE_NEWS_TTL", "1800"))        # 30 min


settings = Settings()
