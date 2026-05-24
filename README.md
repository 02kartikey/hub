# AIhub — AI Literacy Platform

> AI literacy platform for teachers and students. CBSE / IGCSE / IB aligned.

## Stack

| Layer    | Tech                               |
|----------|------------------------------------|
| Frontend | React 18 + Vite + React Router v6  |
| Backend  | Python 3.12 + FastAPI              |
| Auth     | Supabase Auth                      |
| Database | Supabase Postgres                  |
| Content  | JSON flat files (`/data/`)         |
| Styling  | Tailwind CSS v3                    |

---

## Local setup (no Docker)

### Prerequisites
- Node.js 18+
- Python 3.12+
- A Supabase project (free tier works)

---

### Step 1 — Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → **New Query**
3. Paste the contents of `schema.sql` and run it
4. Note these values from **Settings → API**:
   - Project URL
   - `anon` (public) key
   - `service_role` (secret) key
   - JWT Secret

---

### Step 2 — Environment variables

**Backend** — create `/home/.env` (or set env vars directly):

```bash
cp .env.example .env
# then edit .env with your values
```

Required values in `.env`:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
ANTHROPIC_API_KEY=sk-ant-...        # OR OPENAI_API_KEY
ALLOWED_ORIGINS=http://localhost:5173
```

**Frontend** — create `frontend/.env.local`:

```bash
# frontend/.env.local
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

### Step 3 — Run the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend starts at: `http://localhost:8000`
Health check: `http://localhost:8000/api/health`

---

### Step 4 — Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts at: `http://localhost:5173`

Vite automatically proxies all `/api/*` requests to `http://localhost:8000`.
No CORS configuration needed for local dev.

---

### Step 5 — Verify it works

Open `http://localhost:5173` — you should see the home page load with resources.

Check the browser network tab — `/api/resources` should return 200 with JSON data.

---

## File structure

```
aihub/
│
├── .env.example              ← copy to .env, fill in values
├── schema.sql                ← run this in Supabase SQL Editor once
├── docker-compose.yml        ← for Docker deployment
│
├── backend/
│   ├── main.py               ← all FastAPI routes
│   ├── services.py           ← AIService + RateLimiter
│   ├── supabase_client.py    ← all DB operations + JWT auth
│   ├── requirements.txt
│   └── Dockerfile
│
├── data/
│   ├── resources.json        ← all learning resources
│   ├── paths.json            ← learning paths
│   └── exercises.json        ← classroom exercises
│
└── frontend/
    ├── package.json
    ├── vite.config.ts        ← proxies /api → localhost:8000 in dev
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── postcss.config.mjs
    ├── index.html
    └── src/
        ├── main.tsx          ← entry point
        ├── App.tsx           ← router + route definitions
        ├── types.ts          ← all TypeScript interfaces
        ├── api.ts            ← all backend API calls
        ├── auth.tsx          ← Supabase auth + useProgress + useBookmarks
        ├── ui.tsx            ← Button, Badge, Card, Spinner primitives
        ├── components.tsx    ← all feature components
        ├── pages.tsx         ← all page components
        └── styles.css        ← Tailwind + global styles
```

---

## Routes

| Path               | Page                        |
|--------------------|-----------------------------|
| `/`                | Home — featured resources   |
| `/browse`          | Browse all with filters     |
| `/curriculum`      | Learning paths by board     |
| `/paths/:id`       | Single learning path        |
| `/playground`      | Deep AI exercises           |
| `/playground/:id`  | Single exercise             |
| `/activities`      | Classroom activities        |
| `/activities/:id`  | Activity detail             |
| `/chat`            | AI literacy chat            |
| `/dashboard`       | User dashboard              |
| `/auth/login`      | Sign in                     |
| `/auth/signup`     | Sign up                     |

---

## API endpoints

| Method | Path                    | Auth     | Description                       |
|--------|-------------------------|----------|-----------------------------------|
| GET    | `/api/health`           | None     | Health check + content counts     |
| GET    | `/api/resources`        | None     | List resources (filterable)       |
| GET    | `/api/resources/:id`    | None     | Single resource                   |
| GET    | `/api/paths`            | None     | List learning paths               |
| GET    | `/api/paths/:id`        | None     | Path with hydrated resources      |
| GET    | `/api/exercises`        | None     | List exercises                    |
| GET    | `/api/exercises/:id`    | None     | Single exercise                   |
| POST   | `/api/chat`             | Optional | AI chat (rate limited)            |
| GET    | `/api/progress`         | Required | User's progress                   |
| POST   | `/api/progress`         | Required | Update resource progress          |
| GET    | `/api/bookmarks`        | Required | User's bookmarks                  |
| POST   | `/api/bookmarks`        | Required | Toggle bookmark                   |
| GET    | `/api/profile`          | Required | User profile                      |
| POST   | `/api/webhooks/stripe`  | Stripe   | Stripe webhook                    |

---

## Adding more content

Content lives in `data/` as plain JSON. No rebuild needed — backend reads
files at startup (or on `docker-compose restart backend`).

**resources.json** — add objects following this schema:
```json
{
  "id": "unique-id",
  "type": "video|seminar|article|book|course|guide",
  "title": "...",
  "description": "...",
  "url": "https://...",
  "youtubeId": "optional-youtube-id",
  "difficulty": "beginner|intermediate|advanced",
  "audience": "student|teacher|both",
  "topics": ["AI fundamentals"],
  "tags": ["..."],
  "isFeatured": false,
  "freeAccess": true,
  "completionCount": 0,
  "rating": 4.5,
  "boards": ["CBSE", "IGCSE"]
}
```

**paths.json** — `resourceIds` array references resource `id` values.
Backend hydrates them on `/api/paths/:id`.

---

## Docker deployment

```bash
cp .env.example .env
# edit .env

docker-compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```

---

## Adding Supabase Google Auth

1. Supabase Dashboard → Authentication → Providers → Google → Enable
2. Add OAuth credentials from Google Cloud Console
3. Set redirect URL: `https://your-domain.com/auth/callback`

---

## Rate limits

| Limit       | Value    | Backend          |
|-------------|----------|------------------|
| Burst       | 5 / 10s  | In-memory        |
| Hourly      | 20 / hr  | Supabase table   |
| Daily       | 60 / day | Supabase table   |

Limits are per user_id (logged in) or IP (anonymous).
Edit constants in `backend/services.py`.
