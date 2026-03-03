import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import NodeCache from 'node-cache';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Caches: Quotes for 5 mins, TimeSeries for 10 mins, News for 30 mins
const cache = new NodeCache({ stdTTL: 300 });

app.use(cors());
app.use(express.json());

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ─── MARKET DATA PROXY (WITH CACHING) ────────────────────────
app.get('/api/quote', async (req, res) => {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

    const cacheKey = `quote_${symbol}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    try {
        console.log(`📡 Fetching quote for ${symbol} from Twelve Data...`);
        const response = await axios.get(`https://api.twelvedata.com/quote`, {
            params: { symbol, apikey: TWELVE_DATA_API_KEY }
        });

        if (response.data.code) throw new Error(response.data.message);

        cache.set(cacheKey, response.data);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/time_series', async (req, res) => {
    const { symbol, interval, outputsize } = req.query;
    const cacheKey = `ts_${symbol}_${interval}_${outputsize}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    try {
        console.log(`📈 Fetching time series for ${symbol} (${interval})...`);
        const response = await axios.get(`https://api.twelvedata.com/time_series`, {
            params: { symbol, interval, outputsize, apikey: TWELVE_DATA_API_KEY }
        });

        if (response.data.code) throw new Error(response.data.message);

        cache.set(cacheKey, response.data, 600); // 10 min cache
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── NEWS SCRAPER (FREE & OPEN SOURCE) ────────────────────────
app.get('/api/news', async (req, res) => {
    const cacheKey = 'market_news';
    const cachedNews = cache.get(cacheKey);
    if (cachedNews) return res.json(cachedNews);

    try {
        console.log('📰 Scraping carbon market news...');
        const response = await axios.get('https://carboncredits.com/news/', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(response.data);
        const news = [];

        $('.elementor-post').each((i, el) => {
            if (i >= 12) return; // Limit to 12 items
            const title = $(el).find('.elementor-post__title a').text().trim();
            const url = $(el).find('.elementor-post__title a').attr('href');
            let cat = 'market';
            if (title.toLowerCase().includes('science') || title.toLowerCase().includes('tech')) cat = 'science';
            if (title.toLowerCase().includes('policy') || title.toLowerCase().includes('regulat')) cat = 'policy';
            if (title.toLowerCase().includes('deal') || title.toLowerCase().includes('buy')) cat = 'deals';

            news.push({ cat, text: title, url });
        });

        cache.set(cacheKey, news, 1800); // 30 min cache
        res.json(news);
    } catch (error) {
        console.error('Scraper error:', error);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

// ─── AI MARKET SUMMARY (FREE GEMINI TIER) ────────────────────
app.post('/api/ai-summary', async (req, res) => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
        return res.json({ summary: ["AI Summary requires a Gemini API Key setup in .env", "Please provide a valid key to see analyst insight."] });
    }

    const { prices, timeframe } = req.body;

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `You are a senior carbon market analyst. Analyze this price data: ${JSON.stringify(prices)}. 
        Timeframe: ${timeframe}. 
        Provide a concise, professional 4-line terminal-style report (8 words max per line). 
        Format as a JSON array of 4 strings. Only return the JSON.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Clean markdown code blocks if AI included them
        text = text.replace(/```json|```/g, '').trim();

        const summary = JSON.parse(text);
        res.json({ summary });
    } catch (error) {
        console.error('AI error:', error);
        res.json({ summary: ["AI Analysis currently offline.", "Baseline data shows stable distribution.", "Resistance levels holding across ETF assets.", "Awaiting next batch of policy updates."] });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 AdvanceMarkets Backend running on http://localhost:${PORT}`);
    console.log(`📊 Twelve Data Cache: ACTIVE (5 min)`);
    console.log(`🤖 Gemini AI: ${GEMINI_API_KEY ? 'CONFIGURED' : 'PENDING KEY'}`);
});
