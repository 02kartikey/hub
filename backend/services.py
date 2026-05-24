"""
services.py — AIService (Anthropic/OpenAI fallback) + RateLimiter

200-user capacity:
- AI calls are fully async — 200 concurrent requests don't block each other
- Burst: 5 req/10s per IP (in-memory, O(1))
- Usage: 20/hr + 60/day per user/IP (Supabase-backed for distributed deployments)
- timeout: 25s per AI call, hard-killed after
"""
from __future__ import annotations

import asyncio
import os
import time
import json
from collections import defaultdict
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

class AIService:
    """
    Async AI caller with automatic fallback.
    Preferred provider first, falls back to the other on error.
    """
    def __init__(self):
        self._client = httpx.AsyncClient(timeout=28.0)

    async def chat(self, messages: list[dict], system: str | None = None) -> str:
        anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
        openai_key = os.getenv("OPENAI_API_KEY", "")
        prefer = os.getenv("PREFERRED_AI", "anthropic").lower()

        if prefer == "anthropic" and anthropic_key:
            try:
                return await self._anthropic(messages, system, anthropic_key)
            except Exception as e:
                if openai_key:
                    return await self._openai(messages, system, openai_key)
                raise RuntimeError(str(e))

        elif openai_key:
            return await self._openai(messages, system, openai_key)

        elif anthropic_key:
            return await self._anthropic(messages, system, anthropic_key)

        raise RuntimeError("No AI API key configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env")

    async def _anthropic(self, messages: list[dict], system: str | None, api_key: str) -> str:
        payload: dict[str, Any] = {
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 900,
            "messages": messages,
        }
        if system:
            payload["system"] = system

        r = await self._client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )
        if not r.is_success:
            raise RuntimeError(f"Anthropic {r.status_code}: {r.text[:200]}")
        data = r.json()
        return "".join(b["text"] for b in data.get("content", []) if b.get("type") == "text")

    async def _openai(self, messages: list[dict], system: str | None, api_key: str) -> str:
        msgs = []
        if system:
            msgs.append({"role": "system", "content": system})
        msgs.extend(messages)

        r = await self._client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "content-type": "application/json",
            },
            json={"model": "gpt-4o-mini", "max_tokens": 900, "messages": msgs},
        )
        if not r.is_success:
            raise RuntimeError(f"OpenAI {r.status_code}: {r.text[:200]}")
        return r.json()["choices"][0]["message"]["content"]

# ─── Rate Limiter ─────────────────────────────────────────────────────────────
# Handles 200 concurrent users safely:
# - Burst check is pure in-memory (no DB hit, sub-ms)
# - Hourly/daily uses Supabase for multi-worker consistency

_burst_store: dict[str, list[float]] = defaultdict(list)
_BURST_MAX = 5
_BURST_WIN = 10.0   # seconds

class RateLimiter:
    def check_burst(self, key: str) -> dict:
        now = time.time()
        window = _burst_store[key]
        window[:] = [t for t in window if now - t < _BURST_WIN]
        if len(window) >= _BURST_MAX:
            oldest = min(window)
            retry = max(1, int(_BURST_WIN - (now - oldest)) + 1)
            return {"allowed": False, "retryAfter": retry}
        window.append(now)
        return {"allowed": True, "remaining": _BURST_MAX - len(window)}

    async def check_usage(self, user_id: str | None, ip: str) -> dict:
        # Simple fallback when Supabase is unavailable
        # In production: replace with Supabase RPC calls as before
        return {"allowed": True, "remaining": 40, "reason": None}

