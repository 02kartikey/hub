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
import { useFetch, PageLoader, PageError, SectionHeading } from './shared'

// ══════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ══════════════════════════════════════════════════════════════════════════════

// Daily focus suggestion — changes each day, tied to what the user hasn't done yet
function DailyFocus({ progressMap, paths, resources }: {
  progressMap: Record<string,number>; paths: LearningPath[]; resources: Resource[]
}) {
  const incomplete = paths.find(p =>
    p.resourceIds.some(id => (progressMap[id] ?? 0) > 0 && (progressMap[id] ?? 0) < 100)
  )
  if (!incomplete) return null
  const nextResourceId = incomplete.resourceIds.find(id => (progressMap[id] ?? 0) < 100)
  const nextRes = resources.find(r => r.id === nextResourceId)
  if (!nextRes) return null
  const pct = Math.round(incomplete.resourceIds.filter(id => (progressMap[id]??0)===100).length / incomplete.resourceIds.length * 100)

  return (
    <div className="relative rounded-2xl overflow-hidden mb-8 border border-[#C0BFEF] p-5"
      style={{ background: 'linear-gradient(135deg, #0A0A0B 0%, #1A1840 60%, #2D2880 100%)' }}>
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 0)', backgroundSize: '20px 20px' }}/>
      <div className="relative flex flex-wrap items-center gap-5">
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-bold text-white/40 uppercase tracking-widest mb-1">Continue where you left off</p>
          <h3 className="text-base font-bold text-white mb-1 truncate">{incomplete.title}</h3>
          <p className="text-xs text-white/50 mb-3 truncate">Next: {nextRes.title}</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-[140px] h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#8B85F4] rounded-full transition-all" style={{ width: `${pct}%` }}/>
            </div>
            <span className="text-2xs text-white/40">{pct}% done</span>
          </div>
        </div>
        <Link to={`/content/${nextRes.id}`}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/15 text-white text-xs font-bold rounded-xl hover:bg-white/20 transition-colors">
          Continue <ArrowRight size={13}/>
        </Link>
      </div>
    </div>
  )
}

// Quick-access stat bar — shows live counts from user's actual progress
function ProgressStatBar({ progressMap, paths }: { progressMap: Record<string,number>; paths: LearningPath[] }) {
  const started   = Object.values(progressMap).filter(v => v > 0).length
  const completed = Object.values(progressMap).filter(v => v === 100).length
  const pathsDone = paths.filter(p => p.resourceIds.length > 0 && p.resourceIds.every(id => (progressMap[id]??0) === 100)).length
  if (started === 0) return null
  return (
    <div className="grid grid-cols-3 gap-3 mb-7">
      {[
        { val: started,   label: 'Started',        href: '/progress', color: 'text-[#5855D6]', bg: 'bg-[#EEEEFF]' },
        { val: completed, label: 'Completed',       href: '/progress', color: 'text-emerald-700', bg: 'bg-emerald-50' },
        { val: pathsDone, label: 'Paths finished',  href: '/curriculum', color: 'text-amber-700', bg: 'bg-amber-50' },
      ].map(s => (
        <Link key={s.label} to={s.href}
          className="group flex items-center gap-3 bg-white border border-zinc-100 rounded-xl p-3.5 hover:border-zinc-200 hover:shadow-card transition-all">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-extrabold text-base', s.bg, s.color)}>
            {s.val}
          </div>
          <p className="text-xs text-zinc-500 group-hover:text-zinc-700 transition-colors font-medium">{s.label}</p>
        </Link>
      ))}
    </div>
  )
}



