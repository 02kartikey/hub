"""
supabase_client.py — zero extra dependencies.
Uses httpx (already in requirements.txt) for all Supabase REST/PostgREST calls.
No 'supabase' pip package needed.
"""
from __future__ import annotations
import os
from types import SimpleNamespace
from typing import Any

import httpx
from fastapi import Header, HTTPException
from jose import jwt as jose_jwt
from jose.exceptions import JWTError

_SUPA_URL    = os.getenv("SUPABASE_URL", "")
_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# ── JWKS — fetched once at startup, cached for the process lifetime ───────────
# Supabase uses ES256 (ECC P-256) asymmetric signing.
# We verify tokens using the public key from the JWKS endpoint —
# no SUPABASE_JWT_SECRET env var needed.
_jwks: dict | None = None

def _get_jwks() -> dict:
    global _jwks
    if _jwks is not None:
        return _jwks
    url = f"{_SUPA_URL}/auth/v1/.well-known/jwks.json"
    r = httpx.get(url, timeout=5)
    r.raise_for_status()
    _jwks = r.json()
    return _jwks

_REST = f"{_SUPA_URL}/rest/v1"
_SVC_HEADERS = {
    "apikey":        _SERVICE_KEY,
    "Authorization": f"Bearer {_SERVICE_KEY}",
    "Content-Type":  "application/json",
}


# ── Minimal synchronous PostgREST builder ─────────────────────────────────────
# Mirrors the supabase-py   table("x").select("*").eq("col",val).execute()  API
# so main.py needs zero changes.

class _Table:
    """Lazy query builder — nothing hits the network until .execute() is called."""

    def __init__(self, table: str):
        self._url      = f"{_REST}/{table}"
        self._h        = dict(_SVC_HEADERS)
        self._filters: dict[str, str] = {}
        self._cols     = "*"
        self._order: str | None = None
        self._lim:   int | None = None
        self._op     = "select"        # select | insert | upsert | delete
        self._body:  dict | None = None
        self._conflict = "id"

    # ── builder helpers (each returns a fresh copy so chains don't mutate) ────

    def _copy(self) -> "_Table":
        c = _Table.__new__(_Table)
        c._url, c._h    = self._url, self._h
        c._filters      = dict(self._filters)
        c._cols         = self._cols
        c._order        = self._order
        c._lim          = self._lim
        c._op           = self._op
        c._body         = self._body
        c._conflict     = self._conflict
        return c

    def select(self, cols: str = "*"):
        c = self._copy(); c._op = "select"; c._cols = cols; return c

    def eq(self, col: str, val: Any):
        c = self._copy(); c._filters[col] = f"eq.{val}"; return c

    def limit(self, n: int):
        c = self._copy(); c._lim = n; return c

    def order(self, col: str, desc: bool = False):
        c = self._copy(); c._order = f"{col}.{'desc' if desc else 'asc'}"; return c

    def insert(self, row: dict):
        c = self._copy(); c._op = "insert"; c._body = row; return c

    def upsert(self, row: dict, on_conflict: str = "id"):
        c = self._copy(); c._op = "upsert"; c._body = row; c._conflict = on_conflict; return c

    def delete(self):
        c = self._copy(); c._op = "delete"; return c

    # ── execute ───────────────────────────────────────────────────────────────

    def execute(self) -> SimpleNamespace:
        params: dict[str, str] = {**self._filters}
        if self._order: params["order"] = self._order
        if self._lim:   params["limit"] = str(self._lim)

        if self._op == "select":
            params["select"] = self._cols
            r = httpx.get(self._url, headers=self._h, params=params, timeout=10)

        elif self._op == "insert":
            h = {**self._h, "Prefer": "return=representation"}
            r = httpx.post(self._url, headers=h, json=self._body, params=params, timeout=10)

        elif self._op == "upsert":
            h = {**self._h, "Prefer": "resolution=merge-duplicates,return=representation"}
            params["on_conflict"] = self._conflict
            r = httpx.post(self._url, headers=h, json=self._body, params=params, timeout=10)

        elif self._op == "delete":
            h = {**self._h, "Prefer": "return=representation"}
            r = httpx.delete(self._url, headers=h, params=params, timeout=10)

        else:
            raise ValueError(f"Unknown op: {self._op}")

        raw  = r.json() if r.content else []
        data = raw if isinstance(raw, list) else ([raw] if isinstance(raw, dict) else [])
        return SimpleNamespace(data=data, error=None if r.is_success else raw)


