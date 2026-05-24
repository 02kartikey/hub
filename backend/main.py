"""
main.py — AIHub FastAPI backend
All routes. Single file until the team grows past 3 engineers.
"""
from __future__ import annotations
import json, os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import stripe
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services import AIService, RateLimiter
from supabase_client import SupabaseClient, get_current_user

load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

DATA = Path(__file__).parent.parent / "data"
_c: dict[str, Any] = {}

def _load():
    for name in ("resources","paths","activities","deep-exercises","tools","quizzes"):
        fp = DATA / f"{name}.json"
        if fp.exists():
            with open(fp, encoding="utf-8") as f:
                _c[name] = json.load(f)
    print(f"[content] {len(_c.get('resources',[]))} resources | {len(_c.get('paths',[]))} paths | "
          f"{len(_c.get('activities',[]))} activities | {len(_c.get('deep-exercises',[]))} exercises")

@asynccontextmanager
async def lifespan(app: FastAPI):
    _load(); yield

app = FastAPI(title="AIHub API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS","http://localhost:5173").split(","),
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

ai      = AIService()
limiter = RateLimiter()
sb      = SupabaseClient()

def _ip(req: Request) -> str:
    return req.headers.get("x-forwarded-for","127.0.0.1").split(",")[0].strip()

def _uid(req: Request) -> str | None:
    auth = req.headers.get("authorization","")
    return sb.verify_token(auth[7:]) if auth.startswith("Bearer ") else None

# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status":"ok", "resources":len(_c.get("resources",[])),
            "paths":len(_c.get("paths",[])), "activities":len(_c.get("activities",[])),
            "exercises":len(_c.get("deep-exercises",[]))}

# ── Resources ──────────────────────────────────────────────────────────────────
@app.get("/api/resources")
async def list_resources(type:str|None=None, difficulty:str|None=None,
    audience:str|None=None, board:str|None=None, topic:str|None=None,
    language:str|None=None, search:str|None=None, featured:bool|None=None,
    freeOnly:bool|None=None, limit:int=100, offset:int=0):
    items = list(_c.get("resources",[]))
    if type:       items = [r for r in items if r.get("type")==type]
    if difficulty: items = [r for r in items if r.get("difficulty")==difficulty]
    if audience:   items = [r for r in items if r.get("audience") in (audience,"both")]
    if board:      items = [r for r in items if board in r.get("boards",[]) or "All" in r.get("boards",[])]
    if topic:      items = [r for r in items if topic in r.get("topics",[])]
    if language:   items = [r for r in items if r.get("language","English")==language]
    if featured:   items = [r for r in items if r.get("isFeatured")]
    if freeOnly:   items = [r for r in items if r.get("freeAccess")]
    if search:
        q = search.lower()
        items = [r for r in items if q in r.get("title","").lower()
                 or q in r.get("description","").lower()
                 or any(q in t.lower() for t in r.get("tags",[]))
                 or any(q in t.lower() for t in r.get("topics",[]))]
    return {"data":items[offset:offset+limit],"total":len(items)}

@app.get("/api/resources/{rid}")
async def get_resource(rid:str):
    r = next((r for r in _c.get("resources",[]) if r["id"]==rid), None)
    if not r: raise HTTPException(404,f"Resource '{rid}' not found")
    return r

# ── Paths ──────────────────────────────────────────────────────────────────────
@app.get("/api/paths")
async def list_paths(board:str|None=None, audience:str|None=None):
    items = list(_c.get("paths",[]))
    if board:    items = [p for p in items if not p.get("board") or p.get("board")==board]
    if audience: items = [p for p in items if p.get("audience") in (audience,"both")]
    return {"data":items,"total":len(items)}

@app.get("/api/paths/{pid}")
async def get_path(pid:str):
    p = next((p for p in _c.get("paths",[]) if p["id"]==pid), None)
    if not p: raise HTTPException(404,f"Path '{pid}' not found")
    res_map = {r["id"]:r for r in _c.get("resources",[])}
    return {**p, "resources":[res_map[rid] for rid in p.get("resourceIds",[]) if rid in res_map]}

