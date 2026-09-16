# AdvanceMarkets Terminal

Public carbon allowance market research terminal deployed at https://advance-markets.vercel.app/.

## Canonical application

- `frontend/` is the only production frontend.
- `backend/` is the FastAPI backend.
- `api/index.py` exposes the FastAPI application to Vercel.
- `vercel.json` owns production routing and security headers.

The root-level HTML, CSS, JavaScript, and Express server are retained only as historical prototypes and are not part of the Vercel deployment. New work must target `frontend/` and `backend/`.

## Data behavior

- Prices are exchange-traded carbon-market proxies, not direct spot allowance prices.
- Live quotes carry a server-generated `fetched_at` timestamp.
- If a refresh fails, the browser shows its last successfully fetched quote with a `LAST KNOWN` label and original timestamp.
- Historical charts never use generated or simulated values.
- The news API returns an unavailable state rather than fabricated fallback headlines.

## Environment

Required deployment variables:

- `TWELVE_DATA_API_KEY`
- `GEMINI_API_KEY`

Optional:

- `ALLOWED_ORIGINS` (comma-separated; defaults include the production domain and local development)
- `AI_DAILY_LIMIT` (default `20` chat requests per visitor per UTC day)
- `AI_MINUTE_LIMIT` (default `4` AI requests per visitor per minute)
- `GEMINI_MODEL` (default `gemini-3.8-flash`)

Run locally with `uvicorn backend.main:app --reload`.
