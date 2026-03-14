"""
AdvanceMarkets Terminal — AI Router
Handles AI market summaries and research chat using Gemini
"""
import json
from fastapi import APIRouter
from pydantic import BaseModel
import google.generativeai as genai

from backend.config import settings

router = APIRouter()

# Configure Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

SYSTEM_PROMPT = """You are AdvanceMarkets AI — a senior sustainability and carbon markets
research analyst. You have deep expertise in:

- Carbon credit markets (compliance: EU ETS, RGGI, CCA, UK ETS | voluntary: Verra, Gold Standard, ACR)
- Carbon pricing mechanisms and market dynamics
- Nature-based solutions (REDD+, afforestation, blue carbon, regenerative agriculture)
- Engineered carbon removal (DAC, biochar, enhanced weathering, BECCS)
- Carbon offsets, insets, and corporate climate strategies
- Climate policy (Paris Agreement, Article 6, CBAM, CORSIA, NDCs)
- ESG frameworks and sustainability reporting (CSRD, TCFD, SBTi)
- Biodiversity credits and ecosystem services

Provide concise, data-driven, professional analysis.
Cite sources when possible. Use markdown formatting."""


# ─── Request/Response Models ─────────────────────────────────

class AISummaryRequest(BaseModel):
    prices: dict
    timeframe: str = "1d"


class AIChatRequest(BaseModel):
    message: str
    history: list = []


# ─── AI Summary Endpoint (existing feature) ──────────────────

@router.post("/ai-summary")
async def ai_summary(req: AISummaryRequest):
    """Generate AI market summary from price data"""
    if not settings.GEMINI_API_KEY:
        return {"summary": [
            "AI Summary requires a Gemini API Key setup in .env",
            "Please provide a valid key to see analyst insight."
        ]}

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")

        prompt = f"""You are a senior carbon market analyst. Analyze this price data: {json.dumps(req.prices)}.
        Timeframe: {req.timeframe}.
        Provide a concise, professional 4-line terminal-style report (8 words max per line).
        Format as a JSON array of 4 strings. Only return the JSON."""

        result = model.generate_content(prompt)
        text = result.text

        # Clean markdown code blocks if AI included them
        text = text.replace("```json", "").replace("```", "").strip()

        summary = json.loads(text)
        return {"summary": summary}

    except Exception as e:
        print(f"[ERROR] AI Summary error: {e}")
        return {"summary": [
            "AI Analysis currently offline.",
            "Baseline data shows stable distribution.",
            "Resistance levels holding across ETF assets.",
            "Awaiting next batch of policy updates."
        ]}


# ─── AI Chat Endpoint (NEW for v3.0) ─────────────────────────

@router.post("/ai-chat")
async def ai_chat(req: AIChatRequest):
    """Interactive AI research chat for sustainability topics"""
    if not settings.GEMINI_API_KEY:
        return {
            "reply": "AI Chat requires a Gemini API Key. Please configure GEMINI_API_KEY in your .env file.",
            "model": "none"
        }

    try:
        model = genai.GenerativeModel(
            "gemini-2.0-flash",
            system_instruction=SYSTEM_PROMPT
        )

        # Convert history to Gemini format
        gemini_history = []
        for msg in req.history:
            gemini_history.append({
                "role": msg.get("role", "user"),
                "parts": [msg.get("parts", msg.get("content", ""))]
            })

        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(req.message)

        return {
            "reply": response.text,
            "model": "gemini-2.0-flash"
        }

    except Exception as e:
        print(f"[ERROR] AI Chat error: {e}")
        return {
            "reply": f"I'm having trouble connecting to the AI service right now. Error: {str(e)}",
            "model": "error"
        }
