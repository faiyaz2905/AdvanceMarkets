# Lovable prompt — AdvanceMarkets terminal frontend

Copy the prompt below into Lovable. Attach screenshots of the current production site if the tool supports references.

---

Build a production-quality responsive frontend for **AdvanceMarkets**, a public carbon allowance market intelligence terminal. The product should feel like a modern Bloomberg terminal: dense, fast, analytical, dark, and credible—but substantially easier to read than a traditional trading terminal.

## Product objective

Help researchers, sustainability teams, and market observers monitor exchange-traded securities linked to compliance carbon markets, read verified carbon-market news, inspect real historical performance, and ask an AI research assistant focused questions.

This is a research product, not a brokerage or trading interface. Never imply that an ETF or ETN price is a direct carbon allowance spot price or a price per tonne.

## Technology and integration constraints

- Build the frontend only. It must consume the existing same-origin FastAPI endpoints under `/api`.
- Use React, TypeScript, Tailwind CSS, and accessible reusable components.
- Use a lightweight chart library suitable for financial time series.
- Do not add a database, authentication, Supabase, mock API, or replacement backend.
- Do not expose or request API keys in the browser.
- Do not generate fake prices, fake history, fake news, fake timestamps, or fake buyer data.
- Treat every API response as potentially partial or unavailable.
- Use plain text rendering for AI and RSS content. Do not insert unsanitized HTML.

## Visual direction

- Dark professional terminal interface, not a generic SaaS dashboard.
- Background: near-black charcoal (`#07090B`).
- Panels: layered charcoal (`#0C1013`, `#11171B`).
- Dividers: cool gray (`#26323A`).
- Primary positive/accent: restrained market green (`#35D98B`).
- Negative: accessible coral red (`#FF6B6B`).
- Warning/stale: amber (`#F3BB55`).
- Informational/source links: cyan (`#57C7DC`).
- Primary text: near-white (`#EEF3F5`); secondary text must remain WCAG-readable.
- Typography: IBM Plex Sans for navigation, headings, explanations, and long text. IBM Plex Mono only for prices, percentages, symbols, timestamps, and compact labels.
- Minimum meaningful text size: 12px. Body copy should usually be 14–16px.
- Corners should be subtle, around 2–4px. Avoid oversized rounded cards, glassmorphism, gradients used as decoration, large shadows, and excessive empty space.
- Use thin rules, precise alignment, compact spacing, and strong hierarchy.
- No emoji anywhere. Use text labels and restrained line icons only when an icon adds meaning.
- No decorative hero section, marketing illustration, stock photography, or animated background.
- Respect `prefers-reduced-motion`.

## Global layout

1. Sticky top bar:
   - AdvanceMarkets wordmark built from text and a simple geometric line mark.
   - Product label `TERMINAL`.
   - Connection state: `CONNECTED`, `PARTIAL / STALE`, or `UNAVAILABLE`.
   - Last refresh time.
   - Coverage count such as `3 / 4`.

2. Horizontal market ribbon:
   - One keyboard-accessible button per instrument.
   - Symbol, current or last-known price, daily percent change, and market name.
   - Active instrument has a thin green underline.
   - Stale values use amber and never look live.
   - Ribbon scrolls horizontally on smaller screens.

3. Tab navigation:
   - `MARKETS`, `NEWS`, `ANALYTICS`, `RESEARCH AI`.
   - Implement proper `tablist`, `tab`, `tabpanel`, `aria-selected`, keyboard arrow navigation, and visible focus states.
   - Tabs must remain text-labeled on mobile; do not replace labels with ambiguous icons.

4. Fixed compact latest-news bar at the bottom with one verified headline. It must not auto-scroll horizontally. Rotate headlines no faster than every seven seconds and stop animation when reduced motion is requested.

## Markets tab

Place a visible disclosure above the data panels:

`MARKET PROXY DATA — Displayed prices are USD exchange-traded securities linked to compliance carbon markets, not direct spot prices per tonne.`

Desktop layout:

- Main historical chart panel occupying roughly two-thirds of the width.
- Market brief panel occupying roughly one-third.
- Full-width market overview below.

Chart panel requirements:

- Show selected symbol, full name, market exposure, and instrument type.
- Timeframes: `1D`, `1W`, `1M`, `3M`, `1Y`.
- Show last price, selected-period return, exact price update timestamp, and a freshness badge.
- Freshness values: `LIVE`, `LAST KNOWN`, or `UNAVAILABLE`.
- Show real open, high, low, average, and computed interval volatility for the loaded series.
- Include a direct source link opening safely in a new tab.
- Loading state: `Loading verified history...`
- Error state: `Verified historical data is temporarily unavailable. No simulated series is shown.`
- Never draw a random or interpolated chart when data is missing.

Market brief requirements:

- Four concise lines based on computed historical metrics.
- Label as `AI ASSISTED`.
- If the AI endpoint fails, show deterministic locally calculated statements based only on period return, range, and volatility.
- Always show `Research only. Not investment advice.`

Market overview requirements:

- Desktop table columns: symbol, instrument, market, price, change, volume, status, updated.
- Each row must label whether it is an ETF proxy, ETN proxy, or physical trust through the instrument description or detail view.
- On screens below 600px, transform each row into a readable key/value card. Do not force a wide table into the viewport.