# ── Classroom Activities ────────────────────────────────────────────────────────
@app.get("/api/activities")
async def list_activities(type:str|None=None, age_group:str|None=None):
    items = list(_c.get("activities",[]))
    if type:      items = [a for a in items if a.get("type")==type]
    if age_group: items = [a for a in items if age_group in a.get("ageGroups",[])]
    return {"data":items,"total":len(items)}

@app.get("/api/activities/{aid}")
async def get_activity(aid:str):
    a = next((a for a in _c.get("activities",[]) if a["id"]==aid), None)
    if not a: raise HTTPException(404,f"Activity '{aid}' not found")
    return a

# ── Deep Exercises (Playground) ────────────────────────────────────────────────
@app.get("/api/exercises")
async def list_exercises(difficulty:str|None=None):
    items = list(_c.get("deep-exercises",[]))
    if difficulty: items = [e for e in items if e.get("difficulty")==difficulty]
    return {"data":items,"total":len(items)}

@app.get("/api/exercises/{eid}")
async def get_exercise(eid:str):
    e = next((e for e in _c.get("deep-exercises",[]) if e["id"]==eid), None)
    if not e: raise HTTPException(404,f"Exercise '{eid}' not found")
    return e

# ── Tools & Walkthroughs ────────────────────────────────────────────────────────
@app.get("/api/tools")
async def list_tools():
    tools_data = _c.get("tools",{})
    tools = tools_data.get("tools",[]) if isinstance(tools_data,dict) else []
    return {"data":tools,"total":len(tools)}

@app.get("/api/tools/{tool_id}")
async def get_tool(tool_id:str):
    tools_data = _c.get("tools",{})
    tools = tools_data.get("tools",[]) if isinstance(tools_data,dict) else []
    walkthroughs = tools_data.get("walkthroughs",[]) if isinstance(tools_data,dict) else []
    t = next((t for t in tools if t["id"]==tool_id), None)
    if not t: raise HTTPException(404,f"Tool '{tool_id}' not found")
    wt = [w for w in walkthroughs if w.get("toolId")==tool_id]
    return {**t,"walkthroughs":wt}

@app.get("/api/walkthroughs/{wid}")
async def get_walkthrough(wid:str):
    tools_data = _c.get("tools",{})
    walkthroughs = tools_data.get("walkthroughs",[]) if isinstance(tools_data,dict) else []
    w = next((w for w in walkthroughs if w["id"]==wid), None)
    if not w: raise HTTPException(404,f"Walkthrough '{wid}' not found")
    return w

# ── AI Chat ────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    messages: list[dict]
    systemPrompt: str | None = None

@app.post("/api/chat")
async def chat(req: Request, body: ChatRequest):
    if not body.messages: raise HTTPException(400,"messages must be a non-empty list")
    ip = _ip(req)
    burst = limiter.check_burst(ip)
    if not burst["allowed"]:
        raise HTTPException(429,f"Too many requests. Wait {burst['retryAfter']}s.",
                            headers={"Retry-After":str(burst["retryAfter"])})
    usage = await limiter.check_usage(_uid(req), ip)
    if not usage["allowed"]: raise HTTPException(429,usage.get("reason","Rate limit exceeded"))
    try:
        text = await ai.chat(body.messages, body.systemPrompt or
                             "You are a helpful AI literacy assistant.")
    except RuntimeError as e:
        raise HTTPException(500,str(e))
    except Exception as e:
        msg = str(e)
        raise HTTPException(504 if "timeout" in msg.lower() else 500,
                            "Request timed out. Try again." if "timeout" in msg.lower() else msg)
    return JSONResponse({"text":text},
                        headers={"X-RateLimit-Remaining":str(usage.get("remaining",0))})

# ── Progress ───────────────────────────────────────────────────────────────────
class ProgressUpdate(BaseModel):
    resource_id:str; completed:bool; percent:int=0

@app.get("/api/progress")
async def get_progress(user_id:str=Depends(get_current_user)):
    return {"data":await sb.get_progress(user_id)}

@app.post("/api/progress")
async def update_progress(body:ProgressUpdate, user_id:str=Depends(get_current_user)):
    await sb.upsert_progress(user_id,body.resource_id,body.completed,body.percent)
    return {"ok":True}

