/* ============================================
   AdvanceMarkets Terminal — App Logic v2
   Bloomberg-style Carbon Credit Terminal
   ============================================ */

// ─── Config ──────────────────────────────────────────────────
const CONFIG = {
    BASE_URL: '/api',
    REFRESH_INTERVAL: 300000,
    TICKERS: [
        { symbol: 'KRBN', name: 'KraneShares Global Carbon Strategy ETF', short: 'Global Carbon', badge: 'CARBON', badgeClass: '', isApi: true, color: '#00e676', colorDim: 'rgba(0,230,118,0.12)', source: 'https://twelvedata.com/symbol/KRBN' },
        { symbol: 'GRN', name: 'iPath Series B Carbon ETN', short: 'Carbon ETN', badge: 'CARBON', badgeClass: '', isApi: true, color: '#00e5ff', colorDim: 'rgba(0,229,255,0.12)', source: 'https://twelvedata.com/symbol/GRN' },
        { symbol: 'KCCA', name: 'KraneShares California Carbon Allowance ETF', short: 'California CCA', badge: 'CCA', badgeClass: 'cca', isApi: true, color: '#ffab40', colorDim: 'rgba(255,171,64,0.12)', source: 'https://twelvedata.com/symbol/KCCA' },
        { symbol: 'CTWO', name: 'COtwo Physical EU Carbon Allowance Trust', short: 'EU Carbon (EUA)', badge: 'EUA', badgeClass: 'eua', isApi: true, color: '#ff4081', colorDim: 'rgba(255,64,129,0.12)', source: 'https://twelvedata.com/symbol/CTWO' },
        { symbol: 'ICLN', name: 'iShares Global Clean Energy ETF', short: 'Clean Energy', badge: 'ENERGY', badgeClass: 'energy', isApi: true, color: '#448aff', colorDim: 'rgba(68,138,255,0.12)', source: 'https://twelvedata.com/symbol/ICLN' },
        { symbol: 'BIOCHAR', name: 'Biochar Carbon Credits (Voluntary)', short: 'Biochar', badge: 'VOLUNTARY', badgeClass: 'voluntary', isApi: false, refPrice: 150.00, refUnit: '/mtCO₂e', color: '#b388ff', colorDim: 'rgba(179,136,255,0.12)', source: 'https://puro.earth' },
    ],
};

const TIMEFRAME_MAP = {
    '1day': { interval: '15min', outputsize: 30, label: '1 Day' },
    '1week': { interval: '1h', outputsize: 40, label: '1 Week' },
    '1month': { interval: '1day', outputsize: 30, label: '1 Month' },
    '3months': { interval: '1day', outputsize: 90, label: '3 Months' },
    '1year': { interval: '1week', outputsize: 52, label: '1 Year' },
};

// Top carbon credit buyers (public data from CDR.fyi, sustainability reports)
const TOP_BUYERS = [
    { name: 'Microsoft', amount: 3500000, spend: 525, type: 'removal', label: '3.5M mtCO₂e', source: 'https://www.microsoft.com/en-us/corporate-responsibility/sustainability' },
    { name: 'Google/Alphabet', amount: 1200000, spend: 180, type: 'mixed', label: '1.2M mtCO₂e', source: 'https://sustainability.google' },
    { name: 'JPMorgan Chase', amount: 800000, spend: 120, type: 'mixed', label: '800K mtCO₂e', source: 'https://www.jpmorganchase.com/impact/sustainability' },
    { name: 'Stripe', amount: 500000, spend: 75, type: 'removal', label: '500K mtCO₂e', source: 'https://stripe.com/climate' },
    { name: 'Meta Platforms', amount: 400000, spend: 60, type: 'mixed', label: '400K mtCO₂e', source: 'https://sustainability.fb.com' },
    { name: 'Shopify', amount: 350000, spend: 52, type: 'removal', label: '350K mtCO₂e', source: 'https://www.shopify.com/climate' },
    { name: 'Swiss Re', amount: 280000, spend: 42, type: 'removal', label: '280K mtCO₂e', source: 'https://www.swissre.com/sustainability.html' },
    { name: 'Salesforce', amount: 250000, spend: 38, type: 'avoidance', label: '250K mtCO₂e', source: 'https://www.salesforce.com/company/sustainability/' },
];

