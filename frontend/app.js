const CONFIG = {
    baseUrl: "/api",
    refreshMs: 300000,
    requestTimeoutMs: 15000,
    instruments: [
        { symbol: "KRBN", name: "Global Carbon Strategy ETF", market: "Global compliance", type: "ETF proxy", description: "Tracks a basket of major compliance allowance futures, including EU, California, UK, RGGI, and Washington markets.", source: "https://kraneshares.com/etf/krbn/" },
        { symbol: "KCCA", name: "California Carbon Allowance Strategy ETF", market: "California / Quebec", type: "ETF proxy", description: "Provides futures-based exposure to the California and Quebec linked cap-and-trade market.", source: "https://kraneshares.com/etf/kcca/" },
        { symbol: "CTWO", name: "Physical European Carbon Allowance Trust", market: "EU ETS", type: "Physical trust", description: "Holds European Union Allowances and is designed to reflect EUA performance less trust expenses.", source: "https://www.sec.gov/Archives/edgar/data/1958928/000121390026021883/ea0277806-10k_cotwo.htm" },
        { symbol: "GRN", name: "iPath Series B Carbon ETN", market: "Global compliance", type: "ETN proxy", description: "An exchange-traded note linked to a global carbon allowance index; it also carries issuer credit risk.", source: "https://twelvedata.com/symbol/GRN" },
    ],
    timeframes: {
        "1day": { interval: "15min", outputsize: 32, label: "1D" },
        "1week": { interval: "1h", outputsize: 40, label: "1W" },
        "1month": { interval: "1day", outputsize: 30, label: "1M" },
        "3months": { interval: "1day", outputsize: 90, label: "3M" },
        "1year": { interval: "1week", outputsize: 52, label: "1Y" },
    },
};

const state = {
    quotes: {},
    selectedSymbol: "KRBN",
    selectedTimeframe: "1month",
    selectedNewsFilter: "all",
    news: [],
    chart: null,
    chatHistory: [],
    newsIndex: 0,
    newsTimer: null,
};

const byId = id => document.getElementById(id);
const instrumentFor = symbol => CONFIG.instruments.find(item => item.symbol === symbol);
const quoteStoreKey = "advance_markets_last_quotes_v1";

function formatPrice(value, currency = "USD") {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
}

function formatPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function formatVolume(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(number);
}

function formatTimestamp(value, includeDate = false) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return new Intl.DateTimeFormat(undefined, {
        month: includeDate ? "short" : undefined,
        day: includeDate ? "numeric" : undefined,
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: includeDate ? "short" : undefined,
    }).format(date);
}

function safeUrl(value) {
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}

