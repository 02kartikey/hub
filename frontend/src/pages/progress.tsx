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

// ══════════════════════════════════════════════════════════════════════════════
// PROGRESS PAGE
// ══════════════════════════════════════════════════════════════════════════════

export function ProgressPage() {
  const { user }        = useAuth()
  const { progressMap } = useProgress()
  const navigate        = useNavigate()
  const [resources, setResources] = useState<Resource[]>([])
  const [paths,     setPaths]     = useState<LearningPath[]>([])
  const [quizScores, setQuizScores] = useState<Record<string, number>>({})

  useEffect(() => {
    api.resources.list({ limit: 120 }).then(r => setResources(r.data)).catch(() => {})
    api.paths.list().then(r => setPaths(r.data)).catch(() => {})
    try { setQuizScores(JSON.parse(localStorage.getItem('quiz_scores') ?? '{}')) } catch {}
  }, [])

  if (!user) return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#EEEEFF] border border-[#DDDDF8] flex items-center justify-center mb-4">
        <BarChart2 size={22} className="text-[#5855D6]"/>
      </div>
      <h2 className="text-xl font-extrabold text-zinc-900 mb-2">Sign in to track progress</h2>
      <p className="text-sm text-zinc-500 mb-6 max-w-xs leading-relaxed">Your learning history, streaks, and path progress are saved to your account.</p>
      <Button onClick={() => navigate('/auth/login')} variant="accent" iconRight={<ArrowRight size={14}/>}>Sign in</Button>
    </div>
  )

  // Derive stats
  const allStarted   = Object.entries(progressMap).filter(([, p]) => p > 0)
  const completed    = allStarted.filter(([, p]) => p === 100)
  const inProgress   = allStarted.filter(([, p]) => p > 0 && p < 100)
  const resMap       = Object.fromEntries(resources.map(r => [r.id, r]))
  const completedRes = completed.map(([id]) => resMap[id]).filter(Boolean) as Resource[]
  const inProgRes    = inProgress.map(([id]) => resMap[id]).filter(Boolean) as Resource[]

  // Per-type breakdown
  const byType: Record<string, number> = {}
  for (const r of completedRes) byType[r.type] = (byType[r.type] ?? 0) + 1

  // Path progress
  const pathStats = paths.map(p => {
    const done  = p.resourceIds.filter(id => (progressMap[id] ?? 0) === 100).length
    const total = p.resourceIds.length
    return { ...p, done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
  }).filter(p => p.done > 0).sort((a, b) => b.pct - a.pct)

  // Quiz results
  const quizEntries = Object.entries(quizScores)
  const passedQuizzes = quizEntries.filter(([pathId]) => {
    // We don't have passing score here so just count any score ≥ 70
    return (quizScores[pathId] ?? 0) >= 70
  })

  const isEmpty = allStarted.length === 0

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      <div className="mb-7">
        <h1 className="font-extrabold tracking-tight mb-1.5" style={{ fontSize: 28, color: 'var(--text-1)' }}>Progress</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Everything you've started, completed, and mastered.</p>
      </div>

      {isEmpty ? (
        /* ── Zero state — directive, not just empty ── */
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-[#C0BFEF] p-8 text-center"
            style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 60%, #FAF5FF 100%)' }}>
            <div className="absolute inset-0 opacity-30"
              style={{ backgroundImage: 'radial-gradient(circle at 70% 40%, rgba(99,102,241,0.15) 0%, transparent 55%)' }}/>
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-[#5855D6] flex items-center justify-center mx-auto mb-4 shadow-lg animate-float">
                <Zap size={26} className="text-white"/>
              </div>
              <h2 className="text-xl font-extrabold text-zinc-900 mb-2">Your journey starts here</h2>
              <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-6 leading-relaxed">
                Complete your first resource to start tracking progress, streaks, and path completion.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/paths/lp1"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5855D6] text-white text-sm font-bold rounded-xl hover:bg-[#4744C8] transition-colors shadow-sm">
                  Start AI Fundamentals <ArrowRight size={14}/>
                </Link>
                <Link to="/browse"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-700 text-sm font-bold rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors">
                  Browse resources
                </Link>
              </div>
            </div>
          </div>

          {/* Suggested first steps */}
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { title: 'AI Fundamentals', sub: 'Best place to start', href: '/paths/lp1', icon: <Brain size={16}/>, color: 'text-[#5855D6]', bg: 'bg-[#EEEEFF]' },
              { title: 'Prompting That Works', sub: 'Practical skills fast', href: '/paths/lp2', icon: <Zap size={16}/>, color: 'text-amber-600', bg: 'bg-amber-50' },
              { title: 'Take an assessment', sub: 'Test what you know', href: '/assessment', icon: <Target size={16}/>, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map(s => (
              <Link key={s.href} to={s.href}
                className="flex items-center gap-3 p-4 bg-white border border-zinc-200 rounded-2xl hover:border-zinc-300 hover:shadow-card-hover transition-all group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-zinc-100 text-zinc-500">{s.icon}</div>
                <div>
                  <p className="text-xs font-bold text-zinc-800 group-hover:text-[#5855D6] transition-colors">{s.title}</p>
                  <p className="text-2xs text-zinc-400">{s.sub}</p>
                </div>
                <ChevronRight size={13} className="text-zinc-300 ml-auto flex-shrink-0"/>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Stats strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Resources started',  val: allStarted.length,    icon: <Play size={15}/>,         cls: 'text-[#5855D6]',  bg: 'bg-[#EEEEFF]',   border: 'border-[#DDDDF8]' },
              { label: 'Completed',          val: completed.length,     icon: <CheckCircle2 size={15}/>, cls: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
              { label: 'Paths in progress',  val: pathStats.length,     icon: <GitBranch size={15}/>,    cls: 'text-violet-600',  bg: 'bg-violet-50',   border: 'border-violet-100' },
              { label: 'Quizzes passed',     val: passedQuizzes.length, icon: <Award size={15}/>,        cls: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-100' },
            ].map(s => (
              <Link key={s.label} to="/progress"
                className="bg-white rounded-2xl p-4 hover:shadow-card-hover hover:border-zinc-300 transition-all group"
                style={{ border:'1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', s.bg, s.border, 'border')}>
                    <span className={s.cls}>{s.icon}</span>
                  </div>
                  <p className="text-2xl font-extrabold text-zinc-900">{s.val}</p>
                </div>
                <p className="text-xs text-zinc-500 font-medium group-hover:text-[#5855D6] transition-colors">{s.label}</p>
              </Link>
            ))}
          </div>

          {/* ── Learning path progress ── */}
          {pathStats.length > 0 && (
            <section>
              <SectionHeading title="Learning paths" action={
                <Link to="/curriculum" className="text-xs text-[#5855D6] font-semibold flex items-center gap-1 hover:text-[#4744C8]">
                  All paths <ChevronRight size={12}/>
                </Link>
              }/>
              <div className="space-y-3">
                {pathStats.map(p => (
                  <Link key={p.id} to={`/paths/${p.id}`}
                    className="group flex items-center gap-4 bg-white border border-zinc-200 rounded-xl px-5 py-4 hover:border-zinc-300 hover:shadow-card-hover transition-all">
                    {/* Ring */}
                    <div className="relative flex-shrink-0">
                      <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="22" cy="22" r="18" fill="none" stroke="#E2E8F0" strokeWidth="3"/>
                        <circle cx="22" cy="22" r="18" fill="none"
                          stroke={p.pct === 100 ? '#10B981' : '#6366F1'} strokeWidth="3"
                          strokeDasharray={2 * Math.PI * 18}
                          strokeDashoffset={2 * Math.PI * 18 * (1 - p.pct / 100)}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}/>
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-zinc-600">{p.pct}%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-800 group-hover:text-[#5855D6] transition-colors truncate">{p.title}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{p.done} of {p.total} resources complete</p>
                      <div className="mt-2 h-1 bg-zinc-100 rounded-full overflow-hidden max-w-xs">
                        <div className={cn('h-full rounded-full transition-all duration-700', p.pct === 100 ? 'bg-signal-green' : 'bg-[#5855D6]')}
                          style={{ width: `${p.pct}%` }}/>
                      </div>
                    </div>
                    {p.pct === 100
                      ? <span className="flex-shrink-0 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-2xs font-bold rounded-full">Complete ✓</span>
                      : <span className="flex-shrink-0 text-2xs text-[#5855D6] font-bold flex items-center gap-1">Continue <ChevronRight size={11}/></span>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Topics covered — meaningful signal, not just content type ── */}
          {completedRes.length > 0 && (() => {
            const byTopic: Record<string, number> = {}
            for (const r of completedRes) {
              for (const t of (r.topics ?? [])) {
                byTopic[t] = (byTopic[t] ?? 0) + 1
              }
            }
            const sorted = Object.entries(byTopic).sort(([,a],[,b]) => b - a)
            if (sorted.length === 0) return null
            return (
              <section>
                <SectionHeading title="Topics you've covered" action={
                  <span className="text-2xs text-zinc-400">{sorted.length} topic{sorted.length !== 1 ? 's' : ''}</span>
                }/>
                <div className="flex flex-wrap gap-2">
                  {sorted.map(([topic, count]) => (
                    <Link key={topic} to={`/browse?topic=${encodeURIComponent(topic)}`}
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 rounded-xl hover:border-[#C0BFEF] hover:bg-indigo-50 transition-all group">
                      <span className="text-sm font-extrabold text-zinc-800">{count}</span>
                      <span className="text-xs text-zinc-500 group-hover:text-[#5855D6] font-medium transition-colors">{topic}</span>
                    </Link>
                  ))}
                </div>
                <p className="text-2xs text-zinc-400 mt-3">Each number is how many resources you've completed in that topic. Click to explore more.</p>
              </section>
            )
          })()}

          {/* ── In progress ── */}
          {inProgRes.length > 0 && (
            <section>
              <SectionHeading title="Continue where you left off" action={
                <Link to="/browse" className="text-xs text-[#5855D6] font-semibold flex items-center gap-1 hover:text-[#4744C8]">
                  Browse all <ChevronRight size={12}/>
                </Link>
              }/>
              <div className="grid sm:grid-cols-2 gap-3">
                {inProgRes.slice(0, 6).map(r => {
                  const pct = progressMap[r.id] ?? 0
                  return (
                    <Link key={r.id} to={`/content/${r.id}`}
                      className="group flex items-center gap-3 bg-white border border-zinc-200 rounded-xl p-4 hover:border-[#C0BFEF] hover:shadow-card-hover transition-all">
                      <div className="relative flex-shrink-0">
                        <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx="20" cy="20" r="16" fill="none" stroke="#E2E8F0" strokeWidth="3"/>
                          <circle cx="20" cy="20" r="16" fill="none" stroke="#6366F1" strokeWidth="3"
                            strokeDasharray={2 * Math.PI * 16}
                            strokeDashoffset={2 * Math.PI * 16 * (1 - pct / 100)}
                            strokeLinecap="round"/>
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-zinc-600">{pct}%</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-zinc-800 group-hover:text-[#5855D6] transition-colors line-clamp-1">{r.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant={r.type as any}/>
                          <Badge variant={r.difficulty as any}/>
                        </div>
                      </div>
                      <ChevronRight size={13} className="text-zinc-300 flex-shrink-0"/>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Completed resources ── */}
          {completedRes.length > 0 && (
            <section>
              <SectionHeading title={`Completed (${completedRes.length})`}/>
              <div className="grid sm:grid-cols-2 gap-2">
                {completedRes.slice(0, 8).map(r => (
                  <Link key={r.id} to={`/content/${r.id}`}
                    className="group flex items-center gap-3 px-4 py-3 bg-white border border-zinc-200 rounded-xl hover:border-emerald-200 hover:shadow-card transition-all">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Check size={13} className="text-emerald-600" strokeWidth={2.5}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 group-hover:text-emerald-700 truncate transition-colors">{r.title}</p>
                      <p className="text-2xs text-zinc-400 capitalize mt-0.5">{r.type} · {r.difficulty}</p>
                    </div>
                  </Link>
                ))}
              </div>
              {completedRes.length > 8 && (
                <p className="text-xs text-zinc-400 text-center mt-3">+{completedRes.length - 8} more completed</p>
              )}
            </section>
          )}

          {/* ── Next up CTA ── */}
          {inProgRes.length === 0 && completed.length > 0 && (
            <div className="rounded-2xl border border-[#C0BFEF] p-6 text-center"
              style={{ background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)' }}>
              <p className="text-sm font-extrabold text-zinc-900 mb-1">Ready for more?</p>
              <p className="text-xs text-zinc-500 mb-4">You've finished everything in progress. Start something new.</p>
              <Link to="/curriculum"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5855D6] text-white text-sm font-bold rounded-xl hover:bg-[#4744C8] transition-colors">
                Explore learning paths <ArrowRight size={14}/>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

// ── Shared helpers for classroom/dashboard ───────────────────────────────────

/** Circular SVG ring progress indicator */
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