// Placeholder news — will be replaced by backend scraper
const NEWS_ITEMS = [
    { cat: 'market', text: 'EU ETS carbon allowance prices fall 2.3% as power sector emissions decline across Western Europe', url: 'https://carbon-pulse.com' },
    { cat: 'science', text: 'Stanford researchers develop biochar process that captures 40% more CO₂ per ton — published in Nature Energy', url: 'https://www.nature.com/nenergy/' },
    { cat: 'deals', text: 'Microsoft purchases 500K high-quality biochar removal credits from Charm Industrial at $155/mt', url: 'https://www.cdr.fyi' },
    { cat: 'policy', text: 'EU CBAM Phase 2 regulations finalized — expanded coverage for aluminum and chemicals from Jan 2027', url: 'https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en' },
    { cat: 'market', text: 'California carbon allowance auction clears at $38.52/mt — highest since Q3 2024', url: 'https://ww2.arb.ca.gov/our-work/programs/cap-and-trade-program' },
    { cat: 'science', text: 'ETH Zurich team achieves breakthrough in direct air capture efficiency — cost down to $250/ton', url: 'https://ethz.ch/en/research.html' },
    { cat: 'deals', text: 'Google signs 10-year carbon removal agreement with Climeworks worth estimated $180M', url: 'https://climeworks.com' },
    { cat: 'policy', text: 'US SEC finalizes climate disclosure rules requiring Scope 1 & 2 emissions reporting for large filers', url: 'https://www.sec.gov/climate-disclosures' },
    { cat: 'market', text: 'RGGI carbon permit prices steady at $14.80 amid increased auction participation from utilities', url: 'https://www.rggi.org' },
    { cat: 'science', text: 'Ocean-based carbon removal startup Running Tide completes 10,000 ton verification milestone', url: 'https://www.runningtide.com' },
    { cat: 'deals', text: 'Stripe Climate funds $8M in new biochar projects across Southeast Asia through Frontier portfolio', url: 'https://frontierclimate.com' },
    { cat: 'policy', text: 'Article 6 carbon credit framework sees first cross-border transaction — Switzerland and Thailand', url: 'https://unfccc.int/process-and-meetings/the-paris-agreement/article-64-mechanism' },
];

// ─── State ───────────────────────────────────────────────────
const state = {
    prices: {},
    prevPrices: {},
    selectedTicker: 'KRBN',
    selectedTimeframe: '1month',
    selectedAIBand: '1d',
    chart: null,
    isFirstLoad: true,
};

// ─── DOM ─────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const DOM = {
    tickerStrip: $('tickerStrip'),
    connectionStatus: $('connectionStatus'),
    lastUpdated: $('lastUpdated'),
    tickerCount: $('tickerCount'),
    chartTitle: $('chartTitle'),
    chartLoading: $('chartLoading'),
    priceChart: $('priceChart'),
    timeframeSelector: $('timeframeSelector'),
    aiTimebandSelector: $('aiTimebandSelector'),
    aiSummaryBody: $('aiSummaryBody'),
    aiTimestamp: $('aiTimestamp'),
    buyersList: $('buyersList'),
    tickerScroll: $('tickerScroll'),
    marketTableBody: $('marketTableBody'),
    statOpen: $('statOpen'),
    statHigh: $('statHigh'),
    statLow: $('statLow'),
    statVolume: $('statVolume'),
    statAvg: $('statAvg'),
    apiCredits: $('apiCredits'),
};

// ─── Helpers ─────────────────────────────────────────────────
const fmt = (v) => v == null || isNaN(v) ? '--' : '$' + parseFloat(v).toFixed(2);
const fmtChange = (v) => { if (v == null || isNaN(v)) return '--'; const n = parseFloat(v); return (n >= 0 ? '+' : '') + n.toFixed(2); };
const fmtPct = (v) => { if (v == null || isNaN(v)) return '--'; const n = parseFloat(v); return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; };
const fmtVol = (v) => { if (v == null || isNaN(v)) return '--'; const n = parseInt(v); if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return n.toLocaleString(); };