async function fetchJson(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
    try {
        const response = await fetch(`${CONFIG.baseUrl}${path}`, { ...options, signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
        return data;
    } finally {
        clearTimeout(timeout);
    }
}

function readStoredQuotes() {
    try {
        const stored = JSON.parse(localStorage.getItem(quoteStoreKey) || "{}");
        return stored && typeof stored === "object" ? stored : {};
    } catch {
        return {};
    }
}

function storeLiveQuotes(quotes) {
    const existing = readStoredQuotes();
    Object.entries(quotes).forEach(([symbol, quote]) => {
        if (quote?.close != null && quote.status !== "stale") existing[symbol] = quote;
    });
    localStorage.setItem(quoteStoreKey, JSON.stringify(existing));
}

function mergeWithLastKnown(apiQuotes = {}) {
    const stored = readStoredQuotes();
    const merged = {};
    CONFIG.instruments.forEach(({ symbol }) => {
        const current = apiQuotes[symbol];
        merged[symbol] = current?.close != null ? current : stored[symbol] ? { ...stored[symbol], status: "stale" } : null;
    });
    return merged;
}

function setConnection(status, label) {
    const container = byId("connectionStatus");
    const dot = container.querySelector(".status-dot");
    dot.className = `status-dot ${status}`;
    container.querySelector(".status-text").textContent = label;
}

function showToast(message) {
    const toast = byId("toast");
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 6000);
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

function renderTickerStrip() {
    const strip = byId("tickerStrip");
    strip.replaceChildren();
    CONFIG.instruments.forEach(instrument => {
        const quote = state.quotes[instrument.symbol];
        const button = element("button", `ticker-item${instrument.symbol === state.selectedSymbol ? " active" : ""}`);
        button.type = "button";
        button.dataset.symbol = instrument.symbol;
        button.setAttribute("aria-label", `Select ${instrument.name}`);
        button.append(
            element("span", "ticker-symbol", instrument.symbol),
            element("span", "ticker-price", quote ? formatPrice(quote.close, quote.currency) : "--"),
            element("span", "ticker-market", instrument.market),
        );
        const change = element("span", "ticker-change", quote ? formatPercent(quote.percent_change) : "UNAVAILABLE");
        if (quote) {
            change.classList.add(quote.status === "stale" ? "stale-text" : Number(quote.percent_change) >= 0 ? "positive" : "negative");
        }
        button.append(change);
        button.addEventListener("click", () => selectInstrument(instrument.symbol));
        strip.append(button);
    });
}

function renderMarketTable() {
    const body = byId("marketTableBody");
    body.replaceChildren();
    CONFIG.instruments.forEach(instrument => {
        const quote = state.quotes[instrument.symbol];
        const row = document.createElement("tr");
        const labels = ["SYMBOL", "INSTRUMENT", "MARKET"];
        const values = [instrument.symbol, instrument.name, instrument.market];
        values.forEach((value, index) => {
            const cell = element("td", index === 0 ? "symbol-cell" : index === 1 ? "name-cell" : "", value);
            cell.dataset.label = labels[index];
            row.append(cell);
        });
        const priceCell = element("td", "", quote ? formatPrice(quote.close, quote.currency) : "--");
        priceCell.dataset.label = "PRICE";
        row.append(priceCell);
        const change = element("td", quote ? (Number(quote.percent_change) >= 0 ? "positive" : "negative") : "", quote ? formatPercent(quote.percent_change) : "--");
        change.dataset.label = "CHANGE";
        const volumeCell = element("td", "", quote ? formatVolume(quote.volume) : "--");
        volumeCell.dataset.label = "VOLUME";
        row.append(change, volumeCell);
        const statusCell = document.createElement("td");
        statusCell.dataset.label = "STATUS";
        const status = quote?.status || "unavailable";
        statusCell.append(element("span", `status-pill ${status}`, status.toUpperCase()));
        const updatedCell = element("td", "", quote ? formatTimestamp(quote.fetched_at, true) : "--");
        updatedCell.dataset.label = "UPDATED";
        row.append(statusCell, updatedCell);
        body.append(row);
    });
}

function updateSelectedQuote() {
    const quote = state.quotes[state.selectedSymbol];
    byId("headlinePrice").textContent = quote ? formatPrice(quote.close, quote.currency) : "--";
    byId("priceUpdated").textContent = quote ? formatTimestamp(quote.fetched_at, true) : "No stored price";
    const badge = byId("freshnessBadge");
    badge.className = `freshness-badge ${quote?.status || ""}`;
    badge.textContent = quote?.status === "stale" ? "LAST KNOWN" : quote ? "LIVE" : "UNAVAILABLE";
}

async function refreshQuotes() {
    setConnection("", "UPDATING");
    try {
        const payload = await fetchJson("/quotes");
        state.quotes = mergeWithLastKnown(payload.quotes);
        storeLiveQuotes(payload.quotes || {});
        const available = Object.values(state.quotes).filter(Boolean).length;
        const stale = Object.values(state.quotes).some(quote => quote?.status === "stale");
        byId("tickerCount").textContent = `${available} / ${CONFIG.instruments.length}`;
        byId("lastUpdated").textContent = formatTimestamp(payload.requested_at || new Date().toISOString());
        setConnection(payload.status === "ok" && !stale ? "ok" : available ? "stale" : "err", payload.status === "ok" && !stale ? "CONNECTED" : available ? "PARTIAL / STALE" : "UNAVAILABLE");
    } catch {
        state.quotes = mergeWithLastKnown({});
        const available = Object.values(state.quotes).filter(Boolean).length;
        byId("tickerCount").textContent = `${available} / ${CONFIG.instruments.length}`;
        byId("lastUpdated").textContent = formatTimestamp(new Date().toISOString());
        setConnection(available ? "stale" : "err", available ? "LAST KNOWN DATA" : "UNAVAILABLE");
        showToast(available ? "Live prices are unavailable. Showing the last successfully updated prices." : "Market prices are temporarily unavailable.");
    }
    renderTickerStrip();
    renderMarketTable();
    updateSelectedQuote();
    renderAnalytics();
}

function calculateMetrics(values) {
    const rows = values
        .map(row => ({ ...row, closeNumber: Number(row.close) }))
        .filter(row => Number.isFinite(row.closeNumber))
        .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    if (rows.length < 2) return null;
    const closes = rows.map(row => row.closeNumber);
    const returns = closes.slice(1).map((value, index) => ((value / closes[index]) - 1) * 100);
    const meanReturn = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + ((value - meanReturn) ** 2), 0) / returns.length;
    const start = closes[0];
    const end = closes.at(-1);
    return {
        rows,
        start,
        end,
        return_pct: ((end / start) - 1) * 100,
        high: Math.max(...closes),
        low: Math.min(...closes),
        average: closes.reduce((sum, value) => sum + value, 0) / closes.length,
        volatility_pct: Math.sqrt(variance),
        volume: rows.reduce((sum, row) => sum + (Number(row.volume) || 0), 0),
    };
}

function showChartState(message) {
    const node = byId("chartLoading");
    node.textContent = message;
    node.hidden = false;
}

function renderChart(metrics, instrument) {
    if (state.chart) state.chart.destroy();
    const context = byId("priceChart").getContext("2d");
    state.chart = new Chart(context, {
        type: "line",
        data: {
            labels: metrics.rows.map(row => row.datetime),
            datasets: [{ data: metrics.rows.map(row => row.closeNumber), borderColor: "#35d98b", backgroundColor: "rgba(53,217,139,.08)", borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 4, fill: true, tension: .15 }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: "index" },
            plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { label: ctx => `${instrument.symbol} ${formatPrice(ctx.parsed.y)}` } } },
            scales: {
                x: { grid: { display: false }, ticks: { color: "#697981", maxTicksLimit: 7, font: { family: "IBM Plex Mono", size: 10 } } },
                y: { position: "right", grid: { color: "#192228" }, ticks: { color: "#697981", font: { family: "IBM Plex Mono", size: 10 }, callback: value => `$${Number(value).toFixed(2)}` } },
            },
        },
    });
    byId("chartLoading").hidden = true;
}

