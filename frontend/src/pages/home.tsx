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
import { useFetch, PageLoader, PageError, SectionHeading, PageHeader  } from './shared'

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

  return (
    <div className="px-4 lg:px-8 py-6 max-w-6xl mx-auto">
      <OSHero name={userName ?? undefined}/>
      <StartHereBannerHome/>
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

export const DashboardPage = HomePage
