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
import { api, API_BASE } from '../api'
import type { Assignment, StudentRow, Classroom } from '../api'
import type { Resource, LearningPath, ClassroomActivity, DeepExercise, Message } from '../types'
import type { PathQuiz, QuizQuestion } from '../api'
import { useAuth, useProgress, useBookmarks, getOnboardingProfile, supabase } from '../auth'
import { checkAndAward, awardBadge, useBadges, BadgeCard, BADGES, getEarnedBadges, BadgesPage } from '../badges'
import { useFetch, PageLoader, PageError } from './shared'

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
        const res = await fetch(`${API_BASE}/api/quiz-results`, { headers: { 'Authorization': `Bearer ${token}` } })
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
  // Route is /assessment/:pathId — must destructure as pathId, not id
  const { pathId } = useParams<{ pathId: string }>()
  const navigate = useNavigate()
  // Guard: never call the API until pathId is known — prevents /api/quizzes/undefined
  const { data: quiz, loading, error } = useFetch(
    () => pathId ? api.quizzes.get(pathId) : Promise.reject(new Error('No path ID')),
    [pathId]
  )
  const { progressMap } = useProgress()

  // Adaptive state
  const [difficulty, setDifficulty]   = useState<'beginner'|'intermediate'|'advanced'>('beginner')
  const [answered,   setAnswered]     = useState<Record<string, number>>({})
  const [history,    setHistory]      = useState<{ qIdx: number; correct: boolean; difficulty: string }[]>([])
  const [showExp,    setShowExp]      = useState(false)
  const [streak,     setStreak]       = useState(0)
  const [qIndex,     setQIndex]       = useState(0)
  const [stage,      setStage]        = useState<'quiz'|'results'>('quiz')
  const { award } = useBadges()

  // Difficulty bands — if quiz has typed questions, use them; else treat all as one band
  const DIFF_ORDER: Array<'beginner'|'intermediate'|'advanced'> = ['beginner','intermediate','advanced']

  // Group questions by difficulty if they have a difficulty field, else treat as one pool
  const grouped = useMemo(() => {
    if (!quiz) return { beginner:[], intermediate:[], advanced:[] }
    const g: Record<string, any[]> = { beginner:[], intermediate:[], advanced:[] }
    quiz.questions.forEach((q: any) => {
      const d = q.difficulty ?? 'beginner'
      g[d] = [...(g[d] ?? []), q]
    })
    return g as Record<'beginner'|'intermediate'|'advanced', any[]>
  }, [quiz])

  const pool   = useMemo(() => grouped[difficulty] ?? quiz?.questions ?? [], [grouped, difficulty, quiz])
  const q      = pool[qIndex % Math.max(pool.length, 1)]
  const isAnswered = q && answered[q.id] !== undefined
  const wasCorrect = isAnswered && answered[q.id] === q.answer

  if (loading) return <PageLoader/>
  if (error || !quiz) return <PageError msg={error ?? 'Quiz not found'}/>

  const correctCount = history.filter(h => h.correct).length
  const score        = history.length > 0 ? Math.round((correctCount / history.length) * 100) : 0
  const passed       = score >= (quiz.passingScore ?? 70)

  const selectAnswer = (idx: number) => {
    if (isAnswered) return
    const correct = idx === q.answer
    const newStreak = correct ? streak + 1 : 0
    setAnswered(prev => ({ ...prev, [q.id]: idx }))
    setShowExp(true)
    setStreak(newStreak)
    setHistory(prev => [...prev, { qIdx: qIndex, correct, difficulty }])

    // Adaptive difficulty: go up after 2 correct, down after 1 wrong
    if (correct && newStreak >= 2 && difficulty !== 'advanced' && grouped[DIFF_ORDER[DIFF_ORDER.indexOf(difficulty)+1]]?.length > 0) {
      setTimeout(() => {
        setDifficulty(DIFF_ORDER[DIFF_ORDER.indexOf(difficulty)+1])
        setQIndex(0); setShowExp(false)
      }, 1800)
    } else if (!correct && difficulty !== 'beginner') {
      setTimeout(() => {
        setDifficulty(DIFF_ORDER[DIFF_ORDER.indexOf(difficulty)-1])
        setQIndex(0); setShowExp(false)
      }, 1800)
    }
  }

  const next = () => {
    setShowExp(false)
    if (qIndex + 1 >= pool.length || history.length >= quiz.questions.length) {
      setStage('results')
      // Save score + award badges
      const prev = (() => { try { return JSON.parse(localStorage.getItem('quiz_scores') ?? '{}') } catch { return {} } })()
      localStorage.setItem('quiz_scores', JSON.stringify({ ...prev, [quiz.pathId]: score }))
      if (passed) {
        const badges = checkAndAward({ progressMap, pathsCompleted: 0, quizPassed: true })
        if (badges.length) award(badges)
      }
    } else {
      setQIndex(i => i + 1)
    }
  }

  if (stage === 'results') return (
    <div className="max-w-xl mx-auto px-4 py-10 text-center">
      <div className={cn(
        'w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl font-black',
        score >= 90 ? 'bg-emerald-100 text-emerald-700' :
        score >= 70 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
      )}>
        {score}%
      </div>
      <h2 className="text-2xl font-extrabold text-zinc-900 mb-2 tracking-tight">
        {score >= 90 ? 'Outstanding.' : score >= 70 ? 'Solid work.' : 'Keep going.'}
      </h2>
      <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
        {correctCount} of {history.length} correct · Peak difficulty: <span className="font-semibold capitalize">{difficulty}</span>
        {streak > 2 && ` · Best streak: ${streak}`}
      </p>
      <div className="grid grid-cols-3 gap-3 mb-7">
        {[
          { label: 'Score',     val: `${score}%` },
          { label: 'Answered',  val: history.length },
          { label: 'Correct',   val: correctCount },
        ].map(s => (
          <div key={s.label} className="bg-zinc-50 border border-zinc-100 rounded-xl p-3">
            <p className="text-xl font-extrabold text-zinc-900">{s.val}</p>
            <p className="text-2xs text-zinc-400 font-medium">{s.label}</p>
          </div>
        ))}
      </div>
      <div className={cn(
        'p-4 rounded-xl text-left mb-6 border',
        passed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
      )}>
        <p className={cn('text-xs font-bold uppercase tracking-widest mb-1', passed ? 'text-emerald-700' : 'text-amber-700')}>
          {passed ? "✓ Passed" : "Not yet — here's what to do"}
        </p>
        <p className={cn('text-sm leading-relaxed', passed ? 'text-emerald-800' : 'text-amber-900')}>
          {passed
            ? "You've demonstrated solid understanding. Explore the next path or dive deeper into the Playground."
            : 'Review the learning path resources, then retry. Focus on the questions you got wrong — the explanations above tell you exactly why.'}
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => { setAnswered({}); setHistory([]); setQIndex(0); setStreak(0); setDifficulty('beginner'); setStage('quiz') }}
          className="flex-1 py-3 bg-zinc-100 text-zinc-700 text-sm font-bold rounded-xl hover:bg-zinc-200 transition-colors">
          Retry
        </button>
        <button onClick={() => navigate(passed ? '/curriculum' : `/paths/${pathId}`)}
          className="flex-1 py-3 bg-ink-900 text-white text-sm font-bold rounded-xl hover:bg-ink-800 transition-colors flex items-center justify-center gap-2">
          {passed ? 'Next path' : 'Review path'} <ArrowRight size={14}/>
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Adaptive difficulty indicator */}
      <div className="flex items-center gap-3 mb-5 p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
        <div className="flex-1">
          <div className="flex justify-between text-2xs mb-1.5">
            <span className="text-zinc-400">Adaptive difficulty</span>
            <span className={cn('font-bold capitalize',
              difficulty === 'advanced' ? 'text-[#5855D6]' :
              difficulty === 'intermediate' ? 'text-amber-600' : 'text-emerald-600'
            )}>{difficulty}</span>
          </div>
          <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: difficulty === 'beginner' ? '33%' : difficulty === 'intermediate' ? '66%' : '100%',
                background: difficulty === 'advanced' ? '#5855D6' : difficulty === 'intermediate' ? '#F59E0B' : '#10B981'
              }}/>
          </div>
        </div>
        {streak >= 2 && <span className="text-xs font-bold text-amber-600 flex-shrink-0">🔥 {streak} streak</span>}
        <span className="text-2xs text-zinc-400 flex-shrink-0">{history.length + 1} / {quiz.questions.length}</span>
      </div>

      {streak === 2 && !isAnswered && (
        <div className="mb-4 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
          <p className="text-xs font-semibold text-[#5855D6]">✨ 2 correct — moving to harder questions</p>
        </div>
      )}

      {/* Question */}
      {q && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 mb-4">
          <div className="flex justify-between items-center mb-4">
            <span className={cn('text-2xs font-bold px-2.5 py-1 rounded-full capitalize',
              difficulty === 'advanced' ? 'bg-indigo-50 text-[#5855D6]' :
              difficulty === 'intermediate' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            )}>{difficulty}</span>
            <span className="text-2xs text-zinc-400">Question {history.length + 1}</span>
          </div>
          <p className="text-base font-semibold text-zinc-900 leading-snug mb-5">{q.question}</p>
          <div className="space-y-2.5">
            {q.options.map((opt: string, i: number) => {
              const sel      = answered[q.id] === i
              const correct  = i === q.answer
              const revealed = isAnswered
              return (
                <button key={i} onClick={() => selectAnswer(i)} disabled={revealed}
                  className={cn(
                    'w-full flex items-center gap-3 p-3.5 rounded-xl border text-left text-sm transition-all',
                    !revealed               ? 'bg-white border-zinc-200 hover:border-[#5855D6] hover:bg-indigo-50 cursor-pointer' :
                    correct                 ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                    sel && !correct         ? 'bg-red-50 border-red-300 text-red-900' :
                                              'bg-white border-zinc-100 text-zinc-400 cursor-default'
                  )}>
                  <span className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold flex-shrink-0 border',
                    !revealed               ? 'border-zinc-300 text-zinc-500' :
                    correct                 ? 'bg-emerald-500 border-emerald-500 text-white' :
                    sel                     ? 'bg-red-500 border-red-500 text-white' :
                                              'border-zinc-200 text-zinc-300'
                  )}>
                    {revealed && correct ? '✓' : revealed && sel ? '✗' : 'ABCD'[i]}
                  </span>
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Explanation */}
      {showExp && q && (
        <div className={cn(
          'p-4 rounded-xl border mb-4',
          wasCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
        )}>
          <p className={cn('text-xs font-bold mb-2', wasCorrect ? 'text-emerald-700' : 'text-amber-700')}>
            {wasCorrect ? "✅ Correct" : "❌ Not quite — here's why"}
          </p>
          <p className={cn('text-sm leading-relaxed', wasCorrect ? 'text-emerald-800' : 'text-amber-900')}>
            {q.explanation}
          </p>
          {!wasCorrect && (
            <p className={cn('mt-2 text-xs font-semibold text-amber-700')}>
              Correct answer: {q.options[q.answer]}
            </p>
          )}
        </div>
      )}

      {isAnswered && (
        <button onClick={next}
          className="w-full py-3 bg-ink-900 text-white text-sm font-bold rounded-xl hover:bg-ink-800 transition-colors flex items-center justify-center gap-2">
          {history.length >= quiz.questions.length - 1 ? 'See results →' : 'Next question →'}
        </button>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CURRICULUM PAGE
// ══════════════════════════════════════════════════════════════════════════════