class _SyncClient:
    """Drop-in replacement for supabase-py's sync Client for server-side DB ops."""

    def table(self, name: str) -> _Table:
        return _Table(name)


# ── Main SupabaseClient ────────────────────────────────────────────────────────

class SupabaseClient:
    def __init__(self):
        # .client mimics supabase-py: sb.client.table("x").select("*").execute()
        self.client = _SyncClient()

        # Async httpx client for legacy async helpers (progress, bookmarks, etc.)
        self._c = httpx.AsyncClient(
            base_url=f"{_SUPA_URL}/rest/v1/",
            headers=_SVC_HEADERS,
            timeout=10.0,
        )

    def verify_token(self, token: str) -> str | None:
        try:
            jwks      = _get_jwks()
            # Match the key by kid from the token header
            headers   = jose_jwt.get_unverified_header(token)
            kid       = headers.get("kid")
            key       = next(
                (k for k in jwks.get("keys", []) if k.get("kid") == kid),
                jwks.get("keys", [None])[0],   # fallback to first key
            )
            if key is None:
                return None
            payload = jose_jwt.decode(
                token, key,
                algorithms=["ES256", "RS256"],  # ES256 for P-256, RS256 as fallback
                audience="authenticated",
                options={"verify_exp": True},
            )
            return payload.get("sub")
        except (JWTError, Exception):
            return None

    # ── Async helpers used by non-classroom routes ─────────────────────────────

    async def get_progress(self, user_id: str) -> list[dict]:
        r = await self._c.get(f"resource_progress?user_id=eq.{user_id}")
        return r.json() if r.is_success else []

    async def upsert_progress(self, user_id: str, resource_id: str,
                               completed: bool, percent: int):
        await self._c.post("resource_progress", json={
            "user_id": user_id, "resource_id": resource_id,
            "completed": completed, "percent": percent,
        }, headers={"Prefer": "resolution=merge-duplicates"})

    async def get_bookmarks(self, user_id: str) -> list[str]:
        r = await self._c.get(
            f"bookmarks?user_id=eq.{user_id}&select=resource_id")
        return [x["resource_id"] for x in (r.json() if r.is_success else [])]

    async def toggle_bookmark(self, user_id: str, resource_id: str) -> bool:
        r = await self._c.get(
            f"bookmarks?user_id=eq.{user_id}&resource_id=eq.{resource_id}")
        exists = r.is_success and len(r.json()) > 0
        if exists:
            await self._c.delete(
                f"bookmarks?user_id=eq.{user_id}&resource_id=eq.{resource_id}")
            return False
        await self._c.post("bookmarks",
                           json={"user_id": user_id, "resource_id": resource_id})
        return True

    async def get_profile(self, user_id: str) -> dict | None:
        r = await self._c.get(f"profiles?id=eq.{user_id}")
        rows = r.json() if r.is_success else []
        return rows[0] if rows else None

    async def upsert_subscription(self, data: dict):
        customer_id = data.get("customer")
        if not customer_id:
            return
        r = await self._c.get(
            f"profiles?stripe_customer_id=eq.{customer_id}&select=id")
        rows = r.json() if r.is_success else []
        if not rows:
            return
        uid = rows[0]["id"]
        tier = "pro" if data.get("status") in ("active", "trialing") else "free"
        await self._c.patch(f"profiles?id=eq.{uid}", json={"tier": tier})

    def upsert_quiz_result(self, user_id: str, path_id: str,
                            score: int, passed: bool):
        self.client.table("quiz_results").upsert({
            "user_id": user_id, "path_id": path_id,
            "score": score, "passed": passed,
        }, on_conflict="user_id,path_id").execute()


# ── FastAPI auth dependency ────────────────────────────────────────────────────

def get_current_user(authorization: str = Header(default="")) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization[7:]
    uid = SupabaseClient().verify_token(token)
    if not uid:
        raise HTTPException(401, "Invalid token")
    return uid
