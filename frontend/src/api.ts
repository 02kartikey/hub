/**
 * api.ts — single source of truth for all backend calls
 */
import type {
  Resource, LearningPath, ClassroomActivity, DeepExercise,
  ToolGuide, Walkthrough, ResourceProgress, Profile,
  Message, ListResponse,
} from './types'

// ── Classroom / assignment types ──────────────────────────────────────────────
export interface Classroom {
  id: string; teacher_id: string; code: string; name: string; created_at: string
}
export interface StudentRow {
  id: string; name: string; email: string; joinedAt: string
  started: number; completed: number; rate: number
  streak: number; quizScore: number | null
  pathProgress: Record<string, number>
}
export interface Assignment {
  id: string; classroom_id: string; teacher_id: string
  content_type: 'resource' | 'exercise' | 'path' | 'activity'
  content_id: string; title: string; note?: string
  due_date?: string; created_at: string
  completedCount?: number; totalStudents?: number
}

// ── Base URL — reads from env in production, empty string in local dev ────────
const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

let _token: string | null = null

function classroomApi() {
  return {
    // ── Classroom ──────────────────────────────────────────────────────────
    get: () => apiFetch<{ classroom: Classroom | null; students: StudentRow[] }>('/api/classroom'),

    // ── Assignments ────────────────────────────────────────────────────────
    createAssignment: (body: {
      content_type: Assignment['content_type']
      content_id: string; title: string; note?: string; due_date?: string
    }) => apiFetch<{ assignment: Assignment }>('/api/classroom/assignments', {
      method: 'POST', body: JSON.stringify(body),
    }),

    getAssignments: () => apiFetch<{ data: Assignment[] }>('/api/classroom/assignments'),

    deleteAssignment: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/classroom/assignments/${id}`, { method: 'DELETE' }),

    // ── Student actions (students mark their own completion) ───────────────
    markComplete: (assignmentId: string) =>
      apiFetch<{ ok: boolean }>(`/api/classroom/assignments/${assignmentId}/complete`, {
        method: 'POST',
      }),

    // ── Student-facing: get assignments for their classroom ────────────────
    getMyAssignments: () => apiFetch<{ data: (Assignment & { completed: boolean })[] }>(
      '/api/classroom/my-assignments'
    ),
  }
}

export const api = {
  setToken:   (t: string) => { _token = t },
  clearToken: ()          => { _token = null },
  resources:    resourcesApi(),
  classroom:    classroomApi(),
  paths:        pathsApi(),
  activities:   activitiesApi(),
  exercises:    exercisesApi(),
  tools:        toolsApi(),
  quizzes:      quizzesApi(),
  chat:         chatApi(),
  progress:     progressApi(),
  bookmarks:    bookmarksApi(),
  profile:      profileApi(),
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (_token) headers['Authorization'] = `Bearer ${_token}`
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

function qs(p: Record<string, string | number | boolean | undefined>): string {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(p))
    if (v !== undefined && v !== null && v !== '') s.set(k, String(v))
  const r = s.toString()
  return r ? `?${r}` : ''
}

function resourcesApi() {
  return {
    list: (f: { type?: string; difficulty?: string; audience?: string; board?: string;
                 topic?: string; language?: string; search?: string; featured?: boolean;
                 freeOnly?: boolean; limit?: number; offset?: number } = {}) =>
      apiFetch<ListResponse<Resource>>(`/api/resources${qs(f as any)}`),
    get: (id: string) => apiFetch<Resource>(`/api/resources/${id}`),
  }
}

function pathsApi() {
  return {
    list: (o: { board?: string; audience?: string } = {}) =>
      apiFetch<ListResponse<LearningPath>>(`/api/paths${qs(o)}`),
    get: (id: string) =>
      apiFetch<LearningPath & { resources: Resource[] }>(`/api/paths/${id}`),
  }
}

function activitiesApi() {
  return {
    list: (o: { type?: string; age_group?: string } = {}) =>
      apiFetch<ListResponse<ClassroomActivity>>(`/api/activities${qs(o)}`),
    get: (id: string) => apiFetch<ClassroomActivity>(`/api/activities/${id}`),
  }
}

function exercisesApi() {
  return {
    list: (o: { difficulty?: string } = {}) =>
      apiFetch<ListResponse<DeepExercise>>(`/api/exercises${qs(o)}`),
    get: (id: string) => apiFetch<DeepExercise>(`/api/exercises/${id}`),
  }
}

function toolsApi() {
  return {
    list: () => apiFetch<ListResponse<ToolGuide>>('/api/tools'),
    get:  (id: string) => apiFetch<ToolGuide & { walkthroughs: Walkthrough[] }>(`/api/tools/${id}`),
    getWalkthrough: (id: string) => apiFetch<Walkthrough>(`/api/walkthroughs/${id}`),
  }
}

export interface QuizQuestion {
  id: string; type: 'mcq' | 'fill' | 'truefalse'
  question: string; options?: string[]
  answer: string; blank?: string; explanation: string
}

export interface PathQuiz {
  pathId: string; title: string
  questions: QuizQuestion[]; passingScore: number
}

function quizzesApi() {
  return {
    list: () => apiFetch<ListResponse<PathQuiz>>('/api/quizzes'),
    get: (pathId: string) => apiFetch<PathQuiz>(`/api/quizzes/${pathId}`),
  }
}

function chatApi() {
  return {
    send: async (messages: Message[], systemPrompt?: string): Promise<{ text: string }> => {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(_token ? { 'Authorization': `Bearer ${_token}` } : {}),
        },
        body: JSON.stringify({ messages, systemPrompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? data.error ?? `HTTP ${res.status}`)
      return data
    },
  }
}

function progressApi() {
  return {
    get: () => apiFetch<{ data: ResourceProgress[] }>('/api/progress'),
    update: (resource_id: string, completed: boolean, percent = 0) =>
      apiFetch<{ ok: boolean }>('/api/progress', {
        method: 'POST',
        body: JSON.stringify({ resource_id, completed, percent }),
      }),
  }
}

function bookmarksApi() {
  return {
    get: () => apiFetch<{ data: string[] }>('/api/bookmarks'),
    toggle: (resource_id: string) =>
      apiFetch<{ bookmarked: boolean }>('/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify({ resource_id }),
      }),
  }
}

function profileApi() {
  return {
    get: () => apiFetch<Profile>('/api/profile'),
  }
}
