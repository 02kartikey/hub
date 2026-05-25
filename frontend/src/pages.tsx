/**
 * pages.tsx — every page/route in one file
 * Routes:
 *   /               HomePage
 *   /browse         BrowsePage
 *   /content/:id    ContentPage  (resource detail + AI assistant split-screen)
 *   /paths/:id      PathPage
 *   /playground     PlaygroundPage
 *   /playground/:id PlaygroundExercisePage
 *   /activities     ActivitiesPage
 *   /activities/:id ActivityDetailPage
 *   /assessment     AssessmentPage  (topic picker)
 *   /assessment/:pathId  QuizPage
 *   /curriculum     CurriculumPage
 *   /seminars       SeminarsPage
 *   /workflows      WorkflowsPage
 *   /tools          ToolsPage
 *   /tools/:id      ToolDetailPage
 *   /teacher        TeacherPage
 *   /dashboard      DashboardPage
 *   /chat           ChatPage
 *   /auth/login     LoginPage
 *   /badges         BadgesPage
 *   /auth/signup    SignupPage
 *   /not-found      NotFoundPage
 */

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Brain, FlaskConical, Users, Video, Globe, GraduationCap,
  MessageSquare, ArrowRight, ArrowLeft, Play,
  ExternalLink, Clock, Star, Users as UsersIcon, AlertCircle, Check, CheckCircle2, X, ChevronRight,
  RotateCcw, Send, Lightbulb, Filter, Search, GitBranch, Award, Target, Zap,
  TrendingUp, BookOpen, BarChart2, AlertTriangle, Plus, Copy} from 'lucide-react'
import { cn, Badge, Button, ProgressBar, Spinner, EmptyState, TypingDots } from './ui'
import {
  AppShell, OSHero, CapabilityModules, PersonalisedBanner,
  LearningPathStrip, ToolGuideStrip, ContentGrid, FilterRow, ContentCard,
  StageChat, StageProgress, DeepAnalysis, OnboardingModal,
  OnboardingFlow, ResourceAssistant, SmartThumbnail, ResourceBanner,
  ToolLettermark, SpotlightTour, CONCEPT_TOPICS} from './components'
import { api } from './api'
import type { Assignment, StudentRow, Classroom } from './api'
import type { Resource, LearningPath, ClassroomActivity, DeepExercise, Message } from './types'
import type { PathQuiz, QuizQuestion } from './api'
import { useAuth, useProgress, useBookmarks, getOnboardingProfile, supabase } from './auth'
import { checkAndAward, awardBadge, useBadges, BadgeCard, BADGES, getEarnedBadges, BadgesPage } from './badges'

// ── tiny helpers ────────────────────────────────────────────────────────────
function useFetch<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData]     = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    fn().then(d => { if (!cancelled) { setData(d); setLoading(false) } })
        .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, loading, error }
}