function updateMetricDisplay(metrics) {
    byId("headlineChange").textContent = formatPercent(metrics.return_pct);
    byId("headlineChange").className = metrics.return_pct >= 0 ? "positive" : "negative";
    byId("statOpen").textContent = formatPrice(metrics.start);
    byId("statHigh").textContent = formatPrice(metrics.high);
    byId("statLow").textContent = formatPrice(metrics.low);
    byId("statAvg").textContent = formatPrice(metrics.average);
    byId("statVolatility").textContent = `${metrics.volatility_pct.toFixed(2)}%`;
}

function computedSummary(metrics) {
    const direction = metrics.return_pct > .25 ? "advanced" : metrics.return_pct < -.25 ? "declined" : "was broadly flat";
    return [
        `The security ${direction} ${Math.abs(metrics.return_pct).toFixed(2)}% over the selected period.`,
        `The observed range was ${formatPrice(metrics.low)} to ${formatPrice(metrics.high)}.`,
        `Average interval volatility measured ${metrics.volatility_pct.toFixed(2)}%.`,
        "This security is a market proxy; it is not a direct allowance spot quote.",
    ];
}

function renderSummaryLines(lines) {
    const body = byId("aiSummaryBody");
    body.replaceChildren(...lines.map(line => element("p", "summary-line", line)));
    byId("aiTimestamp").textContent = formatTimestamp(new Date().toISOString());
}

async function requestAISummary(metrics) {
    renderSummaryLines(computedSummary(metrics));
    try {
        const serializable = { ...metrics };
        delete serializable.rows;
        const data = await fetchJson("/ai-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol: state.selectedSymbol, timeframe: state.selectedTimeframe, metrics: serializable }),
        });
        if (Array.isArray(data.summary) && data.summary.length === 4) renderSummaryLines(data.summary.map(String));
    } catch {
        // The deterministic, computed summary remains visible when AI is offline.
    }
}

