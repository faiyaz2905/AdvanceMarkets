"""
AdvanceMarkets Terminal — Cache utilities
"""
from cachetools import TTLCache

# Shared caches with configurable TTLs
quote_cache = TTLCache(maxsize=50, ttl=300)      # 5 min
series_cache = TTLCache(maxsize=50, ttl=600)     # 10 min
news_cache = TTLCache(maxsize=10, ttl=1800)      # 30 min
ai_summary_cache = TTLCache(maxsize=20, ttl=300) # 5 min

# Process-local last-known-good values. Unlike the TTL caches, these entries do
# not expire and can be returned with an explicit stale flag during a temporary
# upstream outage. The browser also keeps its own last-known-good copy because
# serverless instances may be recycled at any time.
last_quote_cache = {}
