"""
AdvanceMarkets Terminal — Cache utilities
"""
from cachetools import TTLCache

# Shared caches with configurable TTLs
quote_cache = TTLCache(maxsize=50, ttl=300)      # 5 min
series_cache = TTLCache(maxsize=50, ttl=600)     # 10 min
news_cache = TTLCache(maxsize=10, ttl=1800)      # 30 min
ai_summary_cache = TTLCache(maxsize=20, ttl=300) # 5 min