async function loadChart() {
    const instrument = instrumentFor(state.selectedSymbol);
    const timeframe = CONFIG.timeframes[state.selectedTimeframe];
    showChartState("Loading verified history...");
    byId("headlineChange").textContent = "--";
    try {
        const data = await fetchJson(`/time_series?symbol=${encodeURIComponent(state.selectedSymbol)}&interval=${timeframe.interval}&outputsize=${timeframe.outputsize}`);
        const metrics = calculateMetrics(data.values || []);
        if (!metrics) throw new Error("Not enough verified history");
        renderChart(metrics, instrument);
        updateMetricDisplay(metrics);
        requestAISummary(metrics);
    } catch {
        if (state.chart) { state.chart.destroy(); state.chart = null; }
        showChartState("Verified historical data is temporarily unavailable. No simulated series is shown.");
        ["statOpen", "statHigh", "statLow", "statAvg", "statVolatility"].forEach(id => { byId(id).textContent = "--"; });
        byId("aiSummaryBody").replaceChildren(element("p", "muted", "Analysis is unavailable until verified historical data can be loaded."));
    }
}

function selectInstrument(symbol) {
    state.selectedSymbol = symbol;
    const instrument = instrumentFor(symbol);
    byId("chartTitle").textContent = `${instrument.symbol} / ${instrument.name}`;
    byId("chartMarket").textContent = `${instrument.market.toUpperCase()} / ${instrument.type.toUpperCase()}`;
    byId("chartSourceLink").href = instrument.source;
    renderTickerStrip();
    updateSelectedQuote();
    loadChart();
}

function setupTimeframes() {
    byId("timeframeSelector").addEventListener("click", event => {
        const button = event.target.closest("button[data-range]");
        if (!button) return;
        state.selectedTimeframe = button.dataset.range;
        byId("timeframeSelector").querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
        loadChart();
    });
}

function setupTabs() {
    const tabs = [...byId("tabNav").querySelectorAll("[role=tab]")];
    function activate(tab) {
        tabs.forEach(item => {
            const active = item === tab;
            item.classList.toggle("active", active);
            item.setAttribute("aria-selected", String(active));
            byId(item.getAttribute("aria-controls")).hidden = !active;
        });
        if (tab.dataset.tab === "news") loadNews();
        if (tab.dataset.tab === "trends") renderAnalytics();
    }
    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => activate(tab));
        tab.addEventListener("keydown", event => {
            if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
            tabs[next].focus();
            activate(tabs[next]);
        });
    });
}

async function loadNews(force = false) {
    if (state.news.length && !force) { renderNews(); return; }
    try {
        const payload = await fetchJson("/news");
        state.news = Array.isArray(payload.items) ? payload.items : [];
    } catch {
        state.news = [];
    }
    renderNews();
    startNewsTicker();
}

function renderNews() {
    const feed = byId("newsFeed");
    const filtered = state.selectedNewsFilter === "all" ? state.news : state.news.filter(item => item.cat === state.selectedNewsFilter);
    feed.replaceChildren();
    if (!filtered.length) {
        feed.append(element("p", "empty-state", "Verified news is temporarily unavailable. No placeholder headlines are being shown."));
        return;
    }
    filtered.forEach(item => {
        const url = safeUrl(item.url);
        if (!url) return;
        const card = element("article", "news-card");
        const meta = element("div", "news-card-meta");
        meta.append(element("span", "", (item.cat || "news").toUpperCase()), element("time", "", item.published_at ? formatTimestamp(item.published_at, true) : "DATE UNAVAILABLE"));
        const link = element("a", "", item.text);
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        card.append(meta, link, element("div", "news-card-source", item.source || new URL(url).hostname));
        feed.append(card);
    });
}

function startNewsTicker() {
    clearInterval(state.newsTimer);
    const ticker = byId("tickerScroll");
    function showCurrent() {
        ticker.replaceChildren();
        if (!state.news.length) { ticker.textContent = "Verified headlines are temporarily unavailable."; return; }
        const item = state.news[state.newsIndex % state.news.length];
        const url = safeUrl(item.url);
        if (!url) return;
        const link = element("a", "", `${(item.cat || "news").toUpperCase()} / ${item.text}`);
        link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
        ticker.append(link);
    }
    showCurrent();
    if (state.news.length > 1) state.newsTimer = setInterval(() => { state.newsIndex += 1; showCurrent(); }, 7000);
}

