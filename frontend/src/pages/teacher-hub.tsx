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
import {
  useFetch,
  PageLoader,
  PageError,
  SectionHeading,
  PageHeader,
} from './shared'

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
