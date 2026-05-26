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
import { HomePage } from './home'

// ══════════════════════════════════════════════════════════════════════════════
// BROWSE PAGE
// ══════════════════════════════════════════════════════════════════════════════

// Alias — App.tsx routes /dashboard to DashboardPage
export const DashboardPage = HomePage

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
  const [paths, setPaths] = useState<LearningPath[]>([])
  useEffect(() => { api.paths.list().then(r => setPaths(r.data)).catch(() => {}) }, [])

  const handleClick = () => {
    const wasNotDone = !done
    markComplete(resource.id, !done)
    if (wasNotDone) {
      setBurst(true); setTimeout(() => setBurst(false), 1200)
      const nextMap = { ...progressMap, [resource.id]: 100 }
      // Count actually completed paths
      const pathsCompleted = paths.filter(p =>
        p.resourceIds.length > 0 &&
        p.resourceIds.every(id => (nextMap[id] ?? 0) === 100)
      ).length
      const newBadges = checkAndAward({ progressMap: nextMap, pathsCompleted })
      if (newBadges.length) window.dispatchEvent(new CustomEvent('aihub:badges', { detail: newBadges }))
      // Night owl
      const hour = new Date().getHours()
      if (hour >= 22 || hour < 4) {
        const nb2 = checkAndAward({ progressMap: nextMap, pathsCompleted })
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
            {(() => {
              if (resource.duration) return (
                <span className="flex items-center gap-1.5"><Clock size={13}/> {resource.duration}</span>
              )
              const est: Record<string,string> = {
                book:'~6–8 hr read', article:'~10 min read', guide:'~20 min read',
                course:'~4–6 hr', seminar:'~2–3 hr', pdf:'~30 min read',
                walkthrough:'~15 min',
              }
              return est[resource.type] ? (
                <span className="flex items-center gap-1.5 italic text-zinc-400"><Clock size={13}/> {est[resource.type]}</span>
              ) : null
            })()}
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