function PageLoader() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden" style={{ border:'1px solid var(--border)' }}>
          <div className="bg-zinc-100" style={{ aspectRatio:'16/9' }}/>
          <div className="p-4 space-y-2.5">
            <div className="h-2 bg-zinc-100 rounded-full w-1/3"/>
            <div className="h-3.5 bg-zinc-100 rounded-full w-full"/>
            <div className="h-3.5 bg-zinc-100 rounded-full w-4/5"/>
            <div className="h-2 bg-zinc-100 rounded-full w-1/2 mt-3"/>
          </div>
        </div>
      ))}
    </div>
  )
}
function PageError({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
          <AlertCircle size={20} className="text-signal-red"/>
        </div>
        <p className="text-sm font-semibold text-zinc-700">{msg}</p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED LAYOUT PRIMITIVES — consistent typography across all pages
// ══════════════════════════════════════════════════════════════════════════════

/** Consistent page header used on every page for typographic unity */
function PageHeader({
  eyebrow, title, subtitle, children,
  eyebrowIcon, eyebrowColor,
}: {
  eyebrow?: string; title: string; subtitle?: string
  children?: ReactNode; eyebrowIcon?: ReactNode; eyebrowColor?: string
}) {
  return (
    <div className="mb-7">
      <h1 className="font-extrabold tracking-tight mb-1.5" style={{ fontSize:28, color:'var(--text-1)', lineHeight:1.2 }}>{title}</h1>
      {subtitle && <p style={{ fontSize:14, color:'var(--text-3)', lineHeight:1.6, maxWidth:520 }}>{subtitle}</p>}
      {children}
    </div>
  )
}

/** Consistent section heading inside pages */
function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-bold flex items-center gap-2" style={{ fontSize:13.5, color:'var(--text-1)' }}>
        {title}
      </h2>
      {action}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
// START HERE BANNER — role-aware first-action for users with zero progress
// ══════════════════════════════════════════════════════════════════════════════

const START_HERE_PATHS: Record<string, { pathId: string; title: string; why: string; cta: string }> = {
  student:  { pathId:'lp1', title:'AI Fundamentals',          why:'The best starting point for any student. Understand how AI actually works in 3.5h.',  cta:'Start learning' },
  teacher:  { pathId:'lp3', title:'AI for Classroom Teachers', why:'Built specifically for educators — lesson integration, ethical use, CBSE alignment.', cta:'Start this path' },
  curious:  { pathId:'lp2', title:'Prompting That Actually Works', why:'The fastest way to go from casual user to confident AI operator.',               cta:'Start exploring' },
}

function StartHereBanner({ role = 'student', progressCount = 0 }: { role?: string; progressCount?: number }) {
  const navigate = useNavigate()
  if (progressCount > 0) return null  // only show when nothing has been started
  const rec = START_HERE_PATHS[role] ?? START_HERE_PATHS.student

  return (
    <div className="relative rounded-2xl overflow-hidden mb-8 border border-[#C0BFEF]"
      style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 50%, #FAF5FF 100%)' }}>
      {/* Subtle pattern */}
      <div className="absolute inset-0 opacity-[0.4]"
        style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(99,102,241,0.12) 0%, transparent 60%)' }}/>
      <div className="relative flex flex-wrap items-center gap-6 p-6">
        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-[#5855D6] flex items-center justify-center flex-shrink-0 shadow-lg">
          <Zap size={24} className="text-white"/>
        </div>
        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-bold uppercase tracking-widest text-[#5855D6] mb-1">Start here</p>
          <h2 className="text-base font-extrabold text-zinc-900 tracking-tight mb-1">{rec.title}</h2>
          <p className="text-sm text-zinc-500 leading-relaxed max-w-md">{rec.why}</p>
        </div>
        {/* CTA */}
        <button onClick={() => navigate(`/paths/${rec.pathId}`)}
          className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-3 bg-[#5855D6] text-white text-sm font-bold rounded-xl hover:bg-[#4744C8] transition-colors shadow-sm">
          {rec.cta} <ArrowRight size={14}/>
        </button>
      </div>
    </div>
  )
}

function StartHereBannerHome() {
  const { profile } = useAuth()
  const { progressMap } = useProgress()
  return <StartHereBanner role={profile?.role ?? 'student'} progressCount={Object.values(progressMap).filter(v => v > 0).length}/>
}

// ══════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ══════════════════════════════════════════════════════════════════════════════

export function HomePage() {
  const [paths, setPaths]   = useState<LearningPath[]>([])
  const [resources, setRes] = useState<Resource[]>([])
  const [tools, setTools]   = useState<any[]>([])
  const { profile } = useAuth()
  const userName = profile?.full_name?.split(' ')[0] ?? null

  useEffect(() => {
    api.resources.list({ featured:true, limit:12 }).then(r => setRes(r.data)).catch(() => {})
    api.paths.list().then(r => setPaths(r.data)).catch(() => {})
    api.tools.list().then(r => setTools(r.data)).catch(() => {})
  }, [])

  return (
    <div className="px-4 lg:px-8 py-6 max-w-6xl mx-auto">
      <OSHero name={userName ?? undefined}/>
      <StartHereBannerHome/>
      <CapabilityModules/>
      <PersonalisedBanner/>
      <LearningPathStrip paths={paths.filter(p => !p.board).slice(0,8)}/>
      <ToolGuideStrip tools={tools}/>
      <section className="mb-8">
        <SectionHeading title="Featured resources" action={
          <Link to="/browse" className="text-xs text-[#5855D6] hover:text-[#4744C8] font-semibold flex items-center gap-1">Browse all <ChevronRight size={12}/></Link>
        }/>
        <ContentGrid resources={resources}/>
      </section>
      <OnboardingModal/>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// BROWSE PAGE
// ══════════════════════════════════════════════════════════════════════════════

export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [resources, setRes] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [filters, setFilters] = useState<Record<string, string>>({
    type: searchParams.get('type') ?? '',
    topic: searchParams.get('topic') ?? '',
    difficulty: searchParams.get('difficulty') ?? '',
    audience: searchParams.get('audience') ?? '',
    board: searchParams.get('board') ?? '',
    language: searchParams.get('language') ?? ''})

  const load = useCallback(() => {
    setLoading(true)
    const clean = Object.fromEntries(Object.entries(filters).filter(([,v]) => v))
    // Sync to URL so back button restores filters
    const params: Record<string,string> = {}
    if (search) params.q = search
    Object.entries(clean).forEach(([k,v]) => { params[k] = v as string })
    setSearchParams(params, { replace: true })
    api.resources.list({ ...clean, search: search || undefined, limit:120 })
      .then(r => { setRes(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filters, search, setSearchParams])

  useEffect(() => { load() }, [load])

  const total = resources.length

  return (
    <div className="px-4 lg:px-8 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-extrabold tracking-tight mb-1" style={{ fontSize: 28, color: 'var(--text-1)' }}>Browse resources</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)' }}>
          {total > 0 ? `${total} resource${total !== 1 ? 's' : ''} — videos, books, courses, and guides.` : 'Curated resources across every AI topic.'}
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Search resources…"
            className="pl-9 pr-4 py-2 bg-white rounded-xl focus:outline-none focus:ring-2 transition-shadow"
            style={{ fontSize: 13.5, border: '1px solid var(--border)', width: 220,
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}/>
        </div>
        <FilterRow filters={filters} onChange={setFilters}/>
      </div>

      {loading ? <PageLoader/> : <ContentGrid resources={resources}/>}
    </div>
  )
}


// Completion button that awards badges and shows confetti on first-time complete
function BadgeAwardingCompleteButton({ resource, done, markComplete }: {
  resource: Resource; done: boolean; markComplete: (id: string, complete: boolean) => void
}) {
  const { progressMap } = useProgress()
  const [burst, setBurst] = useState(false)

  const handleClick = () => {
    const wasNotDone = !done
    markComplete(resource.id, !done)
    if (wasNotDone) {
      setBurst(true); setTimeout(() => setBurst(false), 1200)
      // Compute completion count AFTER this mark
      const completedCount = Object.values(progressMap).filter(p => p === 100).length + 1
      const newBadges = checkAndAward({ progressMap: { ...progressMap, [resource.id]: 100 }, pathsCompleted: 0 })
      if (newBadges.length) window.dispatchEvent(new CustomEvent('aihub:badges', { detail: newBadges }))
      // Check night owl
      const hour = new Date().getHours()
      if (hour >= 22 || hour < 4) {
        const nb2 = checkAndAward({ progressMap: { ...progressMap, [resource.id]: 100 }, pathsCompleted: 0 })
        if (nb2.length) window.dispatchEvent(new CustomEvent('aihub:badges', { detail: nb2 }))
      }
    }
  }

  return (
    <div className="relative">
      <button onClick={handleClick}
        className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
          done ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
               : burst ? 'bg-emerald-500 text-white scale-105'
               : 'bg-ink-900 text-white hover:bg-ink-800')}>
        {done ? <><CheckCircle2 size={15}/> Completed</> : burst ? <><Check size={15}/> Done!</> : <><Check size={15}/> Mark complete</>}
      </button>
      {burst && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
          {Array.from({length:6}).map((_,i) => (
            <div key={i} className="absolute w-1.5 h-1.5 rounded-full animate-ping"
              style={{
                background: ['#6366F1','#F59E0B','#10B981','#F472B6','#60A5FA','#34D399'][i],
                left: `${15 + i * 12}%`, top: `${20 + (i%3)*20}%`,
                animationDelay: `${i * 80}ms`, animationDuration: '600ms',
              }}/>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT PAGE — resource detail + AI assistant split-screen
// ══════════════════════════════════════════════════════════════════════════════

export function ContentPage() {
  const { id } = useParams<{ id: string }>()
  const { data: resource, loading, error } = useFetch(() => api.resources.get(id!), [id])
  const [showAssistant, setShowAssistant] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false)
  const { markComplete, isComplete } = useProgress()

  if (loading) return <PageLoader/>
  if (error || !resource) return <PageError msg={error ?? 'Resource not found'}/>

  const isVideo = resource.type === 'video' || resource.type === 'seminar'
  const done = isComplete(resource.id)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6">
          {/* Back */}
          <Link to="/browse" className="inline-flex items-center gap-1.5 font-medium hover:text-zinc-700 mb-4 transition-colors" style={{ fontSize:13, color:"var(--text-3)" }}>
            <ArrowLeft size={13}/> Back to browse
          </Link>

          {/* ── Resource Banner ─────────────────────────────────────────
               ResourceBanner handles all types consistently:
               - Non-video: rich gradient banner with "Open" CTA built in
               - Video with youtubeId: banner shows thumbnail before iframe
               - Video without youtubeId: gradient banner
          ─────────────────────────────────────────────────────────── */}
          <ResourceBanner resource={resource}/>

          {/* Video embed — shown below banner for video types */}
          {isVideo && resource.youtubeId && (
            <div className="aspect-video rounded-2xl overflow-hidden bg-black mb-6 shadow-sm">
              <iframe
                src={`https://www.youtube.com/embed/${resource.youtubeId}?rel=0&modestbranding=1`}
                className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                title={resource.title}/>
            </div>
          )}

          {/* Title & meta — badges + author line */}
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <Badge variant={resource.type as any}/>
                <Badge variant={resource.difficulty as any}/>
                {resource.audience !== 'both' && <Badge variant={resource.audience as any}/>}
                {resource.freeAccess && <Badge variant="green">Free</Badge>}
                {resource.boards?.map(b => <Badge key={b} variant="blue">{b}</Badge>)}
              </div>
              <h1 className="text-xl font-extrabold text-zinc-900 leading-tight mb-1 tracking-tight">{resource.title}</h1>
              {resource.author && <p className="text-sm text-zinc-500">by {resource.author} · {resource.source}</p>}
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-zinc-600 leading-relaxed mb-6">{resource.description}</p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 text-xs text-zinc-500 mb-6 pb-6 border-b border-zinc-100">
            {resource.duration && <span className="flex items-center gap-1.5"><Clock size={13}/> {resource.duration}</span>}
            <span className="flex items-center gap-1.5"><Star size={13} className="text-amber-400 fill-amber-400"/> {resource.rating} · {resource.completionCount.toLocaleString()} completed</span>
            {resource.year && <span>{resource.year}</span>}
          </div>

          {/* Board alignment */}
          {(resource.cbseUnit || resource.igcseSection || resource.ibConcept) && (
            <div className="bg-zinc-50 rounded-xl p-4 mb-6 space-y-2">
              <h3 className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">Curriculum alignment</h3>
              {resource.cbseUnit && <p className="text-sm text-zinc-600"><span className="font-medium">CBSE:</span> {resource.cbseUnit}</p>}
              {resource.igcseSection && <p className="text-sm text-zinc-600"><span className="font-medium">IGCSE:</span> {resource.igcseSection}</p>}
              {resource.ibConcept && <p className="text-sm text-zinc-600"><span className="font-medium">IB concepts:</span> {resource.ibConcept}</p>}
            </div>
          )}

          {/* Mark complete */}
          <div className="flex items-center gap-3">
            <BadgeAwardingCompleteButton resource={resource} done={done} markComplete={markComplete}/>
            {!isVideo && (
              <a href={resource.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors">
                Open <ExternalLink size={13}/>
              </a>
            )}
            <button onClick={() => setShowAssistant(v => !v)}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ml-auto',
                showAssistant ? 'border-accent-300 text-[#4744C8] bg-[#EEEEFF] hover:bg-[#DDDDF8]' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50')}>
              <MessageSquare size={14}/> {showAssistant ? 'Hide' : 'Ask AI'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Assistant panel */}
      {showAssistant && <ResourceAssistant resource={resource} onClose={() => setShowAssistant(false)}/>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PATH PAGE
// ══════════════════════════════════════════════════════════════════════════════

export function PathPage() {
  const { id } = useParams<{ id: string }>()
  const [path, setPath] = useState<(LearningPath & { resources: Resource[] }) | null>(null)
  const [quiz, setQuiz]   = useState<PathQuiz | null>(null)
  const [loading, setLoading] = useState(true)
  const { getProgress } = useProgress()
  const navigate = useNavigate()

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.paths.get(id),
      api.quizzes.get(id).catch(() => null),
    ]).then(([p, q]) => {
      setPath(p); setQuiz(q); setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) return <PageLoader/>
  if (!path) return <PageError msg="Path not found"/>

  const completed = path.resources.filter(r => getProgress(r.id) === 100).length
  const progress = path.resources.length ? Math.round((completed / path.resources.length) * 100) : 0

  return (
    <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">
      <Link to="/curriculum" className="inline-flex items-center gap-1.5 font-medium hover:text-zinc-700 mb-5 transition-colors" style={{ fontSize:13, color:"var(--text-3)" }}>
        <ArrowLeft size={13}/> Back to curriculum
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0', path.accentColor)}>
          <Brain size={20}/>
        </div>
        <div className="flex-1 min-w-0">
          {path.board && <p className="text-2xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">{path.board} · {path.boardUnit}</p>}
          <h1 className="text-2xl font-extrabold text-zinc-900 mb-1 tracking-tight leading-snug">{path.title}</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">{path.description}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-zinc-400">
            <span className="flex items-center gap-1"><Clock size={12}/> {path.estimatedHours}h estimated</span>
            <span className="flex items-center gap-1"><UsersIcon size={12}/> {path.completedByCount.toLocaleString()} completed</span>
            <span className="flex items-center gap-1"><Star size={12} className="text-amber-400 fill-amber-400"/> {path.rating}</span>
            <Badge variant={path.difficulty as any}/>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {progress > 0 && (
        <div className="mb-6 p-4 bg-white border border-zinc-200 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-zinc-700">Your progress</span>
            <span className="text-sm font-semibold text-zinc-900">{progress}%</span>
          </div>
          <ProgressBar value={progress} size="md"/>
          <p className="text-xs text-zinc-400 mt-1.5">{completed} of {path.resources.length} resources completed</p>
        </div>
      )}

      {/* Resources list */}
      <div className="space-y-3 mb-8">
        <h2 className="text-sm font-semibold text-zinc-800">{path.resources.length} resources in this path</h2>
        {path.resources.map((r, i) => (
          <Link key={r.id} to={`/content/${r.id}`}
            className="flex items-center gap-3 p-3 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 hover:shadow-sm transition-all group">
            <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-[11px] font-bold text-zinc-500 flex-shrink-0">{i+1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-800 group-hover:text-[#5855D6] transition-colors truncate">{r.title}</p>
              <p className="text-xs text-zinc-400">{r.author} · <Badge variant={r.type as any}/></p>
            </div>
            {r.duration && <span className="text-xs text-zinc-400 flex-shrink-0">{r.duration}</span>}
            <ChevronRight size={14} className="text-zinc-300 group-hover:text-[#5855D6] flex-shrink-0 transition-colors"/>
          </Link>
        ))}
      </div>

      {/* Quiz CTA */}
      {quiz && (
        <div className="bg-ink-900 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Award size={16} className="text-amber-400"/>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Assessment available</span>
          </div>
          <h3 className="text-lg font-extrabold text-zinc-900 mb-1 tracking-tight">{quiz.title}</h3>
          <p className="text-sm text-white/60 mb-4">{quiz.questions.length} questions · Pass at {quiz.passingScore}%</p>
          <button onClick={() => navigate(`/assessment/${id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 rounded-lg text-sm font-semibold hover:bg-zinc-100 transition-colors">
            Take the quiz <ArrowRight size={14}/>
          </button>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PLAYGROUND — exercise list
// ══════════════════════════════════════════════════════════════════════════════

export function PlaygroundPage() {
  const { data, loading } = useFetch(() => api.exercises.list(), [])

  return (
    <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">
      <div className="mb-7">
        <h1 className="font-extrabold tracking-tight mb-1.5" style={{ fontSize:28, color:'var(--text-1)' }}>
          AI Playground
        </h1>
        <p style={{ fontSize:14, color:'var(--text-3)', maxWidth:520, lineHeight:1.6 }}>
          Hands-on experiments that put you in direct contact with AI systems exhibiting real behaviours — hallucination, bias, sycophancy. Observe. Probe. Understand.
        </p>
      </div>

      {loading && <PageLoader/>}

      {!loading && data && (
        <div className="grid sm:grid-cols-2 gap-4">
          {data.data.map((exercise, i) => (
            <Link key={exercise.id} to={`/playground/${exercise.id}`}
              className="group relative bg-white border border-zinc-200 rounded-2xl p-6 hover:shadow-card-hover hover:border-zinc-300 transition-all duration-200 overflow-hidden flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', exercise.badgeColor)}>
                  {exercise.concept}
                </span>
                {exercise.isPro && <Badge variant="purple">Pro</Badge>}
              </div>
              <h3 className="text-base font-semibold text-zinc-900 mb-1.5 group-hover:text-[#5855D6] transition-colors">
                {exercise.title}
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed mb-4 line-clamp-2">{exercise.tagline}</p>
              {exercise.whatYouWillLearn?.length > 0 && (
                <div className="mb-4 space-y-1.5">
                  {exercise.whatYouWillLearn.slice(0, 2).map((item: string, j: number) => (
                    <p key={j} className="text-xs text-zinc-500 flex items-start gap-1.5">
                      <CheckCircle2 size={11} className="text-signal-green flex-shrink-0 mt-0.5"/>
                      <span className="line-clamp-1">{item}</span>
                    </p>
                  ))}
                </div>
              )}
              <div className="mt-auto flex items-center gap-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1"><Clock size={11}/> {exercise.estimatedMinutes} min</span>
                <Badge variant={exercise.difficulty as any}/>
                <span className="ml-auto flex items-center gap-1 text-[#5855D6] group-hover:gap-2 transition-all font-medium">
                  Start <ArrowRight size={12}/>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PLAYGROUND EXERCISE PAGE — stage-by-stage + deep analysis
// ══════════════════════════════════════════════════════════════════════════════

export function PlaygroundExercisePage() {
  const { id } = useParams<{ id: string }>()
  const { data: exercise, loading, error } = useFetch(() => api.exercises.get(id!), [id])
  const [currentStage, setCurrentStage] = useState(0)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [relevantResources, setRelevantResources] = useState<Resource[]>([])
  const navigate = useNavigate()

  // Fetch platform resources relevant to this exercise's concept
  useEffect(() => {
    if (!exercise) return
    const topics = CONCEPT_TOPICS[exercise.concept] || ['How AI works']
    const fetches = topics.slice(0, 2).map(topic => api.resources.list({ topic, limit: 6 }))
    Promise.all(fetches)
      .then(results => {
        const seen = new Set<string>()
        const merged: Resource[] = []
        for (const r of results) {
          for (const item of r.data) {
            if (!seen.has(item.id)) { seen.add(item.id); merged.push(item) }
          }
        }
        setRelevantResources(merged.slice(0, 8))
      })
      .catch(() => {})
  }, [exercise?.concept])

  if (loading) return <PageLoader/>
  if (error || !exercise) return <PageError msg={error ?? 'Exercise not found'}/>

  const allDone = completed.size === exercise.stages.length
  if (showAnalysis) {
    return (
      <div className="flex flex-col h-full">
        <DeepAnalysis
          exercise={exercise}
          relevantResources={relevantResources}
          onRepeat={() => { setShowAnalysis(false); setCurrentStage(0); setCompleted(new Set()) }}
          onNext={() => navigate('/playground')}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Slim exercise header — breadcrumb + meta + compact stage progress */}
      <div className="flex-shrink-0 bg-white border-b border-zinc-100">
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-50">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/playground" className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1 flex-shrink-0 transition-colors">
              <ArrowLeft size={11}/> Playground
            </Link>
            <span className="text-zinc-200 flex-shrink-0">/</span>
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0', exercise.badgeColor)}>{exercise.concept}</span>
            <span className="text-zinc-200 flex-shrink-0 hidden sm:block">/</span>
            <span className="text-xs font-medium text-zinc-600 truncate hidden sm:block">{exercise.title}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <span className="text-2xs text-zinc-400 flex items-center gap-1">
              <Clock size={10}/> {exercise.estimatedMinutes}m
            </span>
            <Badge variant={exercise.difficulty as any}/>
          </div>
        </div>
        <div className="px-5 py-2.5">
          <StageProgress
            stages={exercise.stages}
            currentStageIdx={currentStage}
            completedStages={completed}
            onSelect={i => setCurrentStage(i)}
          />
        </div>
      </div>

      {/* Stage chat — fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <StageChat
          key={`${exercise.id}-${currentStage}`}
          exercise={exercise}
          stage={exercise.stages[currentStage]}
          stageIndex={currentStage}
          totalStages={exercise.stages.length}
          completedStages={completed}
          relevantResources={relevantResources}
          isCompleted={completed.has(currentStage)}
          onStageComplete={() => {
            const next = new Set(completed)
            next.add(currentStage)
            setCompleted(next)
            if (currentStage < exercise.stages.length - 1) {
              setCurrentStage(currentStage + 1)
            } else {
              setShowAnalysis(true)
            }
          }}
        />
      </div>

      {/* All done shortcut */}
      {allDone && !showAnalysis && (
        <div className="flex-shrink-0 border-t border-zinc-100 px-6 py-4 bg-white">
          <button onClick={() => setShowAnalysis(true)}
            className="w-full py-3 bg-ink-900 text-white text-sm font-semibold rounded-xl hover:bg-ink-800 transition-colors flex items-center justify-center gap-2">
            View deep analysis <ArrowRight size={14}/>
          </button>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVITIES PAGE
// ══════════════════════════════════════════════════════════════════════════════

const TYPE_COLORS: Record<string, string> = {
  debate: 'bg-purple-50 text-purple-700 border-purple-100',
  investigation: 'bg-blue-50 text-blue-700 border-blue-100',
  comparison: 'bg-teal-50 text-teal-700 border-teal-100',
  challenge: 'bg-orange-50 text-orange-700 border-orange-100',
  audit: 'bg-red-50 text-red-700 border-red-100',
  creation: 'bg-emerald-50 text-emerald-700 border-emerald-100'}

export function ActivitiesPage() {
  const { data, loading } = useFetch(() => api.activities.list(), [])
  const [filter, setFilter] = useState<string>('')

  const activities = useMemo(() => {
    if (!data) return []
    return filter ? data.data.filter(a => a.type === filter) : data.data
  }, [data, filter])

  const TYPES = ['debate','investigation','comparison','challenge','audit','creation']

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      <div className="mb-7">
        <h1 className="font-extrabold tracking-tight mb-1.5" style={{ fontSize:28, color:'var(--text-1)' }}>
          Classroom Activities
        </h1>
        <p style={{ fontSize:14, color:'var(--text-3)', maxWidth:520, lineHeight:1.6 }}>
          15 structured exercises that make AI concepts tangible. Each runs in one class period with no special technology required.
        </p>
      </div>

      {/* Type filters — consistent with BrowsePage style */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {['', ...TYPES].map(t => (
          <button key={t} onClick={() => setFilter(t === filter ? '' : t)}
            className="font-semibold rounded-full transition-all duration-150 capitalize"
            style={{ fontSize:12.5, padding:'5px 13px',
              background: filter === t ? '#0A0A0B' : 'white',
              color: filter === t ? 'white' : 'var(--text-2)',
              border: `1px solid ${filter === t ? '#0A0A0B' : 'var(--border)'}`,
              boxShadow: filter === t ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.03)' }}>
            {t || 'All'}
          </button>
        ))}
      </div>

      {loading ? <PageLoader/> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activities.map(act => (
            <Link key={act.id} to={`/activities/${act.id}`}
              className="group relative bg-white border border-zinc-200 rounded-2xl p-6 hover:shadow-card-hover hover:border-zinc-300 transition-all duration-200 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize', TYPE_COLORS[act.type] ?? 'bg-zinc-50 text-zinc-600 border-zinc-100')}>
                  {act.type}
                </span>
                <span className="text-xs text-zinc-400 flex items-center gap-1"><Clock size={11}/> {act.classTime}</span>
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 mb-1 group-hover:text-[#5855D6] transition-colors line-clamp-1">{act.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed mb-3 line-clamp-2">{act.tagline}</p>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span>{act.groupSize}</span>
                <span>·</span>
                <span>{act.steps.length} steps</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVITY DETAIL PAGE
// ══════════════════════════════════════════════════════════════════════════════

export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: act, loading, error } = useFetch(() => api.activities.get(id!), [id])
  const [activeStep, setActiveStep] = useState(0)

  if (loading) return <PageLoader/>
  if (error || !act) return <PageError msg={error ?? 'Activity not found'}/>

  return (
    <div className="px-4 lg:px-8 py-6 max-w-3xl mx-auto">
      <Link to="/activities" className="inline-flex items-center gap-1.5 font-medium hover:text-zinc-700 mb-5 transition-colors" style={{ fontSize:13, color:"var(--text-3)" }}>
        <ArrowLeft size={13}/> All activities
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border capitalize', TYPE_COLORS[act.type] ?? 'bg-zinc-50 text-zinc-600 border-zinc-100')}>
            {act.type}
          </span>
          {act.ageGroups.map(g => <Badge key={g} variant="default" className="capitalize">{g.replace('-',' ')}</Badge>)}
        </div>
        <h1 className="text-2xl font-extrabold text-zinc-900 mb-1 tracking-tight">{act.title}</h1>
        <p className="text-sm text-zinc-500 italic mb-4">{act.tagline}</p>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label:'Duration', value:act.classTime },
            { label:'Groups', value:act.groupSize },
            { label:'Steps', value:`${act.steps.length} steps` },
            { label:'Concepts', value:`${act.conceptsCovered.length} covered` },
          ].map(s => (
            <div key={s.label} className="bg-zinc-50 rounded-xl p-3 text-center">
              <p className="text-sm font-semibold text-zinc-900">{s.value}</p>
              <p className="text-[11px] text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Objective & overview */}
      <div className="space-y-4 mb-6">
        <div className="p-4 bg-[#EEEEFF] border border-brand-100 rounded-xl">
          <p className="text-xs font-semibold text-[#5855D6] uppercase tracking-wide mb-1">Learning objective</p>
          <p className="text-sm text-zinc-700 leading-relaxed">{act.objective}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-800 mb-2">Overview</h3>
          <p className="text-sm text-zinc-600 leading-relaxed">{act.overview}</p>
        </div>
      </div>

      {/* Materials */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-zinc-800 mb-2">Materials needed</h3>
        <ul className="space-y-1">
          {act.materials.map((m, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
              <span className="text-accent-400 mt-0.5 flex-shrink-0">·</span>{m}
            </li>
          ))}
        </ul>
      </div>

      {/* Steps */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-zinc-800 mb-3">Activity steps</h3>
        <div className="space-y-3">
          {act.steps.map((step, i) => (
            <div key={i}
              className={cn('rounded-xl border overflow-hidden transition-all cursor-pointer',
                activeStep === i ? 'border-accent-300 shadow-sm' : 'border-zinc-200 hover:border-zinc-300')}
              onClick={() => setActiveStep(activeStep === i ? -1 : i)}>
              <div className={cn('flex items-center gap-3 px-4 py-3', activeStep === i ? 'bg-[#EEEEFF]' : 'bg-white')}>
                <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  activeStep === i ? 'bg-[#5855D6] text-white' : 'bg-zinc-100 text-zinc-500')}>
                  {i+1}
                </span>
                <span className={cn('text-xs font-semibold flex-1', activeStep === i ? 'text-[#4744C8]' : 'text-zinc-600')}>
                  {step.duration}
                </span>
                <ChevronRight size={14} className={cn('text-zinc-400 transition-transform', activeStep === i && 'rotate-90')}/>
              </div>
              {activeStep === i && (
                <div className="px-4 py-3 border-t border-zinc-100 bg-white">
                  <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{step.instruction}</p>
                  {step.facilitatorNote && (
                    <div className="mt-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                      <p className="text-xs font-semibold text-amber-600 mb-0.5">Facilitator note</p>
                      <p className="text-xs text-amber-800 leading-relaxed">{step.facilitatorNote}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Discussion questions */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-zinc-800 mb-3">Discussion questions</h3>
        <div className="space-y-2">
          {act.discussionQuestions.map((q, i) => (
            <div key={i} className="flex items-start gap-2.5 p-3 bg-zinc-50 rounded-lg">
              <span className="text-[#5855D6] font-bold text-xs flex-shrink-0 mt-0.5">{i+1}</span>
              <p className="text-sm text-zinc-700 leading-relaxed">{q}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Teacher notes */}
      <div className="mb-6">
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap size={14} className="text-amber-600"/>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Teacher notes</p>
          </div>
          <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{act.teacherNotes}</p>
        </div>
      </div>

      {/* Concepts covered */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-800 mb-2">Concepts covered</h3>
        <div className="flex flex-wrap gap-1.5">
          {act.conceptsCovered.map(c => <Badge key={c} variant="default">{c}</Badge>)}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ASSESSMENT PAGE — topic picker
// ══════════════════════════════════════════════════════════════════════════════

export function AssessmentPage() {
  const { data, loading }   = useFetch(() => api.quizzes.list(), [])
  const { data: pathsData } = useFetch(() => api.paths.list(), [])
  const { progressMap }     = useProgress()
  const navigate = useNavigate()

  // Quiz scores stored in localStorage
  const [scores, setScores] = useState<Record<string, number>>({})
  useEffect(() => {
    // Load local first (instant)
    try { setScores(JSON.parse(localStorage.getItem('quiz_scores') ?? '{}')) } catch {}
    // Then hydrate from server (correct across devices)
    ;(async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (!token) return
        const res = await fetch('/api/quiz-results', { headers: { 'Authorization': `Bearer ${token}` } })
        if (!res.ok) return
        const { data } = await res.json() as { data: { path_id: string; score: number }[] }
        if (!Array.isArray(data) || !data.length) return
        const serverScores: Record<string, number> = {}
        data.forEach(r => { serverScores[r.path_id] = r.score })
        // Merge: server wins for persistence, local wins if higher (optimistic local mark)
        setScores(prev => {
          const merged = { ...serverScores }
          Object.entries(prev).forEach(([id, v]) => { if (v > (merged[id] ?? -1)) merged[id] = v })
          try { localStorage.setItem('quiz_scores', JSON.stringify(merged)) } catch {}
          return merged
        })
      } catch {}
    })()
  }, [])

  const quizzes  = data?.data ?? []
  const paths    = pathsData?.data ?? []
  const passed   = quizzes.filter(q => (scores[q.pathId] ?? -1) >= q.passingScore).length
  const total    = quizzes.length

  return (
    <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">

      {/* Dark hero */}
      <div className="relative rounded-2xl overflow-hidden mb-8 px-7 py-8"
        style={{ background:'linear-gradient(135deg,#0A0A0B 0%,#1A1840 55%,#2D2880 100%)' }}>
        <div className="absolute right-0 top-0 w-1/2 h-full pointer-events-none opacity-20"
          style={{ background:'radial-gradient(ellipse at 80% 50%,rgba(139,133,244,0.6) 0%,transparent 70%)' }}/>
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="font-bold uppercase mb-2" style={{ fontSize:11, color:'rgba(255,255,255,0.3)', letterSpacing:'0.12em' }}>Test your knowledge</p>
            <h1 className="font-extrabold text-white tracking-tight mb-1.5" style={{ fontSize:26, lineHeight:1.2 }}>Assessments</h1>
            <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)', maxWidth:360, lineHeight:1.6 }}>
              Each quiz ties to a learning path. Pass to prove mastery.
            </p>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              {[{ label:'Available', val:total },{ label:'Passed', val:passed },{ label:'Remaining', val:total-passed }].map(s => (
                <div key={s.label} className="text-center px-4 py-3 rounded-xl" style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.08)' }}>
                  <p className="font-black text-white leading-none mb-0.5" style={{ fontSize:20 }}>{s.val}</p>
                  <p className="font-medium" style={{ fontSize:10.5, color:'rgba(255,255,255,0.3)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? <PageLoader/> : (
        <div className="space-y-3">
          {quizzes.map(quiz => {
            const score     = scores[quiz.pathId]
            const hasPassed = score !== undefined && score >= quiz.passingScore
            const hasTaken  = score !== undefined
            const path      = paths.find(p => p.id === quiz.pathId)
            const pathPct   = path
              ? Math.round((path.resourceIds.filter(id => (progressMap[id] ?? 0) === 100).length / Math.max(path.resourceIds.length,1)) * 100)
              : 0
            const recommended = pathPct >= 50  // suggest quiz when path is 50%+ done

            return (
              <div key={quiz.pathId}
                className={cn(
                  'group flex items-center gap-4 bg-white border rounded-2xl p-5 hover:shadow-card-hover transition-all duration-200',
                  hasPassed ? 'border-emerald-200' : recommended ? 'border-[#C0BFEF]' : 'border-zinc-200'
                )}>
                {/* Status ring */}
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                  hasPassed ? 'bg-emerald-50' : hasTaken ? 'bg-amber-50' : 'bg-zinc-100'
                )}>
                  {hasPassed
                    ? <CheckCircle2 size={22} className="text-emerald-500"/>
                    : hasTaken
                      ? <RotateCcw size={20} className="text-amber-500"/>
                      : <Target size={20} className="text-zinc-400"/>}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-bold text-zinc-900 group-hover:text-[#5855D6] transition-colors">{quiz.title}</h3>
                    {hasPassed && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-2xs font-bold rounded-full">
                        Passed {score}%
                      </span>
                    )}
                    {!hasPassed && hasTaken && (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-2xs font-bold rounded-full">
                        Last: {score}% — retry
                      </span>
                    )}
                    {recommended && !hasTaken && (
                      <span className="px-2 py-0.5 bg-[#EEEEFF] text-[#4744C8] border border-[#DDDDF8] text-2xs font-bold rounded-full">
                        Ready to attempt
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-2xs text-zinc-400">
                    <span>{quiz.questions.length} questions</span>
                    <span>·</span>
                    <span>Pass at {quiz.passingScore}%</span>
                    {path && <><span>·</span><span>From: {path.title}</span></>}
                  </div>
                  {/* Path progress context */}
                  {path && pathPct > 0 && pathPct < 100 && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 max-w-[120px] h-1 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-400 rounded-full" style={{ width: `${pathPct}%` }}/>
                      </div>
                      <span className="text-2xs text-zinc-400">{pathPct}% of path done</span>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <button onClick={() => navigate(`/assessment/${quiz.pathId}`)}
                  className={cn(
                    'flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors',
                    hasPassed
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-[#5855D6] text-white hover:bg-[#4744C8]'
                  )}>
                  {hasPassed ? 'Retake' : hasTaken ? 'Retry' : 'Start'}
                  <ArrowRight size={11}/>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// QUIZ PAGE — take a specific quiz
// ══════════════════════════════════════════════════════════════════════════════

type QuizState = 'intro'|'active'|'results'

export function QuizPage() {
  const { pathId } = useParams<{ pathId: string }>()
  const { data: quiz, loading, error } = useFetch(() => api.quizzes.get(pathId!), [pathId])
  const navigate = useNavigate()
  const [state, setState] = useState<QuizState>('intro')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [fillInput, setFillInput] = useState('')
  const [results, setResults] = useState<{ score: number; passed: boolean; breakdown: { correct: boolean; explanation: string; yourAnswer: string; correctAnswer: string }[] } | null>(null)

  if (loading) return <PageLoader/>
  if (error || !quiz) return <PageError msg={error ?? 'Quiz not found'}/>

  const q = quiz.questions[current]
  const answered = answers[q?.id ?? ''] !== undefined

  const submitAnswer = (ans: string) => {
    if (!q) return
    setAnswers(prev => ({ ...prev, [q.id]: ans }))
    setFillInput('')
  }

  const grade = async () => {
    const breakdown = quiz.questions.map(qn => {
      const yourAnswer    = String(answers[qn.id] ?? '').trim().toLowerCase()
      const correctAnswer = String(qn.answer ?? '').trim().toLowerCase()
      return {
        correct: yourAnswer === correctAnswer,
        explanation: qn.explanation,
        yourAnswer: answers[qn.id] ?? '(no answer)',
        correctAnswer: qn.answer ?? '(missing answer)',
      }
    })
    const score = Math.round((breakdown.filter(b => b.correct).length / quiz.questions.length) * 100)
    const passed = score >= quiz.passingScore

    // 1. Persist locally immediately (instant UI feedback)
    try {
      const prev = JSON.parse(localStorage.getItem('quiz_scores') ?? '{}')
      localStorage.setItem('quiz_scores', JSON.stringify({ ...prev, [quiz.pathId]: score }))
    } catch {}

    // 2. Submit to server for persistence across devices
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (token) {
        await fetch('/api/quizzes/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ pathId: quiz.pathId, answers, score }),
        })
      }
    } catch { /* localStorage fallback already written */ }

    setResults({ score, passed, breakdown })
    setState('results')
    // Award quiz badge
    if (passed) {
      const newBadges = checkAndAward({ progressMap: {}, pathsCompleted: 0, quizPassed: true })
      if (newBadges.length) {
        // Dispatch custom event — AppShell badge queue picks it up
        window.dispatchEvent(new CustomEvent('aihub:badges', { detail: newBadges }))
      }
    }
  }

  if (state === 'intro') return (
    <div className="px-4 lg:px-8 py-6 max-w-xl mx-auto">
      <Link to="/assessment" className="inline-flex items-center gap-1.5 font-medium hover:text-zinc-700 mb-5 transition-colors" style={{ fontSize:13, color:"var(--text-3)" }}>
        <ArrowLeft size={13}/> All assessments
      </Link>
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        {/* Coloured header */}
        <div className="px-7 py-7 text-center relative overflow-hidden"
          style={{ background:'linear-gradient(135deg,#0A0A0B,#1A1840,#2D2880)' }}>
          <div className="absolute inset-0 pointer-events-none opacity-20"
            style={{ background:'radial-gradient(ellipse at 70% 30%,rgba(139,133,244,0.7) 0%,transparent 60%)' }}/>
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mx-auto mb-4">
              <Target size={24} className="text-white"/>
            </div>
            <h1 className="text-xl font-extrabold text-white mb-1 tracking-tight">{quiz.title}</h1>
            <p className="text-sm" style={{ color:'rgba(255,255,255,0.45)' }}>{quiz.questions.length} questions · Pass at {quiz.passingScore}%</p>
          </div>
        </div>
        <div className="p-6 space-y-3">
          {[
            { icon:<Clock size={14} className="text-blue-500"/>,    text:'Untimed — work at your own pace' },
            { icon:<AlertCircle size={14} className="text-amber-500"/>, text:'Answers lock once you move to the next question' },
            { icon:<CheckCircle2 size={14} className="text-emerald-500"/>, text:`Score ${quiz.passingScore}%+ to pass and unlock your badge` },
          ].map((tip, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
              <span className="flex-shrink-0">{tip.icon}</span>
              <span className="text-xs text-zinc-600 leading-relaxed">{tip.text}</span>
            </div>
          ))}
          <button onClick={() => setState('active')}
            className="w-full py-3.5 mt-2 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2" style={{ background:"#5855D6" }} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="#4744C8"} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="#5855D6"}>
            Begin assessment <ArrowRight size={15}/>
          </button>
        </div>
      </div>
    </div>
  )

  if (state === 'results' && results) return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      {/* Score hero */}
      <div className={cn(
        'relative rounded-2xl overflow-hidden p-8 text-center mb-6',
        results.passed
          ? 'border border-emerald-200'
          : 'border border-red-200'
      )} style={{ background: results.passed
        ? 'linear-gradient(135deg,#052e16,#14532d)'
        : 'linear-gradient(135deg,#1a0505,#450a0a)' }}>
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 0)', backgroundSize: '18px 18px' }}/>
        <div className="relative">
          <p className="text-6xl font-black text-white mb-2 tracking-tight">
            {results.score}<span className="text-3xl text-white/50">%</span>
          </p>
          <p className={cn('text-lg font-bold mb-1', results.passed ? 'text-emerald-300' : 'text-red-300')}>
            {results.passed ? '🎉 Passed!' : 'Not quite yet'}
          </p>
          <p className="text-sm text-white/50">
            {results.breakdown.filter(b => b.correct).length} of {quiz.questions.length} correct · Pass mark {quiz.passingScore}%
          </p>
        </div>
      </div>

      {/* What next panel */}
      <div className={cn(
        'rounded-2xl border p-5 mb-6',
        results.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
      )}>
        <p className={cn('text-xs font-bold uppercase tracking-widest mb-3', results.passed ? 'text-emerald-600' : 'text-amber-600')}>
          {results.passed ? 'What to do next' : 'How to improve'}
        </p>
        {results.passed ? (
          <div className="space-y-2">
            <Link to="/curriculum"
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-100 hover:border-emerald-300 hover:shadow-card transition-all group">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <GraduationCap size={15} className="text-emerald-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-800 group-hover:text-[#5855D6] transition-colors">Continue with the next learning path</p>
                <p className="text-2xs text-zinc-500">Pick up where you left off in the curriculum</p>
              </div>
              <ChevronRight size={13} className="text-zinc-300 flex-shrink-0"/>
            </Link>
            <Link to="/assessment"
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-100 hover:border-emerald-300 hover:shadow-card transition-all group">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Award size={15} className="text-emerald-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-800 group-hover:text-[#5855D6] transition-colors">Take another assessment</p>
                <p className="text-2xs text-zinc-500">Test your knowledge on a different topic</p>
              </div>
              <ChevronRight size={13} className="text-zinc-300 flex-shrink-0"/>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <Link to={`/paths/${quiz.pathId}`}
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-100 hover:border-amber-300 hover:shadow-card transition-all group">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <BookOpen size={15} className="text-amber-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-800 group-hover:text-[#5855D6] transition-colors">Review the learning path first</p>
                <p className="text-2xs text-zinc-500">Complete the path resources, then retry this quiz</p>
              </div>
              <ChevronRight size={13} className="text-zinc-300 flex-shrink-0"/>
            </Link>
            <button onClick={() => { setState('intro'); setAnswers({}); setCurrent(0); setResults(null) }}
              className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-100 hover:border-amber-300 hover:shadow-card transition-all group text-left">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <RotateCcw size={15} className="text-amber-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-800 group-hover:text-[#5855D6] transition-colors">Retry this quiz now</p>
                <p className="text-2xs text-zinc-500">You need {quiz.passingScore - results.score}% more to pass</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Answer breakdown */}
      <SectionHeading title="Answer breakdown"/>
      <div className="space-y-3 mb-6">
        {quiz.questions.map((qn, i) => {
          const r = results.breakdown[i]
          return (
            <div key={qn.id} className={cn('rounded-xl border overflow-hidden', r.correct ? 'border-emerald-200' : 'border-red-200')}>
              <div className={cn('flex items-start gap-3 p-4', r.correct ? 'bg-emerald-50' : 'bg-red-50')}>
                <span className={cn('flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0', r.correct ? 'bg-emerald-500' : 'bg-red-500')}>
                  {r.correct ? <Check size={11} className="text-white"/> : <X size={11} className="text-white"/>}
                </span>
                <p className="text-sm font-semibold text-zinc-800 leading-snug">{qn.question}</p>
              </div>
              <div className="px-4 py-3 bg-white space-y-1.5">
                {!r.correct && <p className="text-xs text-red-600"><span className="font-bold">Your answer:</span> {r.yourAnswer}</p>}
                <p className="text-xs text-emerald-700"><span className="font-bold">Correct:</span> {r.correctAnswer}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{r.explanation}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={() => { setState('intro'); setAnswers({}); setCurrent(0); setResults(null) }}
          className="flex-1 py-3 border border-zinc-200 text-zinc-700 rounded-xl text-sm font-semibold hover:bg-zinc-50 transition-colors">
          Retry
        </button>
        <button onClick={() => navigate('/assessment')}
          className="flex-1 py-3 bg-ink-900 text-white rounded-xl text-sm font-semibold hover:bg-ink-800 transition-colors">
          All assessments
        </button>
      </div>
    </div>
  )

  // Active quiz
  return (
    <div className="px-4 lg:px-8 py-6 max-w-xl mx-auto">
      {/* Progress header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <Link to="/assessment" className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1 transition-colors">
            <ArrowLeft size={12}/> Assessments
          </Link>
          <span className="text-xs font-semibold text-zinc-500">{current+1} / {quiz.questions.length}</span>
        </div>
        <ProgressBar value={((current) / quiz.questions.length) * 100} size="sm"/>
        <p className="text-2xs text-zinc-400 mt-1.5 font-medium">{quiz.title}</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        {/* Question */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
              q.type === 'mcq' ? 'bg-blue-50 text-blue-700' :
              q.type === 'truefalse' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700')}>
              {q.type === 'mcq' ? 'Multiple choice' : q.type === 'truefalse' ? 'True / False' : 'Fill in the blank'}
            </span>
          </div>
          <p className="text-base font-medium text-zinc-900 leading-relaxed">{q.question}</p>
        </div>

        {/* Answer options */}
        <div className="px-6 pb-6 space-y-2">
          {/* MCQ */}
          {q.type === 'mcq' && q.options?.map(opt => (
            <button key={opt} onClick={() => !answered && submitAnswer(opt)}
              className={cn('w-full text-left px-4 py-3 rounded-xl border text-sm transition-all',
                answers[q.id] === opt ? 'border-accent-500 bg-[#EEEEFF] text-[#4744C8] font-medium' :
                answered ? 'border-zinc-100 text-zinc-400 cursor-default' : 'border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50')}>
              {opt}
            </button>
          ))}

          {/* True / False */}
          {q.type === 'truefalse' && ['True','False'].map(opt => (
            <button key={opt} onClick={() => !answered && submitAnswer(opt)}
              className={cn('w-full text-left px-4 py-3 rounded-xl border text-sm transition-all',
                answers[q.id] === opt ? 'border-accent-500 bg-[#EEEEFF] text-[#4744C8] font-medium' :
                answered ? 'border-zinc-100 text-zinc-400 cursor-default' : 'border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50')}>
              {opt}
            </button>
          ))}

          {/* Fill in the blank */}
          {q.type === 'fill' && (
            <div className="flex gap-2">
              <input value={fillInput} onChange={e => setFillInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fillInput.trim() && !answered && submitAnswer(fillInput.trim())}
                placeholder="Type your answer…" disabled={answered}
                className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#5855D6] focus:border-transparent disabled:bg-zinc-50 disabled:text-zinc-400"/>
              {!answered && (
                <button onClick={() => fillInput.trim() && submitAnswer(fillInput.trim())} disabled={!fillInput.trim()}
                  className="px-4 py-3 bg-ink-900 text-white rounded-xl text-sm font-medium hover:bg-ink-800 disabled:opacity-40 transition-colors">
                  Submit
                </button>
              )}
            </div>
          )}

          {/* Answer given — show hint */}
          {answered && (
            <div className="mt-2 p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
              <p className="text-xs text-zinc-500">Your answer: <span className="font-medium text-zinc-700">{answers[q.id]}</span></p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <span className="text-xs text-zinc-400">{current+1} / {quiz.questions.length}</span>
          {answered && (
            current < quiz.questions.length - 1 ? (
              <button onClick={() => { setCurrent(c => c+1); setFillInput('') }}
                className="flex items-center gap-2 px-4 py-2 bg-ink-900 text-white rounded-lg text-sm font-medium hover:bg-ink-800 transition-colors">
                Next <ArrowRight size={14}/>
              </button>
            ) : (
              <button onClick={grade}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors">
                See results <CheckCircle2 size={14}/>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CURRICULUM PAGE
// ══════════════════════════════════════════════════════════════════════════════

export function CurriculumPage() {
  const [paths, setPaths]   = useState<LearningPath[]>([])
  const [loading, setLoading] = useState(true)
  const [board, setBoard]   = useState<string>('')
  const { progressMap }     = useProgress()

  useEffect(() => {
    api.paths.list(board ? { board } : {})
      .then(r => { setPaths(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [board])

  const BOARDS = [
    { id: '',      label: 'All',   active: 'bg-ink-900 text-white border-ink-900',          idle: 'border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 bg-white' },
    { id: 'CBSE',  label: 'CBSE',  active: 'bg-blue-600 text-white border-blue-600',         idle: 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100' },
    { id: 'IGCSE', label: 'IGCSE', active: 'bg-violet-600 text-white border-violet-600',     idle: 'border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100' },
    { id: 'IB',    label: 'IB',    active: 'bg-emerald-600 text-white border-emerald-600',   idle: 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' },
    { id: 'RBSE',  label: 'RBSE',  active: 'bg-amber-600 text-white border-amber-600',       idle: 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100' },
  ]

  const grouped = useMemo(() => {
    const g: Record<string, LearningPath[]> = { 'Core paths': [] }
    for (const p of paths) {
      const key = p.board ?? 'Core paths'
      if (!g[key]) g[key] = []
      g[key].push(p)
    }
    return g
  }, [paths])

  return (
    <div className="px-4 lg:px-8 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="font-extrabold tracking-tight mb-1" style={{ fontSize: 28, color: 'var(--text-1)' }}>Curriculum Hub</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Learning paths aligned to CBSE, IGCSE, IB, and RBSE.</p>
      </div>

      {/* Board filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {BOARDS.map(b => (
          <button key={b.id} onClick={() => setBoard(b.id === board ? '' : b.id)}
            className="font-semibold rounded-full transition-all duration-150"
            style={{
              fontSize: 13, padding: '6px 16px',
              background: board === b.id ? '#0A0A0B' : 'white',
              color: board === b.id ? 'white' : 'var(--text-2)',
              border: `1px solid ${board === b.id ? '#0A0A0B' : 'var(--border)'}`,
              boxShadow: board === b.id ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
            }}>
            {b.label}
          </button>
        ))}
      </div>

      {loading ? <PageLoader/> : (
        <div className="space-y-10">
          {Object.entries(grouped).filter(([, ps]) => ps.length > 0).map(([label, ps]) => (
            <div key={label}>
              <div className="flex items-center gap-2.5 mb-5">
                <h2 className="text-base font-bold text-zinc-900">{label}</h2>
                <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-md text-2xs font-bold">{ps.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ps.map(path => {
                  const done  = path.resourceIds.filter(id => (progressMap[id] ?? 0) === 100).length
                  const total = path.resourceIds.length
                  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
                  return (
                    <Link key={path.id} to={`/paths/${path.id}`}
                      className="group relative bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-zinc-300 hover:shadow-card-hover transition-all duration-200">
                      {/* Coloured top accent stripe */}
                      <div className={cn('h-1 w-full', path.accentColor)}/>
                      <div className="p-5">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white mb-4', path.accentColor)}>
                          <Brain size={17}/>
                        </div>
                        <h3 className="text-sm font-bold text-zinc-900 mb-1 group-hover:text-[#5855D6] transition-colors leading-snug line-clamp-2">{path.title}</h3>
                        {path.boardUnit && <p className="text-xs text-zinc-400 mb-3 line-clamp-1">{path.boardUnit}</p>}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="flex items-center gap-1 text-xs text-zinc-400"><Clock size={11}/> {path.estimatedHours}h</span>
                          <Badge variant={path.difficulty as any}/>
                        </div>
                        {pct > 0 && (
                          <div className="mt-4">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-2xs text-zinc-400">Progress</span>
                              <span className="text-2xs font-bold text-zinc-600">{pct}%</span>
                            </div>
                            <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all duration-700', pct === 100 ? 'bg-signal-green' : 'bg-[#5855D6]')}
                                style={{ width: `${pct}%` }}/>
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SEMINARS PAGE
// ══════════════════════════════════════════════════════════════════════════════

export function SeminarsPage() {
  const { data, loading } = useFetch(() => api.resources.list({ type:'seminar', limit:50 }), [])
  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      <PageHeader
        eyebrow="Structured courses & seminars"
        eyebrowIcon={<Video size={13} className="text-purple-600"/>}
        eyebrowColor="bg-purple-50 border-purple-100 text-purple-700"
        title="Seminars & Courses"
        subtitle="Full courses and structured seminars from MIT, fast.ai, DeepLearning.AI, and ISTE. Curated for teachers and advanced students."
      />
      {loading ? <PageLoader/> : data?.data.length ? (
        <ContentGrid resources={data.data}/>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl text-center" style={{ border:"1px solid var(--border)" }}>
          <Video size={28} className="text-zinc-300 mb-3"/>
          <p className="text-sm font-semibold text-zinc-600 mb-1">No seminars found</p>
          <p className="text-xs text-zinc-400 leading-relaxed">More structured courses being added. Browse other resources in the meantime.</p>
          <Link to="/browse" className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#5855D6] text-white text-xs font-bold rounded-lg hover:bg-[#4744C8] transition-colors">
            Browse all resources <ArrowRight size={12}/>
          </Link>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// WORKFLOWS PAGE
// ══════════════════════════════════════════════════════════════════════════════

export function WorkflowsPage() {
  const { data: toolsData, loading } = useFetch(() => api.tools.list(), [])
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [walkthroughs,  setWalkthroughs] = useState<any[]>([])
  const [activeWt,      setActiveWt]     = useState<string | null>(null)
  const [loadingWT,     setLoadingWT]    = useState(false)

  const selectTool = async (id: string) => {
    if (selectedTool === id) { setSelectedTool(null); setWalkthroughs([]); setActiveWt(null); return }
    setSelectedTool(id); setActiveWt(null); setLoadingWT(true)
    try {
      const data = await api.tools.get(id)
      setWalkthroughs(data.walkthroughs ?? [])
    } catch {/* */} finally { setLoadingWT(false) }
  }

  const tools      = toolsData?.data ?? []
  const wt         = walkthroughs.find((w: any) => w.id === activeWt)
  const activeTool = tools.find((t: any) => t.id === selectedTool)

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 mb-4">
          <GitBranch size={13} className="text-emerald-600"/>
          <span className="text-xs font-medium text-emerald-700">Step-by-step guides</span>
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">AI Workflows</h1>
        <p className="text-sm text-zinc-500 max-w-xl leading-relaxed">
          Practical step-by-step walkthroughs for using each AI tool effectively. Lesson planning, research, document analysis, and more.
        </p>
      </div>

      {loading ? <PageLoader/> : (
        <>
          {/* Tool selector — compact grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-7">
            {tools.map((tool: any) => (
              <button key={tool.id} onClick={() => selectTool(tool.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all duration-150',
                  selectedTool === tool.id
                    ? 'border-accent-300 bg-[#EEEEFF] shadow-card'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-card'
                )}>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0', tool.logoColor, tool.textColor)}>
                  {tool.toolName.slice(0, 3).toUpperCase()}
                </div>
                <span className={cn('text-xs font-semibold leading-tight truncate w-full', selectedTool === tool.id ? 'text-[#4744C8]' : 'text-zinc-600')}>
                  {tool.toolName}
                </span>
              </button>
            ))}
          </div>

          {/* Empty state */}
          {!selectedTool && (
            <div className="flex flex-col items-center justify-center h-52 bg-zinc-50 border border-zinc-200 rounded-2xl gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-card border border-zinc-200 flex items-center justify-center">
                <GitBranch size={20} className="text-zinc-300"/>
              </div>
              <p className="text-sm text-zinc-400 font-medium">Select a tool above to see its walkthroughs</p>
            </div>
          )}

          {selectedTool && (
            <div className="animate-fade-in">
              {/* Active tool header row */}
              {activeTool && !activeWt && (
                <div className="flex items-center gap-3 mb-5">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0', activeTool.logoColor, activeTool.textColor)}>
                    {activeTool.toolName.slice(0, 3).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-zinc-900">{activeTool.toolName}</h2>
                    <p className="text-xs text-zinc-400">{walkthroughs.length} walkthrough{walkthroughs.length !== 1 ? 's' : ''} available</p>
                  </div>
                </div>
              )}

              {loadingWT && <div className="flex justify-center py-12"><Spinner size={20} className="text-[#5855D6]"/></div>}

              {!loadingWT && !activeWt && walkthroughs.length === 0 && (
                <EmptyState title="No walkthroughs yet" description="More coming soon for this tool."/>
              )}

              {!loadingWT && !activeWt && walkthroughs.length > 0 && (
                <div className="space-y-2">
                  {walkthroughs.map((w: any, i: number) => (
                    <button key={w.id} onClick={() => setActiveWt(w.id)}
                      className="w-full flex items-center gap-4 p-4 bg-white border border-zinc-200 rounded-xl hover:border-[#C0BFEF] hover:shadow-card-hover transition-all text-left group">
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 flex-shrink-0 group-hover:bg-[#EEEEFF] group-hover:text-[#5855D6] transition-colors">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-800 group-hover:text-[#5855D6] transition-colors mb-0.5 truncate">{w.title}</h3>
                        <p className="text-xs text-zinc-500 line-clamp-1">{w.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-zinc-400 flex items-center gap-1"><Clock size={11}/> {w.duration}</span>
                        <Badge variant={w.difficulty as any}/>
                        <ChevronRight size={14} className="text-zinc-300 group-hover:text-[#5855D6] transition-colors"/>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Walkthrough step-by-step viewer */}
              {activeWt && wt && (
                <div className="animate-fade-in">
                  <button onClick={() => setActiveWt(null)} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 mb-5 transition-colors">
                    <ArrowLeft size={12}/> Back to walkthroughs
                  </button>
                  <h2 className="text-xl font-bold text-zinc-900 mb-1">{wt.title}</h2>
                  <p className="text-sm text-zinc-500 flex items-center gap-3 mb-7">
                    <span className="flex items-center gap-1"><Clock size={12}/> {wt.duration}</span>
                    <Badge variant={wt.difficulty as any}/>
                  </p>
                  <div className="space-y-3">
                    {wt.steps.map((step: any, i: number) => (
                      <div key={step.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-3 px-5 py-3.5 bg-zinc-50 border-b border-zinc-100">
                          <span className="w-6 h-6 rounded-full bg-ink-900 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <h4 className="text-sm font-bold text-zinc-800">{step.title}</h4>
                        </div>
                        <div className="p-5 space-y-3">
                          <p className="text-sm text-zinc-700 leading-relaxed">{step.content}</p>
                          {step.code && <pre className="bg-ink-950 text-emerald-300 text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">{step.code}</pre>}
                          {step.tip && (
                            <div className="flex items-start gap-2.5 p-3 bg-[#EEEEFF] border border-[#DDDDF8] rounded-xl">
                              <Lightbulb size={14} className="text-[#5855D6] flex-shrink-0 mt-0.5"/>
                              <p className="text-xs text-accent-800 leading-relaxed">{step.tip}</p>
                            </div>
                          )}
                          {step.warning && (
                            <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                              <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                              <p className="text-xs text-amber-800 leading-relaxed">{step.warning}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 p-5 bg-ink-900 rounded-2xl">
                    <p className="text-2xs font-bold text-accent-300 uppercase tracking-widest mb-2">Key takeaway</p>
                    <p className="text-sm text-white/80 leading-relaxed">{wt.keyTakeaway}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
// ══════════════════════════════════════════════════════════════════════════════
// TOOLS PAGE
// ══════════════════════════════════════════════════════════════════════════════

export function ToolsPage() {
  const { data, loading } = useFetch(() => api.tools.list(), [])
  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">AI Tool Guides</h1>
        <p className="text-sm text-zinc-500 leading-relaxed max-w-xl">Learn how each tool actually works, what it's best for, and how to get the most out of it.</p>
      </div>
      {loading ? <PageLoader/> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data?.data.map(tool => (
            <Link key={tool.id} to={`/tools/${tool.id}`}
              className="group relative bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-zinc-300 hover:shadow-card-hover transition-all duration-200">
              {/* Coloured header panel with lettermark */}
              <div className={cn('px-5 pt-5 pb-4', tool.logoColor)}>
                <div className="flex items-start justify-between mb-3">
                  <ToolLettermark toolName={tool.toolName} size={40}/>
                  <span className={cn('text-2xs font-semibold opacity-50 mt-1', tool.textColor)}>
                    {tool.guideCount} guides
                  </span>
                </div>
                <h3 className={cn('text-lg font-extrabold tracking-tight leading-snug', tool.textColor)}>{tool.toolName}</h3>
              </div>
              {/* Body */}
              <div className="px-5 py-4">
                <p className="text-xs text-zinc-500 leading-relaxed mb-4 line-clamp-2">{tool.tagline}</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#5855D6] group-hover:gap-2 transition-all">
                  View guides <ArrowRight size={12}/>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
// ══════════════════════════════════════════════════════════════════════════════
// TOOL DETAIL PAGE
// ══════════════════════════════════════════════════════════════════════════════

export function ToolDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, loading, error } = useFetch(() => api.tools.get(id!), [id])
  const [activeWt, setActiveWt] = useState<string | null>(null)

  if (loading) return <PageLoader/>
  if (error || !data) return <PageError msg={error ?? 'Tool not found'}/>

  const wt = data.walkthroughs?.find(w => w.id === activeWt)

  return (
    <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">
      <Link to="/tools" className="inline-flex items-center gap-1.5 font-medium hover:text-zinc-700 mb-5 transition-colors" style={{ fontSize:13, color:"var(--text-3)" }}>
        <ArrowLeft size={13}/> All tools
      </Link>

      {/* Tool hero */}
      <div className={cn('relative rounded-2xl overflow-hidden mb-7 px-6 py-6', data.logoColor)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <ToolLettermark toolName={data.toolName} size={52}/>
            <div>
              <h1 className={cn('text-2xl font-extrabold tracking-tight', data.textColor)}>{data.toolName}</h1>
              <p className={cn('text-sm mt-1 opacity-70 max-w-sm leading-relaxed', data.textColor)}>{data.tagline}</p>
            </div>
          </div>
          <div className="flex-shrink-0 px-4 py-3 rounded-xl text-center" style={{ background: 'rgba(0,0,0,0.15)' }}>
            <p className={cn('text-2xl font-black leading-none mb-0.5', data.textColor)}>{data.walkthroughs?.length ?? 0}</p>
            <p className={cn('text-2xs opacity-60', data.textColor)}>walkthroughs</p>
          </div>
        </div>
      </div>

      {!activeWt ? (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-zinc-800 mb-4">Walkthroughs ({data.walkthroughs?.length ?? 0})</h2>
          {(data.walkthroughs ?? []).map((wt, i) => (
            <button key={wt.id} onClick={() => setActiveWt(wt.id)}
              className="w-full flex items-center gap-4 p-4 bg-white border border-zinc-200 rounded-xl hover:border-[#C0BFEF] hover:shadow-card-hover transition-all text-left group">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 flex-shrink-0 group-hover:bg-[#EEEEFF] group-hover:text-[#5855D6] transition-colors">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-zinc-800 group-hover:text-[#5855D6] transition-colors mb-0.5 truncate">{wt.title}</h3>
                <p className="text-xs text-zinc-500 line-clamp-1">{wt.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-zinc-400 flex items-center gap-1"><Clock size={11}/> {wt.duration}</span>
                <Badge variant={wt.difficulty as any}/>
                <ChevronRight size={14} className="text-zinc-300 group-hover:text-[#5855D6] transition-colors"/>
              </div>
            </button>
          ))}
        </div>
      ) : wt ? (
        <div className="animate-fade-in">
          <button onClick={() => setActiveWt(null)} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 mb-5 transition-colors">
            <ArrowLeft size={12}/> Back to guides
          </button>
          <h2 className="text-xl font-bold text-zinc-900 mb-1">{wt.title}</h2>
          <p className="text-sm text-zinc-500 flex items-center gap-3 mb-7">
            <span className="flex items-center gap-1"><Clock size={12}/> {wt.duration}</span>
            <Badge variant={wt.difficulty as any}/>
          </p>
          <div className="space-y-3">
            {wt.steps.map((step, i) => (
              <div key={step.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 bg-zinc-50 border-b border-zinc-100">
                  <span className="w-6 h-6 rounded-full bg-ink-900 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <h4 className="text-sm font-bold text-zinc-800">{step.title}</h4>
                </div>
                <div className="p-5 space-y-3">
                  <p className="text-sm text-zinc-700 leading-relaxed">{step.content}</p>
                  {step.code && <pre className="bg-ink-950 text-emerald-300 text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">{step.code}</pre>}
                  {step.tip && (
                    <div className="flex items-start gap-2.5 p-3 bg-[#EEEEFF] border border-[#DDDDF8] rounded-xl">
                      <Lightbulb size={14} className="text-[#5855D6] flex-shrink-0 mt-0.5"/>
                      <p className="text-xs text-accent-800 leading-relaxed">{step.tip}</p>
                    </div>
                  )}
                  {step.warning && (
                    <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                      <p className="text-xs text-amber-800 leading-relaxed">{step.warning}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 p-5 bg-ink-900 rounded-2xl">
            <p className="text-2xs font-bold text-accent-300 uppercase tracking-widest mb-2">Key takeaway</p>
            <p className="text-sm text-white/80 leading-relaxed">{wt.keyTakeaway}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
// ══════════════════════════════════════════════════════════════════════════════
// TEACHER PAGE
// ══════════════════════════════════════════════════════════════════════════════


// Teacher hero banner — fetches live classroom code from Supabase
function TeacherHeroBanner({ user, profile }: { user?: { id: string }; profile?: { full_name?: string | null; role?: string | null } | null }) {
  const [classroom, setClassroom]   = useState<{ code: string; name: string } | null>(null)
  const [copied,    setCopied]      = useState(false)
  const [loading,   setLoading]     = useState(true)

  const generateCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  useEffect(() => {
    if (!user) { setLoading(false); return }
    ;(async () => {
      try {
        const { data: rows } = await supabase.from('classrooms').select('code,name').eq('teacher_id', user.id).limit(1)
        if (rows?.[0]) {
          setClassroom(rows[0])
        } else {
          // Auto-create classroom on first visit to Teacher Hub
          const tryInsert = async (): Promise<{ code: string; name: string } | null> => {
            const { data, error } = await supabase
              .from('classrooms')
              .insert({ teacher_id: user.id, code: generateCode(), name: 'My Classroom' })
              .select('code,name').single()
            if (error?.code === '23505') return tryInsert() // retry on code collision
            return data ?? null
          }
          setClassroom(await tryInsert())
        }
      } catch { /* ignore */ }
      finally { setLoading(false) }
    })()
  }, [user?.id])

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2200)
  }

  const name = profile?.full_name?.split(' ')[0]

  return (
    <div className="relative rounded-2xl overflow-hidden mb-8 px-7 py-8"
      style={{ background: 'linear-gradient(135deg, #0A0A0B 0%, #1a1208 50%, #2d1f06 100%)' }}>
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 0)', backgroundSize: '22px 22px' }}/>
      <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl pointer-events-none"/>
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-bold uppercase tracking-widest text-amber-300/50 mb-2">Teacher Hub</p>
          <h2 className="text-xl font-extrabold text-white mb-1.5">
            {name ? `Welcome back, ${name}` : 'Your teaching OS is ready'}
          </h2>
          <p className="text-sm text-white/50 max-w-sm leading-relaxed">
            Share your classroom code with students — they enter it on their dashboard to join.
          </p>
          {/* Live classroom code */}
          {!loading && classroom && (
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/15"
                style={{ background: 'rgba(255,255,255,0.08)' }}>
                <span className="text-2xs font-bold text-white/35 uppercase tracking-widest">Class code</span>
                <span className="text-xl font-black text-white tracking-[0.22em]">{classroom.code}</span>
              </div>
              <button onClick={() => copyCode(classroom.code)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border',
                  copied
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-white/10 text-white/70 hover:bg-white/20 border-white/10'
                )}>
                {copied ? <><Check size={12}/> Copied!</> : <><Target size={12}/> Copy code</>}
              </button>
            </div>
          )}
          {!loading && !classroom && user && (
            <Link to="/dashboard"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 bg-white/10 text-white rounded-xl text-xs font-bold border border-white/15 hover:bg-white/20 transition-colors">
              <Users size={13}/> Generate classroom code in Dashboard
            </Link>
          )}
        </div>
        <div className="flex gap-3 flex-wrap flex-shrink-0">
          <Link to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-900 rounded-xl text-xs font-bold hover:bg-amber-50 transition-colors">
            <Users size={13}/> View classroom →
          </Link>
          <Link to="/activities"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white rounded-xl text-xs font-bold border border-white/15 hover:bg-white/20 transition-colors">
            Run an activity <ArrowRight size={13}/>
          </Link>
        </div>
      </div>
    </div>
  )
}

export function TeacherPage() {
  const { data, loading } = useFetch(() => api.resources.list({ audience:'teacher', limit:50 }), [])
  const { user, profile }  = useAuth()

  const LESSON_TEMPLATES = [
    { title:'Introduction to AI',          level:'Class 6–8',   board:'CBSE',  time:'45 min', tag:'Lesson plan' },
    { title:'Prompt Engineering Workshop', level:'Class 9–12',  board:'All',   time:'60 min', tag:'Workshop' },
    { title:'AI Ethics Debate',            level:'Class 9–12',  board:'IGCSE', time:'45 min', tag:'Discussion' },
    { title:'How Neural Networks Learn',   level:'Class 11–12', board:'CBSE',  time:'90 min', tag:'Deep dive' },
    { title:'Generative AI Demo Day',      level:'All grades',  board:'All',   time:'60 min', tag:'Activity' },
    { title:'AI Bias Case Study',          level:'Class 9–12',  board:'IB',    time:'45 min', tag:'Case study' },
  ]

  const QUICK_ACTIONS = [
    { icon:<Users size={18}/>,      label:'Classroom activities', desc:'15 ready-to-run exercises',    href:'/activities',  color:'text-purple-600', bg:'bg-purple-50', border:'border-purple-100' },
    { icon:<Globe size={18}/>,      label:'Curriculum hub',       desc:'CBSE, IGCSE, IB paths',        href:'/curriculum',  color:'text-blue-600',   bg:'bg-blue-50',   border:'border-blue-100' },
    { icon:<GitBranch size={18}/>,  label:'AI workflows',         desc:'Step-by-step tool guides',     href:'/workflows',   color:'text-emerald-600',bg:'bg-emerald-50',border:'border-emerald-100' },
    { icon:<MessageSquare size={18}/>, label:'AI Chat',           desc:'Research and lesson prep',     href:'/chat',        color:'text-[#5855D6]', bg:'bg-[#EEEEFF]', border:'border-[#DDDDF8]' },
    { icon:<FlaskConical size={18}/>, label:'Playground',         desc:'Demo experiments in class',    href:'/playground',  color:'text-amber-600',  bg:'bg-amber-50',  border:'border-amber-100' },
    { icon:<Award size={18}/>,      label:'Assessment',           desc:'Quiz your class on AI topics', href:'/assessment',  color:'text-sky-600',    bg:'bg-sky-50',    border:'border-sky-100' },
  ]

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">

      {/* Header */}
      <PageHeader
        eyebrow="For educators"
        eyebrowIcon={<GraduationCap size={13} className="text-amber-600"/>}
        eyebrowColor="bg-amber-50 border-amber-100 text-amber-700"
        title="Teacher Hub"
        subtitle="Everything you need to teach AI literacy — lesson plans, activities, curriculum maps, and classroom tools for CBSE, IGCSE, and IB."
      />

      {/* Classroom code hero — live code from Supabase */}
      <TeacherHeroBanner user={user ?? undefined} profile={profile ?? undefined}/>

      {/* Quick access grid */}
      <SectionHeading title="Quick access"/>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
        {QUICK_ACTIONS.map(a => (
          <Link key={a.href} to={a.href}
            className="group flex gap-3 items-start p-4 bg-white rounded-2xl hover:shadow-card-hover transition-all"
            style={{ border:'1px solid var(--border)' }}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor='#C4C2E8'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--border)'}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-zinc-100 text-zinc-500 group-hover:bg-[#EEEEFF] group-hover:text-[#5855D6] transition-all">
              {a.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-800 group-hover:text-[#5855D6] transition-colors leading-snug">{a.label}</p>
              <p className="text-2xs text-zinc-400 mt-0.5 leading-relaxed">{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Lesson plan templates */}
      <SectionHeading title="Lesson plan templates" action={
        <span className="text-2xs font-semibold px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full">Coming as downloads soon</span>
      }/>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
        {LESSON_TEMPLATES.map(t => (
          <div key={t.title}
            className="group bg-white border border-zinc-200 rounded-xl p-4 hover:border-zinc-300 hover:shadow-card transition-all">
            <div className="flex items-start justify-between mb-3">
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 text-2xs font-bold rounded-md">{t.tag}</span>
              <span className="text-2xs text-zinc-400 font-medium">{t.time}</span>
            </div>
            <h3 className="text-sm font-bold text-zinc-800 mb-2 leading-snug">{t.title}</h3>
            <div className="flex items-center gap-2">
              <span className="text-2xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md font-medium">{t.level}</span>
              <span className="text-2xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md font-medium">{t.board}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Resources for teachers */}
      <SectionHeading title="Curated resources for teachers" action={
        <span className="text-2xs text-zinc-400">{data?.data.length ?? 0} resources</span>
      }/>
      {loading ? <PageLoader/> : data?.data.length ? (
        <ContentGrid resources={data.data}/>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl text-center" style={{ border:"1px solid var(--border)" }}>
          <GraduationCap size={28} className="text-zinc-300 mb-3"/>
          <p className="text-sm font-semibold text-zinc-600 mb-1">Teacher resources loading</p>
          <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">Browse resources are being curated. Check back soon, or explore the curriculum hub.</p>
          <Link to="/curriculum" className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#5855D6] text-white text-xs font-bold rounded-lg hover:bg-[#4744C8] transition-colors">
            Curriculum hub <ArrowRight size={12}/>
          </Link>
        </div>
      )}
    </div>
  )
}


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
              <div key={s.label} className="bg-white rounded-2xl p-4" style={{ border:'1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
    
                  <p className="text-2xl font-extrabold text-zinc-900">{s.val}</p>
                </div>
                <p className="text-xs text-zinc-500 font-medium">{s.label}</p>
              </div>
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

          {/* ── Type breakdown ── */}
          {Object.keys(byType).length > 1 && (
            <section>
              <SectionHeading title="Completed by type"/>
              <div className="flex flex-wrap gap-2">
                {Object.entries(byType).sort(([,a],[,b]) => b - a).map(([type, count]) => (
                  <div key={type}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 rounded-xl">
                    <span className="text-sm font-extrabold text-zinc-800">{count}</span>
                    <span className="text-xs text-zinc-500 capitalize font-medium">{type}{count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

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

/** Circular ring progress indicator */
function RingProgress({ value, size = 44, strokeWidth = 3 }: { value: number; size?: number; strokeWidth?: number }) {
  const r      = (size - strokeWidth * 2) / 2
  const circ   = 2 * Math.PI * r
  const pct    = Math.min(100, Math.max(0, value))
  const offset = circ * (1 - pct / 100)
  const stroke = pct === 100 ? '#10B981' : '#6366F1'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={stroke} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}/>
    </svg>
  )
}

/** 6-char classroom code (no ambiguous 0/O/1/I chars) */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

/** Deterministic avatar colour from name string */
function avatarColor(name: string): string {
  const p = [
    'bg-violet-100 text-violet-700', 'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700',
    'bg-orange-100 text-orange-700', 'bg-teal-100 text-teal-700',
  ]
  return p[(name || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % p.length]
}

type Classroom  = { id: string; teacher_id: string; code: string; name: string; created_at: string }
type StudentRow = { id: string; name: string; email: string; joinedAt: string; started: number; completed: number; rate: number }

// ── Teacher classroom dashboard ───────────────────────────────────────────────

// ── local types (dashboard-only) ─────────────────────────────────────────────
type AssignableType = 'resource' | 'exercise' | 'path' | 'activity'
interface AssignableItem { id: string; title: string; type: AssignableType; meta: string }

// Build a palette from initials for avatar colours
function avatarColor(name: string) {
  const palettes = [
    'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700',
    'bg-violet-100 text-violet-700', 'bg-sky-100 text-sky-700',
  ]
  return palettes[(name.charCodeAt(0) + (name.charCodeAt(1) ?? 0)) % palettes.length]
}

function RingProgress({ value, size = 44, stroke = 3 }: { value: number; size?: number; stroke?: number }) {
  const r    = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const off  = circ * (1 - Math.min(100, Math.max(0, value)) / 100)
  const col  = value === 100 ? '#10B981' : '#5855D6'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F0F0F0" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}/>
    </svg>
  )
}

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
                    <RingProgress value={pct} size={38} stroke={3}/>
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
function AssignModal({ resources, onClose, onAssign }: {
  resources: Resource[]
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
    { id: 'hallucination-hunt', type: 'exercise', title: 'The Hallucination Hunt', meta: 'Hallucination · 25 min' },
    { id: 'sycophancy-mirror',  type: 'exercise', title: 'The Sycophancy Mirror', meta: 'Sycophancy · 20 min' },
    { id: 'bias-probe',         type: 'exercise', title: 'Bias Probe', meta: 'Training data bias · 30 min' },
    { id: 'prompt-injection',   type: 'exercise', title: 'Prompt Injection', meta: 'AI safety · 25 min' },
    { id: 'few-shot-power',     type: 'exercise', title: 'Few-Shot Power', meta: 'Prompting · 20 min' },
  ]).current

  const resourceItems: AssignableItem[] = resources.slice(0, 30).map(r => ({
    id: r.id, type: 'resource' as const, title: r.title,
    meta: `${r.type} · ${r.difficulty}`
  }))

  const items = tab === 'resource' ? resourceItems : exercises
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
        <div className="flex border-b border-zinc-100">
          {(['resource', 'exercise'] as AssignableType[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setSelected(null); setSearch('') }}
              className={cn('flex-1 py-2.5 text-xs font-semibold capitalize transition-colors',
                tab === t ? 'text-[#5855D6] border-b-2 border-[#5855D6]' : 'text-zinc-400 hover:text-zinc-600'
              )}>
              {t === 'resource' ? '📚 Resource' : '🧪 Playground exercise'}
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
function TeacherClassroomDashboard() {
  const { user, profile } = useAuth()

  // State
  const [classroom,    setClassroom]    = useState<Classroom | null>(null)
  const [students,     setStudents]     = useState<StudentRow[]>([])
  const [assignments,  setAssignments]  = useState<Assignment[]>([])
  const [resources,    setResources]    = useState<Resource[]>([])
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
      // Get or create classroom
      const { data: clsRows } = await supabase
        .from('classrooms').select('*').eq('teacher_id', user.id).limit(1)
      let cls: Classroom | null = clsRows?.[0] ?? null
      if (!cls) {
        const tryInsert = async (): Promise<Classroom | null> => {
          const { data, error } = await supabase
            .from('classrooms')
            .insert({ teacher_id: user.id, code: generateCode(), name: 'My Classroom' })
            .select().single()
          if (error?.code === '23505') return tryInsert()
          return data ?? null
        }
        cls = await tryInsert()
      }
      if (!cls) return
      setClassroom(cls)

      // Members
      const { data: memberRows } = await supabase
        .from('classroom_members').select('student_id, joined_at').eq('classroom_id', cls.id)
      if (!memberRows?.length) { setStudents([]); return }

      const ids = memberRows.map(m => m.student_id)

      // Parallel fetch: profiles + resource progress + quiz results
      const [{ data: profileRows }, { data: progressRows }, { data: quizRows }, { data: assignRows }] =
        await Promise.all([
          supabase.from('profiles').select('id, full_name, email').in('id', ids),
          supabase.from('resource_progress').select('user_id, completed').in('user_id', ids),
          supabase.from('quiz_results').select('user_id, score').in('user_id', ids),
          supabase.from('assignments').select('*').eq('classroom_id', cls.id).order('created_at', { ascending: false }),
        ])

      setAssignments(assignRows ?? [])

      setStudents(memberRows.map(m => {
        const p      = profileRows?.find(x => x.id === m.student_id)
        const prog   = progressRows?.filter(x => x.user_id === m.student_id) ?? []
        const done   = prog.filter(x => x.completed).length
        const quizzes = quizRows?.filter(x => x.user_id === m.student_id) ?? []
        const avgQuiz = quizzes.length
          ? Math.round(quizzes.reduce((s, q) => s + q.score, 0) / quizzes.length)
          : null

        // Streak: approximate from updated_at recency — real impl would use a streak table
        const streak = 0 // placeholder — real data needs a streak tracking table

        return {
          id: m.student_id,
          name: p?.full_name ?? 'Student',
          email: p?.email ?? '',
          joinedAt: m.joined_at,
          started: prog.length,
          completed: done,
          rate: prog.length > 0 ? Math.round((done / prog.length) * 100) : 0,
          streak,
          quizScore: avgQuiz,
          pathProgress: {},  // would need path_progress table for real per-path data
        }
      }))
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  // Load assignable resources once
  useEffect(() => {
    api.resources.list({ limit: 60 }).then(r => setResources(r.data)).catch(() => {})
  }, [])

  const handleAssign = async (item: AssignableItem, dueDate: string, note: string) => {
    try {
      const { assignment } = await api.classroom.createAssignment({
        content_type: item.type,
        content_id: item.id,
        title: item.title,
        note: note || undefined,
        due_date: dueDate || undefined,
      })
      setAssignments(prev => [assignment, ...prev])
    } catch (e) {
      console.error('Assign failed', e)
    }
  }

  const deleteAssignment = async (id: string) => {
    try {
      await api.classroom.deleteAssignment(id)
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

const CHAT_SYSTEM = `You are an expert AI literacy tutor. Your job is to help teachers, students, and curious learners genuinely understand AI — not just use it.

You explain:
- How AI language models actually work (transformers, attention, RLHF)
- Why AI hallucinates, what sycophancy is, what bias means technically
- How to use AI tools intelligently and critically
- AI ethics, safety, curriculum (CBSE, IGCSE, IB)
- Practical AI literacy skills

Rules:
- Be clear, honest, and direct. Never hype AI.
- Acknowledge uncertainty when you have it.
- Encourage critical thinking, not dependence on AI.
- Keep responses under 200 words unless the question genuinely needs more.
- If a student asks for homework answers, redirect to understanding.`

const CHAT_STARTERS = [
  'Why does AI make things up? Explain the mechanism.',
  'What is sycophancy in AI and why does it happen?',
  'How do I prepare for CBSE AI Code 417?',
  'What is the difference between supervised and reinforcement learning?',
  'How can teachers use AI without harming learning?',
  'What should every student know before trusting AI?',
]

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  const send = async (text: string) => {
    const msg = text.trim()
    if (!msg || loading) return
    setError(null); setInput('')
    const userMsg: Message = { role:'user', content:msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const data = await api.chat.send([...messages, userMsg], CHAT_SYSTEM)
      setMessages(prev => [...prev, { role:'assistant', content:data.text }])
    } catch(e) { setError(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-zinc-200 bg-white px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">AI Literacy Chat</h2>
            <p className="text-xs text-zinc-400">Ask anything about AI — honest, deep answers</p>
          </div>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1">
              <RotateCcw size={11}/> New chat
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-[#EEEEFF] border border-brand-100 flex items-center justify-center mx-auto mb-3">
                  <Brain size={20} className="text-[#5855D6]"/>
                </div>
                <h3 className="text-sm font-semibold text-zinc-800 mb-1">AI Literacy Chat</h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto">Genuine answers about AI — how it works, where it fails, how to use it wisely.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {CHAT_STARTERS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-left text-xs text-zinc-600 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 rounded-xl px-3 py-2.5 transition-colors leading-snug">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user' ? 'bg-ink-900 text-white rounded-br-sm' : 'bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm shadow-sm')}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Brain size={12} className="text-[#5855D6]"/>
                    <span className="text-[10px] font-semibold text-[#5855D6] uppercase tracking-wide">AIhub</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-zinc-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <TypingDots/>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <div ref={bottomRef}/>
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-zinc-200 bg-white px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Ask anything about AI…"
            className="flex-1 px-4 py-2.5 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5855D6] focus:border-transparent bg-zinc-50 placeholder:text-zinc-400"/>
          <button onClick={() => send(input)} disabled={!input.trim()||loading}
            className="w-10 h-10 rounded-xl bg-ink-900 text-white flex items-center justify-center hover:bg-ink-800 disabled:opacity-40 transition-colors flex-shrink-0">
            <Send size={14}/>
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH PAGES
// ══════════════════════════════════════════════════════════════════════════════

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setLoading(true)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) setError(err.message)
    else navigate('/')
  }

  return (
    <div className="min-h-screen bg-ink-950 flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-12"
        style={{background:'linear-gradient(135deg, #0F172A 0%, #1a1040 100%)'}}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <Zap size={15} className="text-white" strokeWidth={2.5}/>
          </div>
          <span className="text-sm font-bold text-white tracking-tight">
            AIhub <span className="text-white/30 font-normal text-xs tracking-widest uppercase">OS</span>
          </span>
        </div>
        <div>
          <p className="text-4xl font-bold text-white leading-tight mb-4 tracking-tight">
            Train to think like<br/>
            <span className="text-accent-400">the top 1%.</span>
          </p>
          <p className="text-sm text-white/50 leading-relaxed mb-8">
            Researchers. Founders. Analysts. Engineers. They don't just use AI — they operate with it. This is where that starts.
          </p>
          {['Hands-on AI experiments','CBSE, IGCSE, IB aligned curriculum','⌘K command palette for everything','AI Research Partner on every resource'].map(f => (
            <div key={f} className="flex items-center gap-2.5 text-sm text-white/50 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-400 flex-shrink-0"/>
              {f}
            </div>
          ))}
        </div>
        <p className="text-2xs text-white/20">© 2025 AIhub</p>
      </div>
      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-ink-950">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
              <Zap size={13} className="text-white" strokeWidth={2.5}/>
            </div>
            <span className="text-sm font-bold text-white">AIhub OS</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Welcome back</h1>
          <p className="text-sm text-white/40 mb-8">Sign in to your operating system</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-2xs font-bold uppercase tracking-widest text-white/40 mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full px-4 py-3 text-sm bg-white/5 text-white placeholder:text-white/20 border border-white/10 rounded-xl focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"/>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-2xs font-bold uppercase tracking-widest text-white/40">Password</label>
                <Link to="/auth/forgot-password" className="text-2xs text-accent-400 hover:text-accent-300 font-semibold transition-colors">
                  Forgot password?
                </Link>
              </div>
              <input type="password" value={password} onChange={e => setPw(e.target.value)} required
                className="w-full px-4 py-3 text-sm bg-white/5 text-white placeholder:text-white/20 border border-white/10 rounded-xl focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"/>
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0"/>
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#5855D6] text-white text-sm font-bold rounded-xl hover:bg-[#4744C8] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {loading ? <Spinner size={14} className="text-white"/> : <>Sign in <ArrowRight size={14}/></>}
            </button>
          </form>
          <p className="text-sm text-center text-white/30 mt-6">
            No account?{' '}
            <Link to="/auth/signup" className="text-accent-400 hover:text-accent-300 font-semibold">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPw] = useState('')
  const [name, setName]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [done, setDone]   = useState(false)
  const { signUp } = useAuth()

  const [role, setRole] = useState<'student' | 'teacher'>('student')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setLoading(true)
    const { error: err } = await signUp(email, password, name)
    if (!err) {
      // Role written after session establishes — store in localStorage for onboarding pick-up
      localStorage.setItem('aihub_signup_role', role)
    }
    setLoading(false)
    if (err) setError(err.message)
    else setDone(true)
  }

  if (done) return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-signal-green/20 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={32} className="text-signal-green"/>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
        <p className="text-sm text-white/50">We sent a confirmation link to <span className="text-white/80 font-medium">{email}</span></p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <Zap size={15} className="text-white" strokeWidth={2.5}/>
          </div>
          <span className="text-sm font-bold text-white">AIhub OS</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Create your OS</h1>
        <p className="text-sm text-white/40 mb-8">Free forever. No credit card.</p>
        <form onSubmit={submit} className="space-y-4">
          {[
            { label:'Your name', type:'text', val:name, set:setName, ph:'Aarav Shah' },
            { label:'Email', type:'email', val:email, set:setEmail, ph:'you@example.com' },
            { label:'Password', type:'password', val:password, set:setPw, ph:'8+ characters', min:8 },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-2xs font-bold uppercase tracking-widest text-white/40 mb-2">{f.label}</label>
              <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)}
                placeholder={f.ph} required={f.type !== 'text'}
                minLength={(f as any).min}
                className="w-full px-4 py-3 text-sm bg-white/5 text-white placeholder:text-white/20 border border-white/10 rounded-xl focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"/>
            </div>
          ))}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0"/>
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          {/* Role toggle */}
          <div>
            <p className="text-xs font-semibold text-white/40 mb-2">I am a…</p>
            <div className="grid grid-cols-2 gap-2">
              {([['student', 'Student / Learner'], ['teacher', 'Teacher / Educator']] as const).map(([r, label]) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={cn('py-2.5 px-3 rounded-xl text-xs font-bold border transition-all',
                    role === r
                      ? 'bg-[#5855D6] text-white border-accent-500'
                      : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-[#5855D6] text-white text-sm font-bold rounded-xl hover:bg-[#4744C8] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading ? <Spinner size={14} className="text-white"/> : <>Launch my OS <ArrowRight size={14}/></>}
          </button>
        </form>
        <p className="text-sm text-center text-white/30 mt-6">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-accent-400 hover:text-accent-300 font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD PAGE
// ══════════════════════════════════════════════════════════════════════════════

export function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const { resetPassword } = useAuth()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setLoading(true)
    const { error: err } = await resetPassword(email)
    setLoading(false)
    if (err) setError(err.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link to="/auth/login" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-8 transition-colors">
          <ArrowLeft size={13}/> Back to sign in
        </Link>
        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={26} className="text-emerald-400"/>
            </div>
            <h2 className="text-xl font-extrabold text-white mb-2">Check your email</h2>
            <p className="text-sm text-white/50 leading-relaxed max-w-xs mx-auto">
              We sent a reset link to <span className="text-white/80 font-semibold">{email}</span>. It expires in 24 hours.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">Reset password</h1>
            <p className="text-sm text-white/40 mb-8">We'll send you a link to create a new one.</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-widest text-white/40 mb-2">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                  className="w-full px-4 py-3 text-sm bg-white/5 text-white placeholder:text-white/20 border border-white/10 rounded-xl focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"/>
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0"/>
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
              <button type="submit" disabled={loading || !email}
                className="w-full py-3 bg-[#5855D6] text-white text-sm font-bold rounded-xl hover:bg-[#4744C8] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {loading ? <Spinner size={14} className="text-white"/> : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS PAGE — role change, display name, account info
// ══════════════════════════════════════════════════════════════════════════════

export function SettingsPage() {
  const { user, profile, updateRole, signOut } = useAuth()
  const navigate  = useNavigate()
  const [role,    setRole]    = useState<string>(profile?.role ?? 'student')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => { setRole(profile?.role ?? 'student') }, [profile?.role])

  if (!user) return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <p className="text-sm text-zinc-500 mb-4">Sign in to manage your settings</p>
      <Button onClick={() => navigate('/auth/login')} variant="accent">Sign in</Button>
    </div>
  )

  const saveRole = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      await updateRole(role)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch { setError('Failed to save — please try again') }
    finally { setSaving(false) }
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      <PageHeader
        eyebrow="Account"
        eyebrowIcon={<Target size={13} className="text-zinc-500"/>}
        eyebrowColor="bg-zinc-100 border-zinc-200 text-zinc-600"
        title="Settings"
        subtitle="Manage your account and learning preferences."
      />

      {/* Account info */}
      <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50">
          <h2 className="text-sm font-bold text-zinc-800">Account</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Name</p>
            <p className="text-sm font-semibold text-zinc-800">{profile?.full_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Email</p>
            <p className="text-sm font-semibold text-zinc-800">{user.email}</p>
          </div>
        </div>
      </section>

      {/* Role */}
      <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50">
          <h2 className="text-sm font-bold text-zinc-800">Role</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            Your role changes how the dashboard and content is tailored for you. Teachers get a classroom dashboard and student tracking.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {([
              ['student', 'Student / Learner',   'Track your own progress and learning paths'],
              ['teacher', 'Teacher / Educator',  'Manage a classroom and track student progress'],
            ] as const).map(([r, label, desc]) => (
              <button key={r} onClick={() => setRole(r)}
                className={cn(
                  'flex flex-col gap-1 p-4 rounded-xl border-2 text-left transition-all',
                  role === r ? 'border-accent-500 bg-[#EEEEFF]' : 'border-zinc-200 bg-white hover:border-zinc-300'
                )}>
                <span className={cn('text-sm font-bold', role === r ? 'text-[#4744C8]' : 'text-zinc-800')}>{label}</span>
                <span className="text-xs text-zinc-500 leading-relaxed">{desc}</span>
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-signal-red mb-3">{error}</p>}
          <button onClick={saveRole} disabled={saving || role === profile?.role}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
              saved
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : role !== profile?.role
                  ? 'bg-[#5855D6] text-white hover:bg-[#4744C8]'
                  : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
            )}>
            {saving ? <Spinner size={14}/> : saved ? <><Check size={14}/> Saved</> : 'Save changes'}
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="bg-white border border-red-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-red-100 bg-red-50/50">
          <h2 className="text-sm font-bold text-red-700">Danger zone</h2>
        </div>
        <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-zinc-800">Sign out</p>
            <p className="text-xs text-zinc-500">Your progress is saved and will be here when you return.</p>
          </div>
          <button onClick={() => { signOut(); navigate('/') }}
            className="px-4 py-2 border border-red-200 text-red-600 text-sm font-bold rounded-xl hover:bg-red-50 transition-colors flex-shrink-0">
            Sign out
          </button>
        </div>
      </section>
    </div>
  )
}
// ══════════════════════════════════════════════════════════════════════════════
// NOT FOUND
// ══════════════════════════════════════════════════════════════════════════════

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 px-4 text-center">
      <p className="text-8xl font-black text-zinc-200 mb-4 tracking-tight">404</p>
      <h1 className="text-xl font-bold text-zinc-800 mb-2 tracking-tight">This page doesn't exist</h1>
      <p className="text-sm text-zinc-400 mb-8 max-w-sm">The URL you entered isn't in the OS. Check the address or go home.</p>
      <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink-900 text-white rounded-xl text-sm font-bold hover:bg-ink-800 transition-colors shadow-sm">
        <ArrowLeft size={14}/> Back to home
      </Link>
    </div>
  )
}
