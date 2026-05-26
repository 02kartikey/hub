import React, { useState, useEffect, useMemo } from 'react'
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
import { useFetch, PageLoader, PageError, SectionHeading, PageHeader } from './shared'

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
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center py-14 bg-white rounded-2xl text-center" style={{ border:"1px solid var(--border)" }}>
            <Video size={28} className="text-zinc-300 mb-3"/>
            <p className="text-sm font-semibold text-zinc-600 mb-1">Seminars are being curated</p>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs">Structured courses from MIT, DeepLearning.AI, fast.ai, and ISTE are being added. Explore all resources in the meantime.</p>
            <div className="flex gap-3 mt-5">
              <Link to="/browse" className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#5855D6] text-white text-xs font-bold rounded-lg hover:bg-[#4744C8] transition-colors">
                Browse all resources <ArrowRight size={12}/>
              </Link>
              <Link to="/curriculum" className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 text-xs font-bold rounded-lg hover:bg-zinc-50 transition-colors">
                Learning paths
              </Link>
            </div>
          </div>
          {/* Show courses and guides as useful fallback */}
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Meanwhile — curated courses and guides</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { title: 'Elements of AI', href: 'https://www.elementsofai.com', tag: 'Free course', sub: 'University of Helsinki · Beginner' },
              { title: 'Fast.ai — Practical Deep Learning', href: 'https://fast.ai', tag: 'Free course', sub: 'fast.ai · Intermediate' },
              { title: 'AI for Everyone — Coursera', href: 'https://www.coursera.org/learn/ai-for-everyone', tag: 'Course', sub: 'Andrew Ng · Beginner' },
            ].map(c => (
              <a key={c.href} href={c.href} target="_blank" rel="noreferrer"
                className="group flex flex-col gap-2 p-4 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 hover:shadow-card transition-all">
                <span className="text-2xs font-bold text-[#5855D6] bg-indigo-50 px-2 py-0.5 rounded self-start">{c.tag}</span>
                <p className="text-xs font-bold text-zinc-800 group-hover:text-[#5855D6] transition-colors leading-snug">{c.title}</p>
                <p className="text-2xs text-zinc-400">{c.sub}</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// WORKFLOWS PAGE
// ══════════════════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════════
// WORKFLOWS PAGE — multi-tool practical project workflows
// ══════════════════════════════════════════════════════════════════════════════

interface WorkflowPhaseStep {
  id: string; title: string; content: string
  prompt?: string; tip?: string; warning?: string; output?: string
}
interface WorkflowPhase {
  id: string; title: string; tool: string; duration: string
  objective: string; steps: WorkflowPhaseStep[]; output: string
}
interface Workflow {
  id: string; title: string; tagline: string
  difficulty: string; duration: string; tools: string[]
  category: string; audience: string[]
  prerequisites: string[]; whatYouBuild: string
  realWorldUse: string; phases: WorkflowPhase[]
  keyTakeaway: string
}

const CATEGORY_COLORS: Record<string, string> = {
  Academic:         'bg-blue-50 text-blue-700 border-blue-100',
  'Exam Prep':      'bg-violet-50 text-violet-700 border-violet-100',
  Teaching:         'bg-amber-50 text-amber-700 border-amber-100',
  Research:         'bg-emerald-50 text-emerald-700 border-emerald-100',
  Building:         'bg-rose-50 text-rose-700 border-rose-100',
  'Critical Thinking': 'bg-orange-50 text-orange-700 border-orange-100',
}

const TOOL_COLORS: Record<string, string> = {
  'Perplexity':  'bg-sky-100 text-sky-800',
  'NotebookLM':  'bg-amber-100 text-amber-800',
  'Gamma':       'bg-violet-100 text-violet-800',
  'Claude':      'bg-orange-100 text-orange-800',
  'Khanmigo':    'bg-emerald-100 text-emerald-800',
  'Quizlet AI':  'bg-blue-100 text-blue-800',
  'Canva AI':    'bg-pink-100 text-pink-800',
  'Otter.ai':    'bg-indigo-100 text-indigo-800',
  'Replit':      'bg-zinc-100 text-zinc-800',
  'Consensus':   'bg-teal-100 text-teal-800',
}

function ToolChip({ name }: { name: string }) {
  const cls = TOOL_COLORS[name] ?? 'bg-zinc-100 text-zinc-600'
  return (
    <span className={cn('text-2xs font-bold px-2 py-0.5 rounded-full', cls)}>{name}</span>
  )
}

// Workflow card on listing page
function WorkflowCard({ wf, onClick }: { wf: Workflow; onClick: () => void }) {
  const catCls = CATEGORY_COLORS[wf.category] ?? 'bg-zinc-50 text-zinc-600 border-zinc-100'
  return (
    <button onClick={onClick}
      className="w-full group bg-white border border-zinc-200 rounded-2xl p-5 text-left hover:border-zinc-300 hover:shadow-card-hover transition-all duration-200 flex flex-col">
      {/* Category + difficulty */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={cn('text-2xs font-bold px-2.5 py-1 rounded-full border', catCls)}>
          {wf.category}
        </span>
        <Badge variant={wf.difficulty as any}/>
        <span className="text-2xs text-zinc-400 flex items-center gap-1 ml-auto">
          <Clock size={10}/> {wf.duration}
        </span>
      </div>

      {/* Title + tagline */}
      <h3 className="text-base font-bold text-zinc-900 mb-1 group-hover:text-[#5855D6] transition-colors leading-snug">
        {wf.title}
      </h3>
      <p className="text-xs text-zinc-500 leading-relaxed mb-4 flex-1">{wf.tagline}</p>

      {/* What you build */}
      <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 mb-4">
        <p className="text-2xs font-bold text-zinc-400 uppercase tracking-widest mb-1">What you build</p>
        <p className="text-xs text-zinc-600 leading-relaxed">{wf.whatYouBuild}</p>
      </div>

      {/* Tool chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {wf.tools.map((t, i) => (
          <React.Fragment key={t}>
            <ToolChip name={t}/>
            {i < wf.tools.length - 1 && <span className="text-zinc-300 text-2xs">→</span>}
          </React.Fragment>
        ))}
      </div>
    </button>
  )
}

// Full workflow detail view
function WorkflowDetail({ wf, onBack }: { wf: Workflow; onBack: () => void }) {
  const [activePhase, setActivePhase] = useState<string | null>(null)
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(new Set())
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const phase = wf.phases.find(p => p.id === activePhase)

  const toggleStep = (id: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const completePhase = (phaseId: string) => {
    setCompletedPhases(prev => new Set([...prev, phaseId]))
    setActivePhase(null)
  }

  if (activePhase && phase) return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 animate-fade-in">
      <button onClick={() => setActivePhase(null)}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 mb-5 transition-colors font-semibold">
        <ArrowLeft size={12}/> Back to workflow
      </button>

      {/* Phase header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-8 h-8 rounded-full bg-ink-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
          {wf.phases.indexOf(phase) + 1}
        </div>
        <div>
          <p className="text-2xs font-bold text-zinc-400 uppercase tracking-widest mb-1">
            Phase {wf.phases.indexOf(phase) + 1} · <ToolChip name={phase.tool}/>
          </p>
          <h2 className="text-xl font-bold text-zinc-900 mb-1 leading-snug">{phase.title}</h2>
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1"><Clock size={11}/> {phase.duration}</span>
          </div>
        </div>
      </div>

      {/* Objective */}
      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl mb-6">
        <p className="text-2xs font-bold text-indigo-600 uppercase tracking-widest mb-1.5">Objective</p>
        <p className="text-sm text-indigo-900 leading-relaxed">{phase.objective}</p>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-6">
        {phase.steps.map((step, i) => (
          <div key={step.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <button onClick={() => toggleStep(step.id)}
              className="w-full flex items-center gap-3 px-5 py-4 bg-zinc-50 border-b border-zinc-100 text-left hover:bg-zinc-100 transition-colors">
              <span className="w-6 h-6 rounded-full bg-ink-900 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <h4 className="text-sm font-bold text-zinc-800 flex-1">{step.title}</h4>
              {expandedSteps.has(step.id)
                ? <ChevronDown size={14} className="text-zinc-400 flex-shrink-0"/>
                : <ChevronRight size={14} className="text-zinc-400 flex-shrink-0"/>
              }
            </button>
            {expandedSteps.has(step.id) && (
              <div className="p-5 space-y-3 animate-fade-in">
                <p className="text-sm text-zinc-700 leading-relaxed">{step.content}</p>
                {step.prompt && (
                  <div className="bg-ink-950 rounded-xl p-4">
                    <p className="text-2xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Prompt to use</p>
                    <p className="text-xs text-emerald-300 font-mono leading-relaxed whitespace-pre-wrap">{step.prompt}</p>
                  </div>
                )}
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
            )}
          </div>
        ))}
      </div>

      {/* Phase output */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6">
        <p className="text-2xs font-bold text-emerald-700 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
          <CheckCircle2 size={11}/> Phase output
        </p>
        <p className="text-sm text-emerald-900 leading-relaxed">{phase.output}</p>
      </div>

      <button onClick={() => completePhase(phase.id)}
        className="w-full py-3.5 bg-ink-900 text-white text-sm font-bold rounded-xl hover:bg-ink-800 transition-colors flex items-center justify-center gap-2">
        Mark phase complete → {wf.phases.indexOf(phase) < wf.phases.length - 1 ? 'next phase' : 'finish workflow'}
      </button>
    </div>
  )

  // Workflow overview
  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 animate-fade-in">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 mb-5 transition-colors font-semibold">
        <ArrowLeft size={12}/> All workflows
      </button>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden mb-7 px-6 py-7"
        style={{ background: 'linear-gradient(135deg, #0A0A0B 0%, #1A1840 55%, #2D2880 100%)' }}>
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 0)', backgroundSize: '20px 20px' }}/>
        <div className="relative">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={cn('text-2xs font-bold px-2.5 py-1 rounded-full border',
              CATEGORY_COLORS[wf.category] ?? 'bg-zinc-50 text-zinc-600 border-zinc-100')}>
              {wf.category}
            </span>
            <Badge variant={wf.difficulty as any}/>
            <span className="text-2xs text-white/40 flex items-center gap-1">
              <Clock size={10}/> {wf.duration}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-2 tracking-tight leading-snug">{wf.title}</h1>
          <p className="text-sm text-white/50 mb-5 leading-relaxed max-w-lg">{wf.tagline}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {wf.tools.map((t, i) => (
              <React.Fragment key={t}>
                <span className="text-xs font-bold text-white/80">{t}</span>
                {i < wf.tools.length - 1 && <ArrowRight size={11} className="text-white/30"/>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* What you build + real-world use */}
      <div className="grid sm:grid-cols-2 gap-4 mb-7">
        <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl">
          <p className="text-2xs font-bold text-zinc-400 uppercase tracking-widest mb-2">What you build</p>
          <p className="text-sm text-zinc-700 leading-relaxed">{wf.whatYouBuild}</p>
        </div>
        <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl">
          <p className="text-2xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Real-world use</p>
          <p className="text-sm text-zinc-700 leading-relaxed">{wf.realWorldUse}</p>
        </div>
      </div>

      {/* Phases */}
      <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">
        {wf.phases.length} phases · click to start each
      </h2>
      <div className="space-y-3 mb-7">
        {wf.phases.map((p, i) => {
          const done = completedPhases.has(p.id)
          return (
            <button key={p.id} onClick={() => setActivePhase(p.id)}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all group',
                done ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-200 hover:border-[#C0BFEF] hover:shadow-card'
              )}>
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all',
                done ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-500 group-hover:bg-[#EEEEFF] group-hover:text-[#5855D6]'
              )}>
                {done ? <CheckCircle2 size={15}/> : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <h3 className={cn('text-sm font-semibold leading-snug',
                    done ? 'text-emerald-800' : 'text-zinc-800 group-hover:text-[#5855D6] transition-colors')}>
                    {p.title}
                  </h3>
                  <ToolChip name={p.tool}/>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-1">{p.objective}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-zinc-400 flex items-center gap-1"><Clock size={11}/> {p.duration}</span>
                <ChevronRight size={14} className={cn('transition-colors', done ? 'text-emerald-400' : 'text-zinc-300 group-hover:text-[#5855D6]')}/>
              </div>
            </button>
          )
        })}
      </div>

      {/* Key takeaway */}
      <div className="p-5 bg-ink-900 rounded-2xl">
        <p className="text-2xs font-bold text-accent-300 uppercase tracking-widest mb-2">Key takeaway</p>
        <p className="text-sm text-white/75 leading-relaxed">{wf.keyTakeaway}</p>
      </div>

      {completedPhases.size === wf.phases.length && (
        <div className="mt-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0"/>
          <p className="text-sm font-bold text-emerald-800">Workflow complete! Try another, or take what you built to the Playground.</p>
        </div>
      )}
    </div>
  )
}