function setStatus(type, text) {
    const dot = DOM.connectionStatus.querySelector('.status-dot');
    const txt = DOM.connectionStatus.querySelector('.status-text');
    dot.className = 'status-dot' + (type === 'ok' ? ' ok' : type === 'err' ? ' err' : '');
    txt.textContent = text;
}

function toast(msg) {
    const existing = document.querySelector('.error-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'error-toast';
    el.textContent = '⚠ ' + msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
}

// ─── API CREDIT TRACKING ─────────────────────────────────────
const API_DAILY_LIMIT = 800;
const API_MINUTE_LIMIT = 8;

function getApiUsage() {
    const stored = localStorage.getItem('carbonpulse_api_usage');
    if (stored) {
        const data = JSON.parse(stored);
        const today = new Date().toDateString();
        if (data.date === today) return data;
    }
    // Reset for new day
    const fresh = { date: new Date().toDateString(), count: 0, minuteLog: [] };
    localStorage.setItem('carbonpulse_api_usage', JSON.stringify(fresh));
    return fresh;
}

function trackApiCall() {
    const usage = getApiUsage();
    usage.count++;
    const now = Date.now();
    usage.minuteLog.push(now);
    // Keep only calls within last 60 seconds
    usage.minuteLog = usage.minuteLog.filter(t => now - t < 60000);
    localStorage.setItem('carbonpulse_api_usage', JSON.stringify(usage));
    updateApiDisplay(usage);
    return usage;
}

function updateApiDisplay(usage) {
    if (!usage) usage = getApiUsage();
    const el = DOM.apiCredits;
    if (!el) return;
    const pct = usage.count / API_DAILY_LIMIT;
    const perMin = usage.minuteLog ? usage.minuteLog.filter(t => Date.now() - t < 60000).length : 0;

    el.textContent = `${usage.count}/${API_DAILY_LIMIT}`;

    if (usage.count >= API_DAILY_LIMIT) {
        el.style.color = '#ff5252';
        el.title = 'DAILY LIMIT REACHED — Resets at midnight';
    } else if (pct >= 0.8) {
        el.style.color = '#ffab40';
        const remaining = API_DAILY_LIMIT - usage.count;
        el.title = `${remaining} credits remaining today`;
    } else if (perMin >= API_MINUTE_LIMIT) {
        el.style.color = '#ffab40';
        el.title = `Rate limit: ${perMin}/${API_MINUTE_LIMIT} calls this minute`;
    } else {
        el.style.color = '';
        el.title = `${API_DAILY_LIMIT - usage.count} credits remaining today | ${perMin}/${API_MINUTE_LIMIT} this minute`;
    }
}

function canMakeApiCall() {
    const usage = getApiUsage();
    if (usage.count >= API_DAILY_LIMIT) {
        toast(`Daily API limit reached (${API_DAILY_LIMIT}). Resets at midnight.`);
        return false;
    }
    return true;
}

// ─── API ─────────────────────────────────────────────────────
async function fetchQuote(symbol) {
    if (!canMakeApiCall()) return null;
    trackApiCall();
    const r = await fetch(`${CONFIG.BASE_URL}/quote?symbol=${symbol}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
}

async function fetchTimeSeries(symbol, interval, outputsize) {
    if (!canMakeApiCall()) return null;
    trackApiCall();
    const r = await fetch(`${CONFIG.BASE_URL}/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputsize}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
}

async function fetchAllQuotes() {
    const results = {};
    const apiTickers = CONFIG.TICKERS.filter(t => t.isApi);
    for (const t of apiTickers) {
        try {
            results[t.symbol] = await fetchQuote(t.symbol);
        } catch (e) {
            console.error(`Fetch ${t.symbol}:`, e);
            results[t.symbol] = null;
        }
        await new Promise(r => setTimeout(r, 1500));
    }
    return results;
}

// ─── TICKER STRIP ────────────────────────────────────────────
function renderTickerStrip() {
    DOM.tickerStrip.innerHTML = CONFIG.TICKERS.map(t => {
        const isActive = t.symbol === state.selectedTicker;
        if (!t.isApi) {
            return `<div class="ticker-item${isActive ? ' active' : ''}" data-symbol="${t.symbol}">
                <span class="t-symbol">${t.symbol}</span>
                <span class="t-price">${fmt(t.refPrice)}</span>
                <span class="t-change flat">${t.refUnit}</span>
                <span class="t-badge ${t.badgeClass}">${t.badge}</span>
            </div>`;
        }
        return `<div class="ticker-item skeleton${isActive ? ' active' : ''}" data-symbol="${t.symbol}">
            <span class="t-symbol">${t.symbol}</span>
            <span class="t-price">--</span>
            <span class="t-change flat">--</span>
            <span class="t-badge ${t.badgeClass}">${t.badge}</span>
        </div>`;
    }).join('');

    DOM.tickerStrip.querySelectorAll('.ticker-item').forEach(el => {
        el.addEventListener('click', () => {
            const sym = el.dataset.symbol;
            const tk = CONFIG.TICKERS.find(t => t.symbol === sym);
            if (tk && tk.isApi) selectTicker(sym);
        });
    });
}

function updateTickerStrip(quotes) {
    let loaded = 0;
    CONFIG.TICKERS.forEach(t => {
        if (!t.isApi) { loaded++; return; }
        const el = DOM.tickerStrip.querySelector(`[data-symbol="${t.symbol}"]`);
        if (!el) return;
        const d = quotes[t.symbol];
        if (!d) return;
        loaded++;
        el.classList.remove('skeleton');
        const change = parseFloat(d.change);
        const pct = parseFloat(d.percent_change);
        const dir = change >= 0 ? 'up' : 'down';
        if (change === 0) {
            el.querySelector('.t-change').className = 't-change flat';
        }
        el.querySelector('.t-price').textContent = fmt(d.close);
        const changeEl = el.querySelector('.t-change');
        changeEl.textContent = fmtPct(pct);
        changeEl.className = 't-change ' + (change === 0 ? 'flat' : dir);

        // Flash animation
        const prev = state.prevPrices[t.symbol];
        if (prev != null && prev !== parseFloat(d.close)) {
            el.style.animation = 'none';
            el.offsetHeight; // trigger reflow
            el.style.animation = parseFloat(d.close) > prev ? 'flash-up 0.8s ease-out' : 'flash-down 0.8s ease-out';
        }
    });
    DOM.tickerCount.textContent = `${loaded}/${CONFIG.TICKERS.length}`;
}

// ─── CHART ───────────────────────────────────────────────────
async function loadChart(symbol, tfKey) {
    const tf = TIMEFRAME_MAP[tfKey];
    const tk = CONFIG.TICKERS.find(t => t.symbol === symbol);
    DOM.chartLoading.classList.remove('hidden');
    DOM.chartTitle.textContent = `${symbol} — ${tk.short}`;

    try {
        const data = await fetchTimeSeries(symbol, tf.interval, tf.outputsize);
        if (!data.values?.length) throw new Error('No data');

        const vals = data.values.slice().reverse();
        const labels = vals.map(v => v.datetime);
        const prices = vals.map(v => parseFloat(v.close));
        const highs = vals.map(v => parseFloat(v.high));
        const lows = vals.map(v => parseFloat(v.low));
        const vols = vals.map(v => parseInt(v.volume || 0));
        const opens = vals.map(v => parseFloat(v.open));

        DOM.statOpen.textContent = fmt(opens[opens.length - 1]);
        DOM.statHigh.textContent = fmt(Math.max(...highs));
        DOM.statLow.textContent = fmt(Math.min(...lows));
        DOM.statVolume.textContent = fmtVol(vols.reduce((a, b) => a + b, 0));
        DOM.statAvg.textContent = fmt(prices.reduce((a, b) => a + b, 0) / prices.length);

        renderChart(labels, prices, tk);
    } catch (e) {
        console.error('Chart error:', e);
        toast(`Chart: ${e.message}`);
    } finally {
        DOM.chartLoading.classList.add('hidden');
    }
}

function renderChart(labels, prices, tk) {
    const ctx = DOM.priceChart.getContext('2d');
    if (state.chart) state.chart.destroy();

    const grad = ctx.createLinearGradient(0, 0, 0, 340);
    grad.addColorStop(0, tk.colorDim);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    const up = prices[prices.length - 1] >= prices[0];
    const lineColor = up ? tk.color : '#ff5252';

    state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: prices,
                borderColor: lineColor,
                backgroundColor: grad,
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: lineColor,
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 1.5,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(12,16,23,0.95)',
                    titleColor: '#5a6b82',
                    bodyColor: '#e8edf5',
                    bodyFont: { family: 'JetBrains Mono', size: 12, weight: '600' },
                    titleFont: { family: 'JetBrains Mono', size: 9 },
                    padding: 10,
                    cornerRadius: 4,
                    borderColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    displayColors: false,
                    callbacks: {
                        label: (item) => `  ${fmt(item.raw)}`,
                    },
                },
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.025)', drawBorder: false },
                    ticks: { color: '#3a4a5e', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 7, maxRotation: 0 },
                },
                y: {
                    position: 'right',
                    grid: { color: 'rgba(255,255,255,0.025)', drawBorder: false },
                    ticks: { color: '#3a4a5e', font: { family: 'JetBrains Mono', size: 9 }, callback: v => '$' + v.toFixed(2) },
                },
            },
            animation: { duration: 600, easing: 'easeOutQuart' },
        },
    });
}

