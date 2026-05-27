"""supabase_client.py — thin async wrapper around Supabase REST"""
from __future__ import annotations
import os, json
from typing import Any

import httpx
from fastapi import Header, HTTPException
import jwt as pyjwt

_SUPA_URL    = os.getenv("SUPABASE_URL","")
_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY","")
_JWT_SECRET  = os.getenv("SUPABASE_JWT_SECRET","")

class SupabaseClient:
    def __init__(self):
        self._c = httpx.AsyncClient(
            base_url=f"{_SUPA_URL}/rest/v1/",
            headers={"apikey":_SERVICE_KEY,"Authorization":f"Bearer {_SERVICE_KEY}","Content-Type":"application/json"},
            timeout=10.0,
        )

    def verify_token(self, token: str) -> str | None:
        try:
            data = pyjwt.decode(token, _JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            return data.get("sub")
        except Exception:
            return None

    async def get_progress(self, user_id: str) -> list[dict]:
        r = await self._c.get(f"resource_progress?user_id=eq.{user_id}")
        return r.json() if r.is_success else []

    async def upsert_progress(self, user_id: str, resource_id: str, completed: bool, percent: int):
        await self._c.post("resource_progress", json={
            "user_id":user_id,"resource_id":resource_id,"completed":completed,"percent":percent,
        }, headers={"Prefer":"resolution=merge-duplicates"})

    async def get_bookmarks(self, user_id: str) -> list[str]:
        r = await self._c.get(f"bookmarks?user_id=eq.{user_id}&select=resource_id")
        return [x["resource_id"] for x in (r.json() if r.is_success else [])]

    async def toggle_bookmark(self, user_id: str, resource_id: str) -> bool:
        r = await self._c.get(f"bookmarks?user_id=eq.{user_id}&resource_id=eq.{resource_id}")
        exists = r.is_success and len(r.json()) > 0
        if exists:
            await self._c.delete(f"bookmarks?user_id=eq.{user_id}&resource_id=eq.{resource_id}")
            return False
        await self._c.post("bookmarks", json={"user_id":user_id,"resource_id":resource_id})
        return True

    async def get_profile(self, user_id: str) -> dict | None:
        r = await self._c.get(f"profiles?id=eq.{user_id}")
        rows = r.json() if r.is_success else []
        return rows[0] if rows else None

    async def upsert_subscription(self, data: dict):
        customer_id = data.get("customer")
        if not customer_id: return
        r = await self._c.get(f"profiles?stripe_customer_id=eq.{customer_id}&select=id")
        rows = r.json() if r.is_success else []
        if not rows: return
        uid = rows[0]["id"]
        tier = "pro" if data.get("status") in ("active","trialing") else "free"
        await self._c.patch(f"profiles?id=eq.{uid}", json={"tier":tier})

def get_current_user(authorization: str = Header(default="")):
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization[7:]
    sb = SupabaseClient()
    uid = sb.verify_token(token)
    if not uid:
        raise HTTPException(401, "Invalid token")
    return uid

    async def upsert_quiz_result(self, user_id: str, path_id: str, score: int, passed: bool):
        self.client.table("quiz_results").upsert({
            "user_id": user_id,
            "path_id": path_id,
            "score": score,
            "passed": passed,
            "taken_at": "now()",
        }, on_conflict="user_id,path_id").execute()

