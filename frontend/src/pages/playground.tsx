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