// ─── AI MARKET SUMMARY ──────────────────────────────────────
function generateAISummary(quotes, band) {
    const lines = [];
    const apiTickers = CONFIG.TICKERS.filter(t => t.isApi);

    apiTickers.forEach(t => {
        const d = quotes[t.symbol];
        if (!d) { lines.push(`<span class="highlight">${t.symbol}</span> — Data unavailable.`); return; }

        const price = parseFloat(d.close);
        const change = parseFloat(d.change);
        const pct = parseFloat(d.percent_change);
        const vol = parseInt(d.volume || 0);
        const high = parseFloat(d.high);
        const low = parseFloat(d.low);
        const range = ((high - low) / low * 100).toFixed(2);

        let direction, sentiment, cls;
        if (pct > 1) { direction = 'surged'; sentiment = 'Bullish momentum'; cls = 'positive'; }
        else if (pct > 0) { direction = 'edged higher'; sentiment = 'Mildly positive'; cls = 'positive'; }
        else if (pct > -1) { direction = 'dipped slightly'; sentiment = 'Neutral to bearish'; cls = 'negative'; }
        else { direction = 'fell sharply'; sentiment = 'Bearish pressure'; cls = 'negative'; }

        let volContext;
        if (vol > 500000) volContext = 'on heavy volume';
        else if (vol > 100000) volContext = 'on moderate volume';
        else if (vol > 0) volContext = 'on light volume';
        else volContext = 'with minimal trading activity';

        lines.push(
            `<span class="highlight">${t.symbol}</span> ${direction} <span class="${cls}">${fmtPct(pct)}</span> to <span class="highlight">${fmt(price)}</span> ${volContext} (${fmtVol(vol)}). Day range: ${fmt(low)}–${fmt(high)} (${range}% spread). ${sentiment}.`
        );
    });

    // Biochar line
    const biochar = CONFIG.TICKERS.find(t => t.symbol === 'BIOCHAR');
    lines.push(
        `<span class="highlight">BIOCHAR</span> voluntary credits assessed at <span class="highlight">${fmt(biochar.refPrice)}${biochar.refUnit}</span>. Market stable with steady demand from tech sector removal commitments (Source: Puro.earth / S&P Platts).`
    );

    // Outlook line
    const krbn = quotes['KRBN'];
    const grn = quotes['GRN'];
    let outlook = 'Mixed signals across carbon markets.';
    if (krbn && grn) {
        const avgChange = (parseFloat(krbn.percent_change) + parseFloat(grn.percent_change)) / 2;
        if (avgChange > 0.5) outlook = '<span class="positive">OUTLOOK: Bullish</span> — Carbon credit indices trending higher. Watch for continued momentum.';
        else if (avgChange < -0.5) outlook = '<span class="negative">OUTLOOK: Bearish</span> — Selling pressure across carbon markets. Monitor EU policy developments.';
        else outlook = 'OUTLOOK: Neutral — Markets consolidating. Key levels to watch: KRBN $29–$31 range.';
    }
    lines.push(outlook);

    return lines;
}

