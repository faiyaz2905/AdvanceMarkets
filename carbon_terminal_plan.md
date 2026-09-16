# 🖥️ CarbonPulse Terminal — Implementation Plan

> A Bloomberg-style terminal dedicated to the carbon credit market.

## Vision

A dark, data-dense, terminal-style dashboard that feels like a professional trading floor tool — live prices, AI market summaries, breaking news, scientific breakthroughs, and a buyer leaderboard, all in one place.

---

## Feature Breakdown

### 1. 📊 Market Trend Summaries by Time Band

**What**: AI-generated text summaries analyzing price momentum across different timeframes.

| Time Band | Analysis |
|-----------|----------|
| **1 Day** | "KRBN dropped 1.1% on light volume. EU ETS selling pressure..." |
| **1 Week** | "Carbon prices consolidating near $30 support level..." |
| **1 Month** | "Bearish trend — KRBN down 8.2% from monthly open..." |
| **3 Month** | "EU carbon allowances weakening amid policy uncertainty..." |
| **1 Year** | "Global carbon markets down 22% YoY — regulatory headwinds..." |

**How it works**:
- Fetch price data for each timeframe (already have this from Twelve Data)
- Calculate key technical metrics: momentum, trend direction, volatility, support/resistance
- Feed data into Gemini API with a carbon market analyst prompt
- Display summaries in a tabbed panel

**Requires**: Gemini API (free tier)

---

### 2. 📰 News Feed + Scientific Breakthroughs

**What**: A live news ticker that scrapes and categorizes carbon market news.

| Category | Sources | Example Headlines |
|----------|---------|-------------------|
| **Market News** | CarbonCredits.com, Carbon Pulse, Reuters | "EU ETS prices drop as power sector emissions fall" |
| **Policy & Regulation** | EU Commission, EPA, UNFCCC | "EU CBAM phase 2 rules finalized for 2026" |
| **Science & Tech** | Nature, Science, arXiv | "New biochar process captures 40% more CO₂" |
| **Deals & Transactions** | Bloomberg, S&P Global | "Microsoft purchases 2M biochar credits from Charm" |

**How it works**:
- Backend scrapes/fetches from RSS feeds and news APIs
- LLM categorizes and summarizes each article
- Frontend displays in a scrolling terminal-style news ticker
- Color-coded by category (🟢 Market, 🔵 Policy, 🟣 Science, 🟡 Deals)

**Requires**: Backend (Node.js) + Gemini API + News API or RSS scraping

---

### 3. 🏢 Top Carbon Credit Buyers Leaderboard

**What**: A ranked bar chart / table showing the biggest corporate carbon credit buyers.

| Rank | Company | Credits Purchased | Spend (Est.) | Type |
|------|---------|-------------------|--------------|------|
| 1 | Microsoft | 3.5M mtCO₂e | $525M | Removal (biochar, DAC) |
| 2 | Google/Alphabet | 1.2M mtCO₂e | $180M | Removal + Avoidance |
| 3 | Stripe | 500K mtCO₂e | $75M | Removal only |
| 4 | Meta | 400K mtCO₂e | $60M | Mixed |
| 5 | Shopify | 350K mtCO₂e | $52M | Removal (Frontier) |

**Data Sources**:
- [CDR.fyi](https://www.cdr.fyi) — tracks carbon removal purchases (public data)
- Corporate sustainability reports (annual)
- Voluntary registry data (Verra, Gold Standard)

**How it works**:
- Scrape/fetch from CDR.fyi and public data sources
- Display as an animated horizontal bar chart
- Update weekly (buyer data doesn't change in real-time)

**Requires**: Backend scraping + static data fallback

---

### 4. 🖥️ Terminal Aesthetic

The overall UI should feel like a **professional trading terminal**:

- **Dense data layout** — multiple panels visible at once
- **Monospace fonts** for all data (JetBrains Mono — already using this)
- **Blinking cursors** and terminal-style animations
- **Scrolling news ticker** at the bottom
- **Grid-based layout** — 2×2 or 3-column panels
- **Keyboard shortcuts** for navigation
- **Color scheme**: Deep dark backgrounds, green/cyan accents, red for negatives

---

## Architecture Decision

### Current: Static HTML (no backend)
```
Browser → Twelve Data API → Dashboard
```

### Required: Full-Stack App
```
Browser → Node.js Backend → Twelve Data API (prices)
                           → Gemini API (AI summaries)  
                           → RSS/Web Scraping (news)
                           → CDR.fyi Scraping (buyers)
```

> [!IMPORTANT]
> We need a backend because:
> 1. LLM API keys can't be safely exposed in frontend JS
> 2. Web scraping requires server-side execution (CORS blocks it)
> 3. We need to cache and rate-limit API calls
> 4. News aggregation needs a scheduled job

---

## Implementation Phases

### Phase 1: Terminal UI Redesign ⏱️ ~2 hours
*Can do NOW — no backend needed*

- Redesign layout to 3-column terminal grid
- Add panel components: Market Summary, News Feed, Buyer Board
- Terminal-style scrolling animations and monospace typography
- Placeholder data in all panels until backend is ready

### Phase 2: Backend Setup ⏱️ ~1 hour
*Requires Node.js*

- Initialize Express.js server
- Set up API proxy for Twelve Data (hide API key)
- Add Gemini API integration
- Basic RSS feed fetching

### Phase 3: AI Market Summaries ⏱️ ~1–2 hours

- Calculate technical indicators from Twelve Data price series
- Build Gemini prompt for carbon market analysis
- Generate summaries for each time band
- Cache summaries (refresh every 15 min)

### Phase 4: News Scraping & Categorization ⏱️ ~2 hours

- Set up RSS feed parsing for carbon news
- Gemini categorization (Market/Policy/Science/Deals)
- Headline summarization
- Scrolling terminal-style news ticker

### Phase 5: Buyer Leaderboard ⏱️ ~1–2 hours

- Scrape CDR.fyi for carbon removal purchases
- Build animated horizontal bar chart
- Corporate buyer profiles with purchase history
- Weekly auto-refresh

---

## Prerequisites Checklist

- [ ] **Node.js installed** on your machine
- [ ] **Gemini API key** (free from [aistudio.google.com](https://aistudio.google.com))
- [ ] Decide: Run locally or deploy somewhere?

---

## Total Estimated Time

| Phase | Time | Dependencies |
|-------|------|-------------|
| Phase 1: Terminal UI | ~2 hours | None (can start now!) |
| Phase 2: Backend | ~1 hour | Node.js |
| Phase 3: AI Summaries | ~1–2 hours | Gemini API key |
| Phase 4: News Feed | ~2 hours | Backend running |
| Phase 5: Buyer Board | ~1–2 hours | Backend running |
| **Total** | **~7–9 hours** | |