# ── Bookmarks ──────────────────────────────────────────────────────────────────
class BookmarkRequest(BaseModel):
    resource_id:str

@app.get("/api/bookmarks")
async def get_bookmarks(user_id:str=Depends(get_current_user)):
    return {"data":await sb.get_bookmarks(user_id)}

@app.post("/api/bookmarks")
async def toggle_bookmark(body:BookmarkRequest, user_id:str=Depends(get_current_user)):
    return {"bookmarked":await sb.toggle_bookmark(user_id,body.resource_id)}

# ── Profile ────────────────────────────────────────────────────────────────────
@app.get("/api/profile")
async def get_profile(user_id:str=Depends(get_current_user)):
    p = await sb.get_profile(user_id)
    if not p: raise HTTPException(404,"Profile not found")
    return p

# ── Stripe ─────────────────────────────────────────────────────────────────────
@app.post("/api/webhooks/stripe")
async def stripe_webhook(req:Request):
    payload = await req.body()
    sig = req.headers.get("stripe-signature","")
    secret = os.getenv("STRIPE_WEBHOOK_SECRET","")
    if not secret: raise HTTPException(500,"Stripe webhook secret not configured")
    try:
        event = stripe.Webhook.construct_event(payload,sig,secret)
    except stripe.SignatureVerificationError:
        raise HTTPException(400,"Invalid Stripe signature")
    etype = event["type"]
    data = event["data"]["object"]
    if etype in ("customer.subscription.updated","customer.subscription.created"):
        await sb.upsert_subscription(data)
    elif etype == "customer.subscription.deleted":
        await sb.upsert_subscription({**data,"status":"canceled"})
    return {"received":True}

# ── Quizzes ────────────────────────────────────────────────────────────────────
@app.get("/api/quizzes")
async def list_quizzes():
    quizzes_data = _c.get("quizzes", [])

    safe_quizzes = []

    for quiz in quizzes_data:
        safe_questions = [
            {
                k: v
                for k, v in q.items()
                if k != "answer" and k != "explanation"
            }
            for q in quiz.get("questions", [])
        ]

        safe_quizzes.append({
            **quiz,
            "questions": safe_questions
        })

    return {
        "data": safe_quizzes,
        "total": len(safe_quizzes)
    }

@app.get("/api/quizzes/{path_id}")
async def get_quiz(path_id: str):
    quizzes_data = _c.get("quizzes", [])
    q = next((q for q in quizzes_data if q.get("pathId") == path_id), None)
    if not q: raise HTTPException(404, f"No quiz for path '{path_id}'")
    # Don't expose answers in the list
    safe = {**q, "questions": [{k:v for k,v in qn.items() if k != "answer" and k != "explanation"} for qn in q["questions"]]}
    return safe

class QuizSubmission(BaseModel):
    pathId: str
    answers: dict  # question_id -> answer
    score: float

@app.post("/api/quizzes/submit")
async def submit_quiz(body: QuizSubmission, req: Request):
    quizzes_data = _c.get("quizzes", [])
    q = next((q for q in quizzes_data if q.get("pathId") == body.pathId), None)
    if not q: raise HTTPException(404, "Quiz not found")
    # Grade server-side
    correct = 0
    results = []
    for question in q["questions"]:
        user_ans = body.answers.get(question["id"], "")
        is_correct = user_ans.strip().lower() == question["answer"].strip().lower()
        if is_correct: correct += 1
        results.append({"id": question["id"], "correct": is_correct,
                        "answer": question["answer"], "explanation": question["explanation"]})
    score = round((correct / len(q["questions"])) * 100)
    passed = score >= q["passingScore"]
    # Save to progress if logged in
    uid = _uid(req)
    if uid:
        try:
            await sb.upsert_quiz_result(uid, body.pathId, score, passed)
        except Exception:
            pass  # Don't fail submission if DB write fails
    return {"ok": True, "passed": passed, "score": score, "results": results,
            "passingScore": q["passingScore"], "total": len(q["questions"]), "correct": correct}
