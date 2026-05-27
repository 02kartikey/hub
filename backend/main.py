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

# ── Classroom ───────────────────────────────────────────────────────────────────
import uuid as _uuid
import random, string

def _gen_code() -> str:
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join(random.choices(chars, k=6))

@app.get("/api/classroom")
async def get_classroom(req: Request, user_id: str = Depends(get_current_user)):
    """Get or create the teacher's classroom + list of students with progress."""
    # Fetch or create classroom
    res = sb.client.table("classrooms").select("*").eq("teacher_id", user_id).limit(1).execute()
    classroom = res.data[0] if res.data else None

    if not classroom:
        code = _gen_code()
        # Retry on code collision
        for _ in range(5):
            ins = sb.client.table("classrooms").insert({
                "id": str(_uuid.uuid4()),
                "teacher_id": user_id,
                "code": code,
                "name": "My Classroom",
            }).execute()
            if ins.data:
                classroom = ins.data[0]
                break
            code = _gen_code()

    if not classroom:
        raise HTTPException(500, "Could not create classroom")

    # Members
    members_res = sb.client.table("classroom_members") \
        .select("student_id, joined_at") \
        .eq("classroom_id", classroom["id"]).execute()
    members = members_res.data or []

    students = []
    for m in members:
        sid = m["student_id"]
        # Profile
        prof_res = sb.client.table("profiles").select("full_name, email").eq("id", sid).limit(1).execute()
        prof = prof_res.data[0] if prof_res.data else {}
        # Resource progress
        prog_res = sb.client.table("resource_progress").select("completed").eq("user_id", sid).execute()
        prog = prog_res.data or []
        done = sum(1 for p in prog if p.get("completed"))
        # Quiz scores
        quiz_res = sb.client.table("quiz_results").select("score").eq("user_id", sid).execute()
        quizzes = quiz_res.data or []
        avg_quiz = round(sum(q["score"] for q in quizzes) / len(quizzes)) if quizzes else None

        students.append({
            "id": sid,
            "name": prof.get("full_name") or "Student",
            "email": prof.get("email") or "",
            "joinedAt": m["joined_at"],
            "started": len(prog),
            "completed": done,
            "rate": round((done / len(prog)) * 100) if prog else 0,
            "streak": 0,
            "quizScore": avg_quiz,
            "pathProgress": {},
        })

    return {"classroom": classroom, "students": students}

class AssignmentCreate(BaseModel):
    content_type: str   # resource | exercise | path | activity
    content_id: str
    title: str
    note: str | None = None
    due_date: str | None = None

@app.get("/api/classroom/assignments")
async def list_assignments(req: Request, user_id: str = Depends(get_current_user)):
    cls_res = sb.client.table("classrooms").select("id").eq("teacher_id", user_id).limit(1).execute()
    if not cls_res.data:
        return {"data": []}
    classroom_id = cls_res.data[0]["id"]

    # Count students for completion percentage
    members_res = sb.client.table("classroom_members").select("student_id").eq("classroom_id", classroom_id).execute()
    total_students = len(members_res.data or [])

    asgn_res = sb.client.table("assignments").select("*").eq("classroom_id", classroom_id).order("created_at", desc=True).execute()
    assignments = asgn_res.data or []

    # Add completedCount to each
    result = []
    for a in assignments:
        comp_res = sb.client.table("assignment_completions").select("id").eq("assignment_id", a["id"]).execute()
        result.append({**a, "completedCount": len(comp_res.data or []), "totalStudents": total_students})

    return {"data": result}

@app.post("/api/classroom/assignments")
async def create_assignment(body: AssignmentCreate, req: Request, user_id: str = Depends(get_current_user)):
    cls_res = sb.client.table("classrooms").select("id").eq("teacher_id", user_id).limit(1).execute()
    if not cls_res.data:
        raise HTTPException(404, "No classroom found for this teacher")
    classroom_id = cls_res.data[0]["id"]

    ins = sb.client.table("assignments").insert({
        "id": str(_uuid.uuid4()),
        "classroom_id": classroom_id,
        "teacher_id": user_id,
        "content_type": body.content_type,
        "content_id": body.content_id,
        "title": body.title,
        "note": body.note,
        "due_date": body.due_date,
    }).execute()

    if not ins.data:
        raise HTTPException(500, "Failed to create assignment")

    return {"assignment": ins.data[0]}

@app.delete("/api/classroom/assignments/{assignment_id}")
async def delete_assignment(assignment_id: str, user_id: str = Depends(get_current_user)):
    # Verify ownership
    asgn_res = sb.client.table("assignments").select("teacher_id").eq("id", assignment_id).limit(1).execute()
    if not asgn_res.data or asgn_res.data[0]["teacher_id"] != user_id:
        raise HTTPException(403, "Not your assignment")
    sb.client.table("assignments").delete().eq("id", assignment_id).execute()
    return {"ok": True}

# ── Student-facing: my assignments ─────────────────────────────────────────────
@app.get("/api/classroom/my-assignments")
async def my_assignments(req: Request, user_id: str = Depends(get_current_user)):
    # Find classrooms this student belongs to
    mem_res = sb.client.table("classroom_members").select("classroom_id").eq("student_id", user_id).execute()
    classroom_ids = [m["classroom_id"] for m in (mem_res.data or [])]
    if not classroom_ids:
        return {"data": []}

    all_assignments = []
    for cid in classroom_ids:
        asgn_res = sb.client.table("assignments").select("*").eq("classroom_id", cid).execute()
        for a in (asgn_res.data or []):
            comp_res = sb.client.table("assignment_completions") \
                .select("id").eq("assignment_id", a["id"]).eq("student_id", user_id).execute()
            all_assignments.append({**a, "completed": bool(comp_res.data)})

    return {"data": all_assignments}

@app.post("/api/classroom/assignments/{assignment_id}/complete")
async def complete_assignment(assignment_id: str, user_id: str = Depends(get_current_user)):
    sb.client.table("assignment_completions").upsert({
        "id": str(_uuid.uuid4()),
        "assignment_id": assignment_id,
        "student_id": user_id,
    }, on_conflict="assignment_id,student_id").execute()
    return {"ok": True}

# ── Classroom join (student joins with code) ────────────────────────────────────
class JoinRequest(BaseModel):
    code: str

@app.post("/api/classroom/join")
async def join_classroom(body: JoinRequest, user_id: str = Depends(get_current_user)):
    cls_res = sb.client.table("classrooms").select("*").eq("code", body.code.upper()).limit(1).execute()
    if not cls_res.data:
        raise HTTPException(404, f"No classroom found with code '{body.code.upper()}'")
    classroom = cls_res.data[0]

    # Check not already a member
    mem_res = sb.client.table("classroom_members") \
        .select("id").eq("classroom_id", classroom["id"]).eq("student_id", user_id).limit(1).execute()
    if mem_res.data:
        return {"ok": True, "classroom": classroom, "alreadyJoined": True}

    sb.client.table("classroom_members").insert({
        "id": str(_uuid.uuid4()),
        "classroom_id": classroom["id"],
        "student_id": user_id,
    }).execute()

    return {"ok": True, "classroom": classroom, "alreadyJoined": False}
