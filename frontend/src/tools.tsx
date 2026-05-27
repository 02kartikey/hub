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
import { useFetch, PageLoader, PageError } from './shared'

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

export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Workflow | null>(null)
  const [filter, setFilter]       = useState<string>('All')
  const { profile } = useAuth()

  useEffect(() => {
    const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
    fetch(`${base}/api/workflows`)
      .then(r => r.json())
      .then(d => { setWorkflows(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (selected) return <WorkflowDetail wf={selected} onBack={() => setSelected(null)}/>

  const role       = profile?.role ?? 'student'
  const categories = ['All', ...Array.from(new Set(workflows.map(w => w.category)))]
  const filtered   = workflows.filter(w =>
    (filter === 'All' || w.category === filter) &&
    (w.audience.includes(role) || w.audience.includes('curious'))
  )

  return (
    <div className="px-4 lg:px-8 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100 mb-4">
          <Layers size={13} className="text-violet-600"/>
          <span className="text-xs font-semibold text-violet-700">Multi-tool projects</span>
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">AI Workflows</h1>
        <p className="text-sm text-zinc-500 max-w-xl leading-relaxed">
          Practical projects that combine multiple AI tools in sequence. Start here after you know what each tool does individually — these are the things you actually build.
        </p>
        <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5">
          <BookOpen size={11}/> New to these tools? Start with <Link to="/tools" className="text-[#5855D6] font-semibold hover:underline">AI Tool Guides</Link> first.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-7">
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
              filter === c
                ? 'bg-ink-900 text-white border-ink-900'
                : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'
            )}>
            {c}
          </button>
        ))}
      </div>

      {loading ? <PageLoader/> : filtered.length === 0 ? (
        <EmptyState title="No workflows yet" description="More being added. Check the AI Tool Guides in the meantime."/>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(wf => (
            <WorkflowCard key={wf.id} wf={wf} onClick={() => setSelected(wf)}/>
          ))}
        </div>
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