function setupNewsFilters() {
    byId("newsFilterGroup").addEventListener("click", event => {
        const button = event.target.closest("button[data-filter]");
        if (!button) return;
        state.selectedNewsFilter = button.dataset.filter;
        byId("newsFilterGroup").querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
        renderNews();
    });
}

function renderAnalytics() {
    const quotes = CONFIG.instruments.map(item => ({ item, quote: state.quotes[item.symbol] })).filter(entry => entry.quote);
    const movers = byId("moversList");
    movers.replaceChildren();
    if (!quotes.length) movers.append(element("p", "empty-state", "Awaiting market data."));
    const maxMove = Math.max(1, ...quotes.map(entry => Math.abs(Number(entry.quote.percent_change) || 0)));
    quotes.sort((a, b) => Math.abs(Number(b.quote.percent_change)) - Math.abs(Number(a.quote.percent_change))).forEach(entry => {
        const change = Number(entry.quote.percent_change) || 0;
        const row = element("div", "mover-row");
        const bar = element("div", "mover-bar");
        const fill = document.createElement("span");
        fill.style.width = `${Math.abs(change) / maxMove * 100}%`;
        if (change < 0) fill.className = "down";
        bar.append(fill);
        row.append(element("strong", "", entry.item.symbol), bar, element("span", change >= 0 ? "positive" : "negative", formatPercent(change)));
        movers.append(row);
    });
    const changes = quotes.map(entry => Number(entry.quote.percent_change)).filter(Number.isFinite);
    const advances = changes.filter(value => value > 0).length;
    const declines = changes.filter(value => value < 0).length;
    byId("sentimentValue").textContent = changes.length ? `${advances} UP / ${declines} DOWN` : "--";
    byId("sentimentDetail").textContent = changes.length ? `Breadth across ${changes.length} available carbon-linked securities. This is descriptive, not a sentiment forecast.` : "Awaiting market data.";
    const guide = byId("instrumentGuide");
    guide.replaceChildren(...CONFIG.instruments.map(item => {
        const card = element("article", "guide-card");
        card.append(element("strong", "", item.symbol), element("span", "", item.type.toUpperCase()), element("p", "", item.description));
        return card;
    }));
}

function appendChatMessage(role, content) {
    const container = byId("chatMessages");
    container.querySelector(".chat-welcome")?.remove();
    const message = element("div", `chat-msg ${role}`);
    message.append(element("div", "chat-msg-header", role === "user" ? "YOU" : "ADVANCEMARKETS AI"), element("div", "chat-msg-body", content));
    container.append(message);
    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage(message) {
    const sendButton = byId("chatSendBtn");
    appendChatMessage("user", message);
    sendButton.disabled = true;
    sendButton.textContent = "WAIT";
    try {
        const data = await fetchJson("/ai-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, history: state.chatHistory.slice(-12) }),
        });
        const reply = String(data.reply || "No response was returned.");
        appendChatMessage("ai", reply);
        state.chatHistory.push({ role: "user", parts: message }, { role: "model", parts: reply });
        state.chatHistory = state.chatHistory.slice(-12);
    } catch (error) {
        appendChatMessage("ai", error.message || "The research service is temporarily unavailable.");
    } finally {
        sendButton.disabled = false;
        sendButton.textContent = "SEND";
        byId("chatInput").focus();
    }
}

function setupChat() {
    byId("chatForm").addEventListener("submit", event => {
        event.preventDefault();
        const input = byId("chatInput");
        const message = input.value.trim();
        if (!message) return;
        input.value = "";
        sendChatMessage(message);
    });
    byId("quickPrompts").addEventListener("click", event => {
        const button = event.target.closest("button[data-prompt]");
        if (button) sendChatMessage(button.dataset.prompt);
    });
}

async function init() {
    setupTabs();
    setupTimeframes();
    setupNewsFilters();
    setupChat();
    state.quotes = mergeWithLastKnown({});
    renderTickerStrip();
    renderMarketTable();
    renderAnalytics();
    updateSelectedQuote();
    await Promise.all([refreshQuotes(), loadNews()]);
    await loadChart();
    setInterval(refreshQuotes, CONFIG.refreshMs);
}

document.addEventListener("DOMContentLoaded", init);