Use these instruments and descriptions:

- `KRBN` — Global Carbon Strategy ETF — Global compliance — ETF proxy. Tracks a basket of major compliance allowance futures.
- `KCCA` — California Carbon Allowance Strategy ETF — California / Quebec — ETF proxy. Futures-based exposure to the linked cap-and-trade market.
- `CTWO` — Physical European Carbon Allowance Trust — EU ETS — Physical trust. Holds EU allowances and seeks to reflect EUA performance less expenses.
- `GRN` — iPath Series B Carbon ETN — Global compliance — ETN proxy. Index-linked note with issuer credit risk.

Do not add clean-energy equity funds or voluntary-credit estimates to the same price comparison. The list should remain configurable for future verified instruments.

## News tab

- Filters: all, market, policy, science, deals.
- Each card shows category, headline, publisher/source, and publication timestamp.
- External links must use `noopener noreferrer`.
- Headlines and URLs come only from the API.
- Empty/error state: `Verified news is temporarily unavailable. No placeholder headlines are being shown.`
- Never invent fallback headlines.

## Analytics tab

- Top movers based on available session percentage changes.
- Market breadth represented descriptively as `X UP / Y DOWN`.
- Explicit text: `This is descriptive, not a sentiment forecast.`
- Instrument guide explaining what KRBN, KCCA, CTWO, and GRN represent and their structural differences.
- Do not include a carbon buyer leaderboard; keep that feature completely hidden.
- Do not calculate a bullish/bearish score from a tiny watchlist.

## Research AI tab

- A restrained research-chat interface, not a consumer chatbot aesthetic.
- Intro copy explains that responses should distinguish securities, compliance allowances, and voluntary credits.
- Suggested prompts:
  - `Explain how KRBN differs from a direct carbon allowance price.`
  - `Compare the EU ETS and California cap-and-trade markets.`
  - `What risks should I consider when using carbon ETFs as market proxies?`
- Show `PUBLIC BETA / RATE LIMITED` and `20 REQUESTS / DAY`.
- Maximum input length 1,500 characters.
- Disable the send button while a request is active.
- Render responses as plain text with preserved line breaks. Do not render raw model HTML.
- Present rate-limit and service errors clearly without revealing backend exception details.

## API contract

Use these endpoints:

### `GET /api/quotes`

Response shape:

```json
{
  "quotes": {
    "KRBN": {
      "symbol": "KRBN",
      "name": "Global Carbon Strategy ETF",
      "market": "Global compliance",
      "instrument_type": "ETF proxy",
      "currency": "USD",
      "close": "35.10",
      "change": "0.20",
      "percent_change": "0.57",
      "volume": "100000",
      "fetched_at": "ISO-8601 timestamp",
      "source": "Twelve Data",
      "status": "live"
    }
  },
  "available": 4,
  "total": 4,
  "status": "ok | partial | unavailable",
  "requested_at": "ISO-8601 timestamp"
}
```

Persist only successful live quotes in local storage. When a later request fails or returns a null instrument, display the stored quote with `status: stale`, the original `fetched_at` timestamp, and the label `LAST KNOWN`. Never change the original timestamp when marking a price stale.

### `GET /api/time_series?symbol=KRBN&interval=1day&outputsize=30`

Response contains `values` with `datetime`, `open`, `high`, `low`, `close`, and `volume`. If the endpoint fails, show the explicit unavailable state and no chart.

Timeframe mapping:

- 1D: `15min`, 32
- 1W: `1h`, 40
- 1M: `1day`, 30
- 3M: `1day`, 90
- 1Y: `1week`, 52

Sort history ascending before charting. Compute period return and volatility in deterministic code.

### `POST /api/ai-summary`

Send:

```json
{
  "symbol": "KRBN",
  "timeframe": "1month",
  "metrics": {
    "start": 30,
    "end": 31,
    "return_pct": 3.33,
    "high": 32,
    "low": 29,
    "average": 30.5,
    "volatility_pct": 1.2,
    "volume": 1200000
  }
}
```

### `GET /api/news`

Response: `{ "items": [...], "status": "live | unavailable", "fetched_at": "..." }`.

### `POST /api/ai-chat`

Send `{ "message": "...", "history": [{ "role": "user | model", "parts": "..." }] }`. Keep no more than the last 12 history messages.

## Accessibility and responsive acceptance criteria

- Meet WCAG AA contrast for primary and secondary information.
- Every interactive control works by keyboard and has a visible focus state.
- Announce connection, loading, and error changes with appropriate live regions without excessive chatter.
- Icon-only controls require accessible names; preferably use visible text.
- Tables include captions and scoped column headers.
- No essential text smaller than 12px.
- At 320px width, no page-level horizontal overflow.
- At 768px and below, panels stack in a logical reading order.
- At 600px and below, market table rows become cards.
- Do not hide critical labels on mobile.
- Test loading, complete, partial, stale, empty, rate-limited, and unavailable states.

## Final output

Produce a polished, complete frontend with reusable typed components, a centralized design-token file, an API client with timeout and response validation, last-known-price persistence, deterministic metric calculations, safe external links, accessible state messaging, and no placeholder data. Preserve the dense terminal feel while making it calm, legible, and trustworthy.

---