// ── Join classroom widget — student only ──────────────────────────────────────
function JoinClassroomWidget() {
  const { user, profile } = useAuth()
  const [code, setCode]         = useState('')
  const [status, setStatus]     = useState<'idle'|'loading'|'success'|'error'>('idle')
  const [message, setMessage]   = useState('')
  const [hasClass, setHasClass] = useState<boolean | null>(null)

  // Check if already in a classroom
  useEffect(() => {
    if (!user || profile?.role === 'teacher') return
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/classroom/my-assignments', {
          headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` }
        })
        if (res.ok) {
          const { data } = await res.json()
          // If they have any assignments, they're in a class
          setHasClass(Array.isArray(data) && data.length > 0)
        } else {
          setHasClass(false)
        }
      } catch { setHasClass(false) }
    }
    check()
  }, [user, profile])

  if (!user || profile?.role === 'teacher') return null
  if (hasClass === null) return null   // still loading
  if (hasClass === true) return null   // already in a class, assignments widget handles this

  const handleJoin = async () => {
    if (code.trim().length < 4) return
    setStatus('loading')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/classroom/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ code: code.trim().toUpperCase() })
      })
      const json = await res.json()
      if (res.ok) {
        setStatus('success')
        setMessage(json.alreadyJoined ? 'Youre already in this classroom.' : 'Youve joined the classroom! Your teacher can now assign you work.')
        setHasClass(true)
      } else {
        setStatus('error')
        setMessage(json.detail ?? 'Code not found. Double-check with your teacher.')
      }
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Try again.')
    }
  }

  if (status === 'success') return (
    <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl mb-6">
      <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5"/>
      <div>
        <p className="text-sm font-bold text-emerald-800">Joined!</p>
        <p className="text-xs text-emerald-700 mt-0.5">{message}</p>
      </div>
    </div>
  )

  return (
    <div className="p-4 bg-white border border-zinc-200 rounded-2xl mb-6">
      <p className="text-sm font-bold text-zinc-900 mb-0.5">Join your classroom</p>
      <p className="text-xs text-zinc-400 mb-3">
        Ask your teacher for the 6-character class code.
      </p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase().slice(0, 6)); setStatus('idle') }}
          placeholder="e.g. AB3X9K"
          maxLength={6}
          className="flex-1 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-mono font-bold tracking-widest text-zinc-900 uppercase placeholder:normal-case placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-[#5855D6] focus:ring-1 focus:ring-[#5855D6]"
        />
        <button
          onClick={handleJoin}
          disabled={code.trim().length < 4 || status === 'loading'}
          className={cn(
            'px-4 py-2.5 rounded-xl text-sm font-bold transition-all',
            code.trim().length >= 4
              ? 'bg-[#5855D6] text-white hover:bg-[#4744C8]'
              : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
          )}>
          {status === 'loading' ? '…' : 'Join'}
        </button>
      </div>
      {status === 'error' && (
        <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5">
          <AlertCircle size={12}/> {message}
        </p>
      )}
    </div>
  )
}

// ── Student assignments widget ────────────────────────────────────────────────
interface StudentAssignment {
  id: string; title: string; content_type: string
  due_date?: string; note?: string; completed: boolean
  content_id: string
}

function MyAssignmentsWidget() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<StudentAssignment[]>([])
  const [loading, setLoading]         = useState(true)
  const [marking, setMarking]         = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token ?? ''
        const res = await fetch('/api/classroom/my-assignments', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const { data } = await res.json()
          setAssignments(data ?? [])
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [user])

  const markDone = async (assignmentId: string) => {
    setMarking(assignmentId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      await fetch(`/api/classroom/assignments/${assignmentId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setAssignments(prev =>
        prev.map(a => a.id === assignmentId ? { ...a, completed: true } : a)
      )
    } catch {}
    setMarking(null)
  }

  const getHref = (a: StudentAssignment) => {
    if (a.content_type === 'exercise') return `/playground/${a.content_id}`
    if (a.content_type === 'path')     return `/paths/${a.content_id}`
    if (a.content_type === 'activity') return `/activities/${a.content_id}`
    return `/content/${a.content_id}`
  }

  const TYPE_ICON: Record<string, string> = {
    resource: '📚', exercise: '🧪', path: '🗺️', activity: '📝'
  }
  const TYPE_COLOR: Record<string, string> = {
    resource: 'bg-blue-50 text-blue-700',
    exercise: 'bg-amber-50 text-amber-700',
    path:     'bg-violet-50 text-violet-700',
    activity: 'bg-emerald-50 text-emerald-700',
  }

  if (!user || loading) return null

  const pending   = assignments.filter(a => !a.completed)
  const completed = assignments.filter(a => a.completed)

  if (assignments.length === 0) return null

  const isOverdue = (due?: string) => due && new Date(due) < new Date()
  const formatDue = (due: string) => {
    const d = new Date(due)
    const today = new Date()
    const diff  = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, cls: 'text-red-600 font-bold' }
    if (diff === 0) return { label: 'Due today',  cls: 'text-orange-600 font-bold' }
    if (diff === 1) return { label: 'Due tomorrow', cls: 'text-amber-600 font-semibold' }
    return { label: `Due ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, cls: 'text-zinc-400' }
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-bold text-zinc-900">Assigned to you</h2>
          {pending.length > 0 && (
            <span className="text-2xs font-bold text-white bg-[#5855D6] px-2 py-0.5 rounded-full">
              {pending.length} pending
            </span>
          )}
        </div>
        {completed.length > 0 && (
          <span className="text-xs text-zinc-400">{completed.length} done</span>
        )}
      </div>

      <div className="space-y-2.5">
        {pending.map(a => {
          const due = a.due_date ? formatDue(a.due_date) : null
          return (
            <div key={a.id}
              className={cn(
                'flex items-center gap-3 p-4 bg-white border rounded-xl transition-all',
                isOverdue(a.due_date) ? 'border-red-200 bg-red-50/40' : 'border-zinc-200 hover:border-zinc-300 hover:shadow-card'
              )}>
              <span className={cn('text-2xs font-bold px-2 py-1 rounded-full flex-shrink-0', TYPE_COLOR[a.content_type] ?? 'bg-zinc-100 text-zinc-600')}>
                {TYPE_ICON[a.content_type] ?? '📄'} {a.content_type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-800 truncate">{a.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {due && <span className={cn('text-2xs', due.cls)}>{due.label}</span>}
                  {a.note && <span className="text-2xs text-zinc-400 truncate max-w-[200px]">{a.note}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link to={getHref(a)}
                  className="px-3 py-1.5 text-2xs font-bold text-[#5855D6] border border-[#C0BFEF] rounded-lg hover:bg-[#EEEEFF] transition-colors">
                  Open →
                </Link>
                <button
                  onClick={() => markDone(a.id)}
                  disabled={marking === a.id}
                  className="px-3 py-1.5 text-2xs font-bold text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50">
                  {marking === a.id ? '…' : '✓ Done'}
                </button>
              </div>
            </div>
          )
        })}

        {completed.length > 0 && pending.length === 0 && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0"/>
            <p className="text-sm font-semibold text-emerald-800">
              All {completed.length} assignment{completed.length !== 1 ? 's' : ''} done! Great work.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

export function HomePage() {
  const [paths, setPaths]       = useState<LearningPath[]>([])
  const [resources, setRes]     = useState<Resource[]>([])
  const [tools, setTools]       = useState<any[]>([])
  const [allResources, setAllR] = useState<Resource[]>([])
  const { profile }  = useAuth()
  const { progressMap } = useProgress()
  const userName = profile?.full_name?.split(' ')[0] ?? null

  useEffect(() => {
    api.resources.list({ featured:true, limit:12 }).then(r => setRes(r.data)).catch(() => {})
    api.resources.list({ limit:200 }).then(r => setAllR(r.data)).catch(() => {})
    api.paths.list().then(r => setPaths(r.data)).catch(() => {})
    api.tools.list().then(r => setTools(r.data)).catch(() => {})
  }, [])

  // Recommend resources the user hasn't touched yet, matching their onboarding topics
  const recommended = useMemo(() => {
    const onboard = getOnboardingProfile()
    const goals   = onboard?.goals ?? []
    const untouched = allResources.filter(r => !progressMap[r.id])
    if (goals.length === 0) return untouched.slice(0, 6)
    const scored = untouched.map(r => ({
      r,
      score: r.topics.filter(t => goals.some(g => g.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(g.toLowerCase()))).length
    }))
    return scored.sort((a,b) => b.score - a.score).slice(0, 6).map(s => s.r)
  }, [allResources, progressMap])

  const hasProgress = Object.values(progressMap).some(v => v > 0)

  const isTeacher = profile?.role === 'teacher'

  return (
    <div className="px-4 lg:px-8 py-6 max-w-6xl mx-auto">
      <OSHero name={userName ?? undefined}/>
      {!isTeacher && <JoinClassroomWidget/>}
      {!isTeacher && <MyAssignmentsWidget/>}
      {isTeacher && (
        <div className="mb-6 p-4 bg-indigo-50 border border-[#DDDDF8] rounded-2xl flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#4744C8] mb-0.5">Your classroom</p>
            <p className="text-xs text-zinc-500">Manage students, assignments, and track progress.</p>
          </div>
          <a href="/classroom"
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-[#5855D6] text-white text-xs font-bold rounded-xl hover:bg-[#4744C8] transition-colors">
            Open Classroom →
          </a>
        </div>
      )}
      <ProgressStatBar progressMap={progressMap} paths={paths}/>
      <DailyFocus progressMap={progressMap} paths={paths} resources={allResources}/>
      <CapabilityModules/>
      <PersonalisedBanner/>
      {hasProgress && recommended.length > 0 && (
        <section className="mb-8">
          <SectionHeading title="Recommended for you" action={
            <Link to="/browse" className="text-xs text-[#5855D6] hover:text-[#4744C8] font-semibold flex items-center gap-1">Browse all <ChevronRight size={12}/></Link>
          }/>
          <ContentGrid resources={recommended}/>
        </section>
      )}
      <LearningPathStrip paths={paths.filter(p => !p.board).slice(0,8)}/>
      <ToolGuideStrip tools={tools}/>
      {!hasProgress && (
        <section className="mb-8">
          <SectionHeading title="Featured resources" action={
            <Link to="/browse" className="text-xs text-[#5855D6] hover:text-[#4744C8] font-semibold flex items-center gap-1">Browse all <ChevronRight size={12}/></Link>
          }/>
          <ContentGrid resources={resources}/>
        </section>
      )}
      <OnboardingModal/>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// BROWSE PAGE
// ══════════════════════════════════════════════════════════════════════════════

// Alias — App.tsx routes /dashboard to DashboardPage
export const DashboardPage = HomePage

