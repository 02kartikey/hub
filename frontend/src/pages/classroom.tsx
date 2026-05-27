import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Brain, FlaskConical, Users, Video, Globe, GraduationCap,
  MessageSquare, ArrowRight, ArrowLeft, Play,
  ExternalLink, Clock, Star, Users as UsersIcon, AlertCircle, Check, CheckCircle2, X, ChevronRight,
  RotateCcw, Send, Lightbulb, Filter, Search, GitBranch, Award, Target, Zap,
  TrendingUp, BookOpen, BarChart2, AlertTriangle, Plus, Copy, Layers, ChevronDown} from 'lucide-react'
import { cn, Badge, Button, ProgressBar, Spinner, EmptyState, TypingDots } from '../ui'
import {
  OSHero, CapabilityModules, PersonalisedBanner,
  LearningPathStrip, ToolGuideStrip, ContentGrid, FilterRow, ContentCard,
  StageChat, StageProgress, DeepAnalysis, OnboardingModal,
  OnboardingFlow, ResourceAssistant, SmartThumbnail, ResourceBanner,
  ToolLettermark, SpotlightTour, CONCEPT_TOPICS} from '../components'
import { api } from '../api'
import type { Assignment, StudentRow, Classroom } from '../api'
import type { Resource, LearningPath, ClassroomActivity, DeepExercise, Message } from '../types'
import type { PathQuiz, QuizQuestion } from '../api'
import { useAuth, useProgress, useBookmarks, getOnboardingProfile, supabase } from '../auth'
import { checkAndAward, awardBadge, useBadges, BadgeCard, BADGES, getEarnedBadges, BadgesPage } from '../badges'
import { useFetch, PageLoader, PageError } from './shared'

// ── Main dashboard ────────────────────────────────────────────────────────────

function avatarColor(name: string): string {
  const p = [
    'bg-violet-100 text-violet-700', 'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700',
  ]
  return p[(name || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % p.length]
}

/** 6-char classroom code (no ambiguous 0/O/1/I chars) */

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── Teacher classroom dashboard ───────────────────────────────────────────────

// ── local types (dashboard-only) ─────────────────────────────────────────────
type AssignableType = 'resource' | 'exercise' | 'path' | 'activity'
interface AssignableItem { id: string; title: string; type: AssignableType; meta: string }

// ── Student profile drill-down ────────────────────────────────────────────────

function RingProgress({ value, size = 44, strokeWidth = 3 }: { value: number; size?: number; strokeWidth?: number }) {
  const r      = (size - strokeWidth * 2) / 2
  const circ   = 2 * Math.PI * r
  const pct    = Math.min(100, Math.max(0, value))
  const offset = circ * (1 - pct / 100)
  const col    = pct === 100 ? '#10B981' : '#5855D6'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E8E8ED" strokeWidth={strokeWidth}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}/>
    </svg>
  )
}

/** Deterministic avatar colour class from name string */