async function renderAISummary(quotes) {
    try {
        DOM.aiSummaryBody.innerHTML = '<div class="ai-loading"><span class="terminal-cursor">▮</span> Requesting Gemini analysis...</div>';

        const r = await fetch(`${CONFIG.BASE_URL}/ai-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prices: quotes, timeframe: state.selectedAIBand })
        });
        const data = await r.json();

        const lines = data.summary || generateAISummary(quotes, state.selectedAIBand);
        DOM.aiSummaryBody.innerHTML = lines.map(l => `<div class="ai-line">${l}</div>`).join('');
        DOM.aiTimestamp.textContent = new Date().toLocaleTimeString();
    } catch (e) {
        const lines = generateAISummary(quotes, state.selectedAIBand);
        DOM.aiSummaryBody.innerHTML = lines.map(l => `<div class="ai-line">${l}</div>`).join('');
        DOM.aiTimestamp.textContent = new Date().toLocaleTimeString();
    }
}

// ─── TOP BUYERS ─────────────────────────────────────────────
function renderBuyers() {
    const maxAmount = TOP_BUYERS[0].amount;
    DOM.buyersList.innerHTML = TOP_BUYERS.map((b, i) => {
        const pct = (b.amount / maxAmount * 100).toFixed(0);
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        return `<div class="buyer-row">
            <span class="buyer-rank ${rankClass}">#${i + 1}</span>
            <div class="buyer-info">
                <a class="buyer-name" href="${b.source}" target="_blank" title="View ${b.name} sustainability report">${b.name}</a>
            </div>
            <div class="buyer-bar-container">
                <div class="buyer-bar ${b.type}" style="width: 0%;" data-width="${pct}"></div>
            </div>
            <span class="buyer-amount">${b.label}</span>
        </div>`;
    }).join('');

    // Animate bars after render
    requestAnimationFrame(() => {
        setTimeout(() => {
            document.querySelectorAll('.buyer-bar').forEach(bar => {
                bar.style.width = bar.dataset.width + '%';
            });
        }, 100);
    });
}

// ─── NEWS TICKER ────────────────────────────────────────────
let newsIndex = 0;
let newsInterval = null;
let activeNews = [];

async function renderNewsTicker() {
    try {
        const r = await fetch(`${CONFIG.BASE_URL}/news`);
        activeNews = await r.json();
        if (!activeNews || activeNews.length === 0) activeNews = NEWS_ITEMS;

        showNewsItem(0);

        if (newsInterval) clearInterval(newsInterval);
        newsInterval = setInterval(() => {
            newsIndex = (newsIndex + 1) % activeNews.length;
            showNewsItem(newsIndex);
        }, 5000);
    } catch (e) {
        activeNews = NEWS_ITEMS;
        showNewsItem(0);
    }
}

function showNewsItem(idx) {
    if (!activeNews || activeNews.length === 0) return;
    const n = activeNews[idx];
    const searchUrl = n.url || ('https://www.google.com/search?q=' + encodeURIComponent(n.text));
    const catLabels = { market: 'MARKET', policy: 'POLICY', science: 'SCIENCE', deals: 'DEALS' };
    DOM.tickerScroll.innerHTML = `
        <a class="news-item" href="${searchUrl}" target="_blank" title="View Source">
            <span class="news-dot ${n.cat}"></span>
            <span style="font-size:9px;font-weight:700;color:var(--text-2);letter-spacing:0.08em;margin-right:4px">${catLabels[n.cat] || ''}</span>
            ${n.text}
        </a>
        <span class="news-counter">${idx + 1}/${activeNews.length}</span>
    `;
}

// ─── MARKET TABLE ───────────────────────────────────────────
function updateMarketTable(quotes) {
    const apiRows = CONFIG.TICKERS.filter(t => t.isApi).map(t => {
        const d = quotes[t.symbol];
        if (!d) return `<tr><td class="td-ticker">${t.symbol}</td><td class="td-name">${t.short}</td><td colspan="8" style="color:var(--text-3)">Unavailable</td></tr>`;
        const change = parseFloat(d.change);
        const cls = change >= 0 ? 'td-positive' : 'td-negative';
        const typeClass = t.badge === 'ENERGY' ? 'energy' : 'compliance';
        return `<tr>
            <td class="td-ticker">${t.symbol}</td>
            <td class="td-name">${t.short}</td>
            <td>${fmt(d.close)}</td>
            <td class="${cls}">${fmtChange(change)}</td>
            <td class="${cls}">${fmtPct(d.percent_change)}</td>
            <td>${fmtVol(d.volume)}</td>
            <td>${fmt(d.fifty_two_week?.high)}</td>
            <td>${fmt(d.fifty_two_week?.low)}</td>
            <td><span class="td-type ${typeClass}">${t.badge}</span></td>
            <td><a class="source-link" href="${t.source}" target="_blank">↗</a></td>
        </tr>`;
    }).join('');

    const staticRows = CONFIG.TICKERS.filter(t => !t.isApi).map(t =>
        `<tr>
            <td class="td-ticker" style="color:var(--purple)">${t.symbol}</td>
            <td class="td-name">${t.short}</td>
            <td>${fmt(t.refPrice)}${t.refUnit}</td>
            <td style="color:var(--text-3)">—</td>
            <td style="color:var(--text-3)">—</td>
            <td style="color:var(--text-3)">OTC</td>
            <td style="color:var(--text-3)">—</td>
            <td style="color:var(--text-3)">—</td>
            <td><span class="td-type voluntary">${t.badge}</span></td>
            <td><a class="source-link" href="${t.source}" target="_blank">↗</a></td>
        </tr>`
    ).join('');

    DOM.marketTableBody.innerHTML = apiRows + staticRows;
}

// ─── INTERACTIONS ───────────────────────────────────────────
function selectTicker(symbol) {
    const tk = CONFIG.TICKERS.find(t => t.symbol === symbol);
    if (!tk || !tk.isApi) return;
    state.selectedTicker = symbol;

    // Update chart source link
    const chartSourceLink = document.getElementById('chartSourceLink');
    if (chartSourceLink) chartSourceLink.href = tk.source;

    DOM.tickerStrip.querySelectorAll('.ticker-item').forEach(el => {
        el.classList.toggle('active', el.dataset.symbol === symbol);
    });

    loadChart(symbol, state.selectedTimeframe);
}

function setupTimeframeButtons() {
    DOM.timeframeSelector.addEventListener('click', e => {
        const btn = e.target.closest('.tf-btn');
        if (!btn) return;
        state.selectedTimeframe = btn.dataset.range;
        DOM.timeframeSelector.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadChart(state.selectedTicker, btn.dataset.range);
    });
}

function setupAITimebands() {
    DOM.aiTimebandSelector.addEventListener('click', e => {
        const btn = e.target.closest('.ai-tb-btn');
        if (!btn) return;
        state.selectedAIBand = btn.dataset.band;
        DOM.aiTimebandSelector.querySelectorAll('.ai-tb-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (Object.keys(state.prices).length > 0) renderAISummary(state.prices);
    });
}

// ─── MAIN LOOP ──────────────────────────────────────────────
async function refreshData() {
    try {
        setStatus('', 'UPDATING');
        const quotes = await fetchAllQuotes();
        state.prices = quotes;

        updateTickerStrip(quotes);
        updateMarketTable(quotes);
        renderAISummary(quotes);

        // Store prev prices
        CONFIG.TICKERS.filter(t => t.isApi).forEach(t => {
            if (quotes[t.symbol]) state.prevPrices[t.symbol] = parseFloat(quotes[t.symbol].close);
        });

        DOM.lastUpdated.textContent = new Date().toLocaleTimeString();
        setStatus('ok', 'CONNECTED');

        if (state.isFirstLoad) {
            state.isFirstLoad = false;
            await loadChart(state.selectedTicker, state.selectedTimeframe);
        }
    } catch (e) {
        console.error('Refresh error:', e);
        setStatus('err', 'ERROR');
        toast('Data refresh failed. Retrying...');
    }
}

// ─── INIT ────────────────────────────────────────────────────
async function init() {
    console.log('🖥️ AdvanceMarkets Terminal v2 starting...');

    renderTickerStrip();
    renderBuyers();
    renderNewsTicker();
    setupTimeframeButtons();
    setupAITimebands();
    updateApiDisplay(); // Show existing usage on load

    await refreshData();

    setInterval(refreshData, CONFIG.REFRESH_INTERVAL);

    console.log('✅ Terminal ready');
}

document.addEventListener('DOMContentLoaded', init);
