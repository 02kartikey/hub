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
          Hands-on experiments that put you in direct contact with AI systems exhibiting real behaviours — hallucination, bias, sycophancy. Each exercise starts with a plain-English explanation so you always know what you're looking at.
        </p>
      </div>

      {loading && <PageLoader/>}

      {!loading && data && (
        <div className="grid sm:grid-cols-2 gap-4">
          {data.data.map((exercise, i) => (
            <div key={exercise.id} className="group relative bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col hover:shadow-card-hover hover:border-zinc-300 transition-all duration-200">

              {/* Concept learn strip — top entry point */}
              <Link to={`/playground/${exercise.id}/learn`}
                className="flex items-center gap-2.5 px-5 py-3 border-b border-zinc-100 hover:bg-indigo-50 transition-colors">
                <div className="w-6 h-6 rounded-lg bg-[#5855D6]/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={12} className="text-[#5855D6]"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#5855D6] truncate">
                    What is {exercise.concept}?
                  </p>
                  <p className="text-2xs text-zinc-400">Plain-English explanation · 2 min read</p>
                </div>
                <ChevronRight size={12} className="text-zinc-300 group-hover:text-[#5855D6] transition-colors flex-shrink-0"/>
              </Link>

              {/* Exercise card — direct entry for those who know the concept */}
              <Link to={`/playground/${exercise.id}`} className="flex-1 flex flex-col p-5 pt-4">
                <div className="flex items-start justify-between mb-2.5">
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
                  <span className="ml-auto flex items-center gap-1 text-[#5855D6] font-medium">
                    Start <ArrowRight size={12}/>
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CONCEPT LEARN PAGE — plain-English education before the exercise
// Route: /playground/:id/learn
// ══════════════════════════════════════════════════════════════════════════════

export function ConceptLearnPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: exercise, loading, error } = useFetch(() => api.exercises.get(id!), [id])
  const [expandedMisconception, setExpandedMisconception] = useState<number | null>(null)

  if (loading) return <PageLoader/>
  if (error || !exercise) return <PageError msg={error ?? 'Exercise not found'}/>

  const misconceptions = exercise.misconceptions ?? []
  const realWorldCases = exercise.realWorldCases ?? []
  const perspectives   = exercise.perspectives ?? []
  const behaviourChanges = exercise.behaviourChanges ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-8 pb-24">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8 text-xs">
        <Link to="/playground" className="text-zinc-400 hover:text-zinc-600 transition-colors flex items-center gap-1">
          <ArrowLeft size={11}/> Playground
        </Link>
        <span className="text-zinc-200">/</span>
        <button onClick={() => navigate(`/playground/${id}`)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
          {exercise.title}
        </button>
        <span className="text-zinc-200">/</span>
        <span className="text-zinc-500 font-medium">Concept guide</span>
      </div>

      {/* Header */}
      <div className="mb-10">
        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold mb-4', exercise.badgeColor)}>
          {exercise.concept}
        </span>
        <h1 className="text-3xl font-extrabold text-zinc-900 leading-tight tracking-tight mb-3">
          What is {exercise.concept}?
        </h1>
        <p className="text-base text-zinc-500 leading-relaxed">
          {exercise.whyItMatters ?? exercise.tagline}
        </p>
      </div>

      {/* ── The core idea in one plain sentence ── */}
      {exercise.coreConcept && (
        <section className="mb-8">
          <div className="rounded-2xl p-6 border-l-4 border-[#5855D6]" style={{ background: 'linear-gradient(135deg, #F5F5FF 0%, #EEEEFF 100%)', borderColor: '#5855D6' }}>
            <p className="text-2xs font-bold uppercase tracking-widest text-[#5855D6] mb-2">The core idea</p>
            <p className="text-sm font-semibold text-zinc-800 leading-relaxed">{exercise.coreConcept}</p>
          </div>
        </section>
      )}

      {/* ── How it actually works ── */}
      {exercise.mechanism && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-zinc-900 mb-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Zap size={12} className="text-amber-600"/>
            </div>
            How it actually happens
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">{exercise.mechanism}</p>
        </section>
      )}

      {/* ── Real-world cases ── */}
      {realWorldCases.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={12} className="text-red-500"/>
            </div>
            Real cases where this caused harm
          </h2>
          <div className="space-y-3">
            {realWorldCases.map((c: any, i: number) => (
              <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-red-500">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 mb-1">{c.title}</p>
                    <p className="text-xs text-zinc-500 leading-relaxed mb-2">{c.context}</p>
                    {c.what && <p className="text-xs text-zinc-600 leading-relaxed mb-1.5">{c.what}</p>}
                    {c.consequence && (
                      <p className="text-xs font-medium text-red-600 bg-red-50 rounded-lg px-3 py-1.5">
                        ⚠ {c.consequence}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Common misconceptions ── */}
      {misconceptions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <AlertCircle size={12} className="text-orange-500"/>
            </div>
            Common misconceptions
          </h2>
          <div className="space-y-2">
            {misconceptions.map((m: any, i: number) => (
              <div key={i} className="border border-zinc-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedMisconception(expandedMisconception === i ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-zinc-50 transition-colors text-left">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm flex-shrink-0">❌</span>
                    <p className="text-sm font-medium text-zinc-700 truncate">{m.myth}</p>
                  </div>
                  <ChevronRight size={14} className={cn('flex-shrink-0 text-zinc-300 transition-transform', expandedMisconception === i && 'rotate-90')}/>
                </button>
                {expandedMisconception === i && (
                  <div className="px-4 pb-4 pt-1 bg-emerald-50 border-t border-emerald-100">
                    <p className="text-2xs font-bold uppercase tracking-widest text-emerald-600 mb-1.5">✓ Reality</p>
                    <p className="text-sm text-zinc-700 leading-relaxed">{m.reality}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Different perspectives ── */}
      {perspectives.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Users size={12} className="text-blue-500"/>
            </div>
            How different people see this
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {perspectives.map((p: any, i: number) => (
              <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">{p.role ?? p.group}</p>
                <p className="text-sm text-zinc-700 leading-relaxed">{p.view ?? p.perspective}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── What changes once you understand this ── */}
      {behaviourChanges.length > 0 && (
        <section className="mb-10">
          <h2 className="text-base font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={12} className="text-emerald-600"/>
            </div>
            What you'll do differently after this
          </h2>
          <div className="space-y-2">
            {behaviourChanges.map((b: any, i: number) => (
              <div key={i} className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
                {typeof b === 'string' ? (
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check size={10} className="text-emerald-600" strokeWidth={3}/>
                    </div>
                    <p className="text-sm text-zinc-700 leading-relaxed">{b}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {b.situation && <p className="text-2xs font-bold uppercase tracking-widest text-zinc-400">{b.situation}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-red-50 rounded-lg px-3 py-2">
                        <p className="text-2xs font-bold text-red-400 mb-1">Before</p>
                        <p className="text-xs text-red-700 leading-relaxed">{b.oldBehaviour}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg px-3 py-2">
                        <p className="text-2xs font-bold text-emerald-500 mb-1">After</p>
                        <p className="text-xs text-emerald-700 leading-relaxed">{b.newBehaviour}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Sticky CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-zinc-100 px-4 py-4 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-zinc-900 truncate">{exercise.title}</p>
            <p className="text-2xs text-zinc-400">{exercise.estimatedMinutes} min · {exercise.stages?.length ?? 0} stages</p>
          </div>
          <button onClick={() => navigate(`/playground/${id}`)}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-3 bg-[#5855D6] text-white text-sm font-bold rounded-xl hover:bg-[#4744C8] transition-colors"
            style={{ boxShadow: '0 4px 16px rgba(88,85,214,0.3)' }}>
            Start the exercise <ArrowRight size={14}/>
          </button>
        </div>
      </div>

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
            <Link to={`/playground/${exercise.id}/learn`}
              className="hidden sm:flex items-center gap-1 text-2xs font-semibold text-[#5855D6] hover:underline transition-colors">
              <BookOpen size={10}/> Concept guide
            </Link>
            <span className="text-zinc-200 hidden sm:block">·</span>
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