function StudentProfile({ student, assignments, onBack }: {
  student: StudentRow; assignments: Assignment[]
  onBack: () => void
}) {
  const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-5 animate-fade-in">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
        <ArrowLeft size={12}/> Back to class
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4">
        {/* Profile card */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col items-center text-center">
          <div className={cn('w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold mb-3', avatarColor(student.name))}>
            {initials}
          </div>
          <p className="text-sm font-bold text-zinc-900">{student.name}</p>
          <p className="text-xs text-zinc-400 mb-4">{student.email}</p>
          <div className="w-full space-y-2.5 border-t border-zinc-100 pt-4 text-left">
            {[
              { label: 'Resources started', val: student.started },
              { label: 'Completed',         val: student.completed },
              { label: 'Completion rate',   val: `${student.rate}%` },
              { label: 'Current streak',    val: student.streak > 0 ? `🔥 ${student.streak} days` : '—' },
              { label: 'Avg quiz score',    val: student.quizScore != null ? `${student.quizScore}%` : '—' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">{item.label}</span>
                <span className={cn('text-xs font-bold',
                  item.label === 'Current streak' && student.streak === 0 ? 'text-red-500' : 'text-zinc-800'
                )}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Path progress */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Learning path progress</p>
            <div className="space-y-3">
              {Object.entries(student.pathProgress).length === 0 ? (
                <p className="text-xs text-zinc-400">No path progress recorded yet.</p>
              ) : Object.entries(student.pathProgress).map(([pathId, pct]) => (
                <div key={pathId} className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <RingProgress value={pct} size={38} strokeWidth={3}/>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-zinc-600">
                      {pct}%
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-800 truncate mb-1">{pathId}</p>
                    <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: pct === 100 ? '#10B981' : '#5855D6' }}/>
                    </div>
                  </div>
                  {pct === 0   && <span className="text-2xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded flex-shrink-0">Not started</span>}
                  {pct > 0 && pct < 100 && <span className="text-2xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded flex-shrink-0">In progress</span>}
                  {pct === 100 && <span className="text-2xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex-shrink-0">✓ Done</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Assignments */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Assigned work</p>
            {assignments.length === 0 ? (
              <p className="text-xs text-zinc-400">No assignments yet — use "Assign to class" to add some.</p>
            ) : (
              <div className="space-y-2">
                {assignments.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">{a.title}</p>
                      {a.due_date && <p className="text-2xs text-zinc-400 mt-0.5">Due {new Date(a.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>}
                    </div>
                    <span className={cn('text-2xs font-bold px-2 py-0.5 rounded flex-shrink-0',
                      a.content_type === 'resource' ? 'bg-blue-50 text-blue-700' :
                      a.content_type === 'exercise' ? 'bg-amber-50 text-amber-700' :
                      a.content_type === 'path'     ? 'bg-violet-50 text-violet-700' :
                                                      'bg-emerald-50 text-emerald-700'
                    )}>{a.content_type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* At-risk warning */}
          {(student.streak === 0 || student.rate < 20) && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-2.5">
              <AlertTriangle size={14} className="text-orange-500 flex-shrink-0 mt-0.5"/>
              <p className="text-xs text-orange-800 leading-relaxed">
                <strong>{student.name.split(' ')[0]}</strong> hasn't been active recently.
                {student.streak === 0 && ' Their streak has reset to 0.'} Consider reaching out or assigning a shorter resource to re-engage them.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Assign modal ──────────────────────────────────────────────────────────────

function AssignModal({ resources, paths, onClose, onAssign }: {
  resources: Resource[]
  paths: LearningPath[]
  onClose: () => void
  onAssign: (item: AssignableItem, dueDate: string, note: string) => Promise<void>
}) {
  const [tab, setTab]           = useState<AssignableType>('resource')
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<AssignableItem | null>(null)
  const [dueDate, setDueDate]   = useState('')
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [success, setSuccess]   = useState(false)

  const exercises = useRef<AssignableItem[]>([
    { id: 'hallucination-hunt', type: 'exercise', title: 'The Hallucination Hunt',  meta: 'Hallucination · 25 min' },
    { id: 'sycophancy-mirror',  type: 'exercise', title: 'The Sycophancy Mirror',   meta: 'Sycophancy · 20 min' },
    { id: 'bias-probe',         type: 'exercise', title: 'Bias Probe',              meta: 'Training data bias · 30 min' },
    { id: 'prompt-injection',   type: 'exercise', title: 'Prompt Injection',        meta: 'AI safety · 25 min' },
    { id: 'few-shot-power',     type: 'exercise', title: 'Few-Shot Power',          meta: 'Prompting · 20 min' },
    { id: 'knowledge-cutoff',   type: 'exercise', title: 'Knowledge Cutoff',        meta: 'Training data cutoff · 20 min' },
    { id: 'reasoning-limits',   type: 'exercise', title: 'Reasoning Limits',        meta: 'Logical reasoning · 25 min' },
    { id: 'token-prediction',   type: 'exercise', title: 'Token Prediction',        meta: 'How LLMs work · 20 min' },
  ]).current

  // Quizzes treated as assessments
  const quizItems = useRef<AssignableItem[]>([
    { id: 'ai-foundations',     type: 'activity', title: 'AI Foundations Quiz',          meta: 'Assessment · 10 questions' },
    { id: 'prompting-basics',   type: 'activity', title: 'Prompting Basics Assessment',  meta: 'Assessment · 8 questions' },
    { id: 'ai-ethics-check',    type: 'activity', title: 'AI Ethics Check',             meta: 'Assessment · 12 questions' },
    { id: 'hallucination-quiz', type: 'activity', title: 'Hallucination & Bias Quiz',   meta: 'Assessment · 10 questions' },
  ]).current

  const pathItems: AssignableItem[] = paths.slice(0, 20).map(p => ({
    id: p.id, type: 'path' as const, title: p.title,
    meta: `${p.resourceIds?.length ?? 0} resources · ${p.difficulty ?? 'beginner'}`
  }))

  const resourceItems: AssignableItem[] = resources.slice(0, 40).map(r => ({
    id: r.id, type: 'resource' as const, title: r.title,
    meta: `${r.type} · ${r.difficulty}`
  }))

  const TABS: { id: AssignableType; label: string; emoji: string }[] = [
    { id: 'resource', label: 'Resource',    emoji: '📚' },
    { id: 'exercise', label: 'Playground',  emoji: '🧪' },
    { id: 'path',     label: 'Learning path', emoji: '🗺️' },
    { id: 'activity', label: 'Assessment',  emoji: '📝' },
  ]

  const items =
    tab === 'resource' ? resourceItems :
    tab === 'exercise' ? exercises :
    tab === 'path'     ? pathItems :
                         quizItems
  const filtered = items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()))

  const handleAssign = async () => {
    if (!selected) return
    setSaving(true)
    await onAssign(selected, dueDate, note)
    setSuccess(true)
    setTimeout(onClose, 1400)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-bold text-zinc-900">Assign to class</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
            <X size={16} className="text-zinc-400"/>
          </button>
        </div>

        {/* Type tabs */}
        <div className="flex border-b border-zinc-100 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSelected(null); setSearch('') }}
              className={cn('flex-1 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap px-2',
                tab === t.id ? 'text-[#5855D6] border-b-2 border-[#5855D6]' : 'text-zinc-400 hover:text-zinc-600'
              )}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-zinc-50">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${tab}s…`}
            className="w-full text-xs px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-400"
          />
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {filtered.slice(0, 20).map(item => (
            <label key={item.id}
              className={cn('flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                selected?.id === item.id
                  ? 'bg-indigo-50 border-[#5855D6]'
                  : 'bg-white border-zinc-100 hover:border-zinc-300'
              )}>
              <input type="radio" name="assign-item" value={item.id}
                checked={selected?.id === item.id}
                onChange={() => setSelected(item)}
                className="mt-0.5 flex-shrink-0 accent-[#5855D6]"/>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-800 leading-snug">{item.title}</p>
                <p className="text-2xs text-zinc-400 mt-0.5 capitalize">{item.meta}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Due date + note */}
        <div className="px-5 py-4 border-t border-zinc-100 space-y-3 bg-zinc-50">
          <div className="flex items-center gap-3">
            <label className="text-xs text-zinc-500 font-medium w-16 flex-shrink-0">Due date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="flex-1 text-xs px-3 py-1.5 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-400"/>
          </div>
          <div className="flex items-start gap-3">
            <label className="text-xs text-zinc-500 font-medium w-16 flex-shrink-0 mt-1.5">Note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              rows={2} placeholder="Optional note for students…"
              className="flex-1 text-xs px-3 py-1.5 bg-white border border-zinc-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent-400"/>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-100 flex items-center gap-3">
          <button onClick={handleAssign} disabled={!selected || saving || success}
            className={cn(
              'flex-1 py-2.5 text-xs font-bold rounded-xl transition-all',
              success ? 'bg-emerald-500 text-white' :
              selected ? 'bg-[#5855D6] text-white hover:bg-[#4744C8]' :
              'bg-zinc-100 text-zinc-400 cursor-not-allowed'
            )}>
            {success ? '✓ Assigned!' : saving ? 'Assigning…' : selected ? `Assign "${selected.title.slice(0, 28)}${selected.title.length > 28 ? '…' : ''}"` : 'Select content above'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-xs font-semibold text-zinc-500 hover:text-zinc-700 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export function TeacherClassroomDashboard() {
  const { user, profile, loading: authLoading } = useAuth()

  // Wait for auth to resolve before showing anything
  if (authLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#5855D6] border-t-transparent animate-spin"/>
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    </div>
  )

  // Not signed in
  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <GraduationCap size={32} className="text-zinc-300 mb-4"/>
      <p className="text-sm font-semibold text-zinc-600 mb-4">Sign in to access your classroom</p>
      <a href="/auth/login" className="px-5 py-2.5 bg-[#5855D6] text-white text-sm font-bold rounded-xl hover:bg-[#4744C8] transition-colors">Sign in</a>
    </div>
  )

  // Not a teacher
  if (profile?.role !== 'teacher') return (
    <div className="px-4 lg:px-8 py-12 max-w-lg mx-auto text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-[#DDDDF8] flex items-center justify-center mx-auto mb-5">
        <GraduationCap size={28} className="text-[#5855D6]"/>
      </div>
      <h2 className="text-xl font-bold text-zinc-900 mb-2">This is for teachers</h2>
      <p className="text-sm text-zinc-500 leading-relaxed mb-6">
        The classroom dashboard lets teachers manage students, assign work, and track progress. Change your role to <strong>Teacher</strong> in Settings to unlock it.
      </p>
      <a href="/settings"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5855D6] text-white text-sm font-bold rounded-xl hover:bg-[#4744C8] transition-colors">
        Go to Settings →
      </a>
    </div>
  )

  // Confirmed teacher — render the real dashboard
  return <TeacherClassroomDashboardInner/>
}

function TeacherClassroomDashboardInner() {
  const { user, profile } = useAuth()
  const [classroom,    setClassroom]    = useState<Classroom | null>(null)
  const [students,     setStudents]     = useState<StudentRow[]>([])
  const [assignments,  setAssignments]  = useState<Assignment[]>([])
  const [resources,    setResources]    = useState<Resource[]>([])
  const [paths,        setPaths]        = useState<LearningPath[]>([])
  const [loading,      setLoading]      = useState(true)
  const [copied,       setCopied]       = useState(false)
  const [sortBy,       setSortBy]       = useState<'rate' | 'name' | 'quiz' | 'streak'>('rate')
  const [filter,       setFilter]       = useState<'all' | 'at-risk' | 'excelling'>('all')
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [assignOpen,   setAssignOpen]   = useState(false)

  const firstName = profile?.full_name?.split(' ')[0] ?? null
  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayStr  = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2200)
  }

  const loadDashboard = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch('/api/classroom', {
        headers: { 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}` }
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const { classroom: cls, students: studs } = await res.json()
      setClassroom(cls)
      setStudents(studs ?? [])

      // Load assignments separately
      const aRes = await fetch('/api/classroom/assignments', {
        headers: { 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}` }
      })
      if (aRes.ok) {
        const { data } = await aRes.json()
        setAssignments(data ?? [])
      }
    } catch (e) {
      console.error('Classroom load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  // Load assignable resources once
  useEffect(() => {
    fetch('/api/resources?limit=80')
      .then(r => r.json())
      .then(d => setResources(d.data ?? []))
      .catch(() => {})
    fetch('/api/paths')
      .then(r => r.json())
      .then(d => setPaths(d.data ?? []))
      .catch(() => {})
  }, [])

  const handleAssign = async (item: AssignableItem, dueDate: string, note: string) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? ''
      const res = await fetch('/api/classroom/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          content_type: item.type,
          content_id: item.id,
          title: item.title,
          note: note || null,
          due_date: dueDate || null,
        }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const { assignment } = await res.json()
      setAssignments(prev => [assignment, ...prev])
    } catch (e) {
      console.error('Assign failed', e)
    }
  }

  const deleteAssignment = async (id: string) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? ''
      await fetch(`/api/classroom/assignments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      setAssignments(prev => prev.filter(a => a.id !== id))
    } catch {}
  }

  // Derived
  const atRisk     = students.filter(s => s.rate < 20 || s.quizScore != null && s.quizScore < 50)
  const excelling  = students.filter(s => s.rate >= 80 && (s.quizScore == null || s.quizScore >= 75))
  const avgRate    = students.length ? Math.round(students.reduce((s, r) => s + r.rate, 0) / students.length) : 0
  const avgQuiz    = students.filter(s => s.quizScore != null).length
    ? Math.round(students.filter(s => s.quizScore != null).reduce((s, r) => s + (r.quizScore ?? 0), 0) / students.filter(s => s.quizScore != null).length)
    : null
  const totalDone  = students.reduce((s, r) => s + r.completed, 0)

  const filteredStudents = (
    filter === 'at-risk'   ? atRisk :
    filter === 'excelling' ? excelling : students
  ).slice().sort((a, b) =>
    sortBy === 'rate'   ? b.rate - a.rate :
    sortBy === 'name'   ? a.name.localeCompare(b.name) :
    sortBy === 'quiz'   ? (b.quizScore ?? -1) - (a.quizScore ?? -1) :
                          b.streak - a.streak
  )

  const selectedStudentData = students.find(s => s.id === selectedStudent) ?? null

  if (selectedStudentData) return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      <StudentProfile
        student={selectedStudentData}
        assignments={assignments}
        onBack={() => setSelectedStudent(null)}
      />
    </div>
  )

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto space-y-5 animate-fade-in">

      {/* Assign modal */}
      {assignOpen && (
        <AssignModal
          resources={resources}
          paths={paths}
          onClose={() => setAssignOpen(false)}
          onAssign={handleAssign}
        />
      )}

      {/* ── Greeting banner ──────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden px-6 py-7"
        style={{ background: 'linear-gradient(135deg, #0A0A0B 0%, #1A1840 55%, #2D2880 100%)' }}>
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 0)', backgroundSize: '22px 22px' }}/>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-2xs font-semibold text-white/30 uppercase tracking-[0.14em] mb-1.5">{todayStr}</p>
            <h1 className="text-xl font-bold text-white tracking-tight mb-1.5">
              {greeting}{firstName ? `, ${firstName}` : ''} 🎓
            </h1>
            <p className="text-xs text-white/40 mb-4 max-w-md leading-relaxed">
              {students.length > 0
                ? `${students.length} student${students.length !== 1 ? 's' : ''} in your classroom${atRisk.length > 0 ? ` · ${atRisk.length} need attention` : ''}.`
                : 'Your classroom is ready. Share the code below to get started.'}
            </p>
            {classroom && (
              <div className="inline-flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/20"
                  style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <span className="text-2xs font-bold text-white/40 uppercase tracking-widest">Class code</span>
                  <span className="text-lg font-black text-white tracking-[0.22em]">{classroom.code}</span>
                </div>
                <button onClick={() => copyCode(classroom.code)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border',
                    copied ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                           : 'bg-white/10 text-white/60 hover:bg-white/20 border-white/10'
                  )}>
                  {copied ? <><Check size={11}/> Copied!</> : <><Copy size={11}/> Copy code</>}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { val: students.length,           label: 'Students'  },
              { val: `${avgRate}%`,             label: 'Avg done'  },
              { val: avgQuiz != null ? `${avgQuiz}%` : '—', label: 'Avg quiz' },
              { val: atRisk.length,             label: 'At risk',  danger: atRisk.length > 0 },
            ].map(s => (
              <div key={s.label} className="px-4 py-2.5 rounded-xl border border-white/10 text-center min-w-[62px]"
                style={{ background: s.danger && atRisk.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)' }}>
                <p className={cn('text-xl font-bold leading-none mb-0.5', s.danger && atRisk.length > 0 ? 'text-red-300' : 'text-white')}>{s.val}</p>
                <p className="text-2xs text-white/30 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── At-risk alert ─────────────────────────────────────────────────────── */}
      {atRisk.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
          <AlertTriangle size={14} className="text-orange-500 flex-shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="text-xs text-orange-800 leading-relaxed">
              <strong>{atRisk.slice(0, 3).map(s => s.name.split(' ')[0]).join(', ')}{atRisk.length > 3 ? ` +${atRisk.length - 3} more` : ''}</strong> are below 20% completion or scoring under 50% on quizzes.
            </p>
          </div>
          <button onClick={() => setFilter('at-risk')}
            className="text-2xs font-bold text-orange-700 hover:text-orange-900 transition-colors flex-shrink-0">
            View →
          </button>
        </div>
      )}

      {/* ── Actions row ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setAssignOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#5855D6] text-white text-xs font-bold rounded-xl hover:bg-[#4744C8] transition-colors shadow-sm">
          <Plus size={13}/> Assign to class
        </button>
        <div className="flex gap-1.5">
          {(['all', 'at-risk', 'excelling'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors',
                filter === f ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300'
              )}>
              {f === 'all' ? `All (${students.length})` : f === 'at-risk' ? `⚠️ At risk (${atRisk.length})` : `✨ Excelling (${excelling.length})`}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="text-xs text-zinc-600 bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#5855D6]">
            <option value="rate">Sort: Completion</option>
            <option value="quiz">Sort: Quiz score</option>
            <option value="streak">Sort: Streak</option>
            <option value="name">Sort: Name</option>
          </select>
          <button onClick={loadDashboard} title="Refresh"
            className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-600 transition-colors">
            <RotateCcw size={13}/>
          </button>
        </div>
      </div>

      {/* ── Active assignments ────────────────────────────────────────────────── */}
      {assignments.length > 0 && (
        <section>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Active assignments</p>
          <div className="space-y-2">
            {assignments.map(a => (
              <div key={a.id}
                className="flex items-center gap-3 px-4 py-3 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 transition-colors">
                <span className={cn('text-2xs font-bold px-2 py-0.5 rounded flex-shrink-0 capitalize',
                  a.content_type === 'resource' ? 'bg-blue-50 text-blue-700' :
                  a.content_type === 'exercise' ? 'bg-amber-50 text-amber-700' :
                  a.content_type === 'path'     ? 'bg-violet-50 text-violet-700' :
                                                  'bg-emerald-50 text-emerald-700'
                )}>{a.content_type}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-800 truncate">{a.title}</p>
                  {a.note && <p className="text-2xs text-zinc-400 truncate mt-0.5">{a.note}</p>}
                </div>
                {a.due_date && (
                  <span className="text-2xs text-zinc-400 flex-shrink-0">
                    Due {new Date(a.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#5855D6] rounded-full transition-all"
                      style={{ width: students.length > 0 ? `${Math.round(((a.completedCount ?? 0) / students.length) * 100)}%` : '0%' }}/>
                  </div>
                  <span className="text-2xs font-bold text-zinc-500">{a.completedCount ?? 0}/{students.length}</span>
                </div>
                <button onClick={() => deleteAssignment(a.id)}
                  className="p-1 rounded hover:bg-red-50 text-zinc-300 hover:text-red-400 transition-colors flex-shrink-0">
                  <X size={12}/>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Student roster ────────────────────────────────────────────────────── */}
      <section>
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          {filter === 'all' ? 'All students' : filter === 'at-risk' ? '⚠️ At-risk students' : '✨ Excelling students'} ({filteredStudents.length})
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16 bg-white border border-zinc-200 rounded-xl">
            <Spinner size={20} className="text-[#5855D6]"/>
          </div>
        ) : students.length === 0 ? (
          <div className="bg-gradient-to-br from-indigo-50 via-white to-zinc-50 border border-[#DDDDF8] rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center mx-auto mb-4">
              <Users size={22} className="text-zinc-400"/>
            </div>
            <p className="text-sm font-bold text-zinc-800 mb-1.5">No students yet</p>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto mb-5 leading-relaxed">
              Share your class code with students — they enter it from their dashboard to join.
            </p>
            {classroom && (
              <div className="inline-flex items-center gap-3 px-5 py-3 bg-white rounded-xl border border-zinc-200">
                <span className="text-2xs font-bold text-zinc-400 uppercase tracking-widest">Code</span>
                <span className="text-xl font-black text-zinc-900 tracking-[0.18em]">{classroom.code}</span>
                <button onClick={() => copyCode(classroom.code)}
                  className="text-2xs font-bold text-[#5855D6] hover:text-[#4744C8] transition-colors ml-1">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
            <p className="text-sm text-zinc-500">No students in this filter.</p>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_60px_64px_70px_140px_80px] gap-3 px-5 py-2.5 bg-zinc-50 border-b border-zinc-200">
              {['Student', 'Done', 'Streak', 'Quiz', 'Progress', ''].map(h => (
                <span key={h} className="text-2xs font-bold uppercase tracking-widest text-zinc-400">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-zinc-50">
              {filteredStudents.map(s => {
                const initials = s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                const isAtRisk = s.rate < 20 || (s.quizScore != null && s.quizScore < 50)
                return (
                  <div key={s.id}
                    className="grid grid-cols-[1fr_60px_64px_70px_140px_80px] gap-3 px-5 py-3.5 items-center hover:bg-zinc-50/70 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isAtRisk && <AlertTriangle size={10} className="text-orange-400 flex-shrink-0"/>}
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-2xs font-bold', avatarColor(s.name))}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-800 truncate">{s.name}</p>
                        <p className="text-2xs text-zinc-400 truncate">
                          Joined {new Date(s.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    <p className={cn('text-xs font-bold', s.completed > 0 ? 'text-emerald-600' : 'text-zinc-400')}>
                      {s.completed}
                    </p>
                    <p className={cn('text-xs font-bold', s.streak === 0 ? 'text-red-400' : s.streak >= 7 ? 'text-emerald-600' : 'text-zinc-700')}>
                      {s.streak > 0 ? `🔥 ${s.streak}` : '—'}
                    </p>
                    <p className={cn('text-xs font-bold',
                      s.quizScore == null ? 'text-zinc-300' :
                      s.quizScore >= 75 ? 'text-emerald-600' :
                      s.quizScore < 50  ? 'text-red-500' : 'text-amber-600'
                    )}>
                      {s.quizScore != null ? `${s.quizScore}%` : '—'}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all duration-700',
                          s.rate === 100 ? 'bg-emerald-500' :
                          s.rate >= 60   ? 'bg-[#5855D6]'   : 'bg-amber-400'
                        )} style={{ width: `${s.rate}%` }}/>
                      </div>
                      <span className="text-2xs font-bold text-zinc-500 w-8 text-right">{s.rate}%</span>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={() => setSelectedStudent(s.id)}
                        className="px-3 py-1 text-2xs font-bold text-[#5855D6] bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors">
                        Profile →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
// CHAT PAGE — general AI literacy chat
// ══════════════════════════════════════════════════════════════════════════════

const CHAT_STARTERS_BY_ROLE: Record<string, string[]> = {
  teacher: [
    'How do I teach AI hallucination to Class 9 students?',
    'Design an AI-proof assessment for CBSE.',
    'What ethical issues should I cover in my AI unit?',
    'How do I integrate AI tools without harming student thinking?',
    'Give me a 45-minute lesson plan on AI bias.',
  ],
  student: [
    'Why does AI make things up? Explain the mechanism.',
    'What is sycophancy in AI and why does it happen?',
    'How do I prepare for CBSE AI Code 417?',
    'What is the difference between supervised and reinforcement learning?',
    'What should I know before trusting AI outputs?',
  ],
  curious: [
    'Explain AI hallucination like I have no tech background.',
    'What is the most important thing to understand about AI?',
    'Is AI actually intelligent?',
    'What are the real risks of AI?',
    'How do I use AI without being misled?',
  ],
}

function buildChatSystemPrompt(): string {
  let role = 'student', board = '', goals: string[] = []
  try {
    const raw = localStorage.getItem('aihub_onboarding')
    if (raw) { const p = JSON.parse(raw); role = p.role ?? 'student'; board = p.board ?? ''; goals = p.goals ?? [] }
  } catch {}
  const roleLabel = role === 'teacher' ? 'an educator' : role === 'curious' ? 'a curious learner' : 'a student'
  const boardLine = board ? `\nThe user follows the ${board} curriculum.` : ''
  const goalsLine = goals.length ? `\nTheir stated learning goals: ${goals.join(', ')}.` : ''
  return `You are an expert AI literacy tutor on AIhub. You are speaking with ${roleLabel}.${boardLine}${goalsLine}

Your job: help this person genuinely understand AI. Personalise language, examples, and depth to their role.

If educator: focus on classroom application, lesson design, explaining to students, assessment.
If student: focus on concepts, exam prep (${board || 'CBSE/IGCSE/IB'}), critical thinking. Redirect homework requests to understanding.
If curious learner: be accessible, everyday analogies, no assumed technical knowledge.

You explain: LLMs, transformers, attention, RLHF, hallucination, sycophancy, bias, safety, prompting, ethics, curriculum alignment.

Rules: Be clear, direct, honest. Never hype AI. Acknowledge uncertainty. Under 200 words unless depth is needed. Encourage critical thinking over AI dependence.`
}
