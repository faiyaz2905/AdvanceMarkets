"""AI analysis endpoints with bounded, structured inputs."""

import hashlib
import json
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.config import settings
from backend.core.cache import ai_summary_cache

router = APIRouter()
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

SYSTEM_PROMPT = """You are AdvanceMarkets AI, a carbon allowance market research analyst.
Be concise, factual, and clear about uncertainty. Never invent live prices or citations.
Distinguish exchange-traded securities from underlying allowances and voluntary credits.
This is research information, not investment advice."""


class AISummaryRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=12)
    timeframe: Literal["1day", "1week", "1month", "3months", "1year"]
    metrics: dict = Field(default_factory=dict)


class ChatMessage(BaseModel):
    role: Literal["user", "model"]
    parts: str = Field(max_length=4000)


class AIChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1500)
    history: list[ChatMessage] = Field(default_factory=list, max_length=12)


async def generate_text(contents: list[dict], max_tokens: int) -> str:
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": max_tokens,
        },
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{GEMINI_BASE}/models/{settings.GEMINI_MODEL}:generateContent",
            params={"key": settings.GEMINI_API_KEY},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise ValueError("AI provider returned no candidate")
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts).strip()
    if not text:
        raise ValueError("AI provider returned no text")
    return text


@router.post("/ai-summary")
async def ai_summary(req: AISummaryRequest):
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="AI analysis is temporarily unavailable")

    safe_metrics = {
        key: value
        for key, value in req.metrics.items()
        if key in {"start", "end", "return_pct", "high", "low", "average", "volatility_pct", "volume"}
    }
    cache_key = hashlib.sha256(
        json.dumps([req.symbol, req.timeframe, safe_metrics], sort_keys=True).encode()
    ).hexdigest()
    if cache_key in ai_summary_cache:
        return {"summary": ai_summary_cache[cache_key], "cached": True}

    prompt = f"""Analyze these computed historical metrics for {req.symbol} over {req.timeframe}:
{json.dumps(safe_metrics)}
Return a JSON array of exactly four short strings. Mention the measured return, range,
volatility, and one cautious interpretation. Do not add facts not present in the metrics."""
    try:
        result = await generate_text([{"role": "user", "parts": [{"text": prompt}]}], 320)
        cleaned = result.replace("```json", "").replace("```", "").strip()
        summary = json.loads(cleaned)
        if not isinstance(summary, list) or len(summary) != 4 or not all(isinstance(line, str) for line in summary):
            raise ValueError("Unexpected model response")
        summary = [line[:180] for line in summary]
        ai_summary_cache[cache_key] = summary
        return {"summary": summary, "cached": False}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="AI analysis is temporarily unavailable") from exc


@router.post("/ai-chat")
async def ai_chat(req: AIChatRequest):
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="AI research is temporarily unavailable")
    contents = [
        {"role": message.role, "parts": [{"text": message.parts}]}
        for message in req.history[-12:]
    ]
    contents.append({"role": "user", "parts": [{"text": req.message}]})
    try:
        reply = await generate_text(contents, 1200)
        return {"reply": reply[:8000], "model": settings.GEMINI_MODEL}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="AI research is temporarily unavailable") from exc
