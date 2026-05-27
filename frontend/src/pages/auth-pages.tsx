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
  PageHeader,
} from './shared'

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
          <p className="text-sm text-white/40 mb-3">Sign in to your operating system</p>
          <Link to="/try" className="inline-flex items-center gap-1.5 text-xs text-accent-400 hover:text-accent-300 font-semibold transition-colors mb-6">
            ← Try without an account first
          </Link>
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
            New to AIhub?{' '}
            <Link to="/auth/signup" className="text-accent-400 hover:text-accent-300 font-semibold">Create your free OS →</Link>
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
        <p className="text-sm text-white/40 mb-2">Free forever. No credit card.</p>
        <Link to="/try" className="inline-flex items-center gap-1.5 text-xs text-accent-400 hover:text-accent-300 font-semibold transition-colors mb-1">
          ← See a demo first — no account needed
        </Link>
        <p className="text-sm text-white/30 mb-8">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-accent-400 hover:text-accent-300 font-semibold transition-colors">Sign in</Link>
        </p>
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
          {/* Role toggle — simple and clear */}
          <div>
            <label className="block text-2xs font-bold uppercase tracking-widest text-white/40 mb-2">I am a</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: 'student', label: '🎓 Student' },
                { val: 'teacher', label: '📚 Teacher' },
                { val: 'curious', label: '🔍 Explorer' },
              ] as const).map(r => (
                <button key={r.val} type="button" onClick={() => setRole(r.val as any)}
                  className={cn(
                    'py-2.5 text-xs font-bold rounded-xl border transition-all',
                    role === r.val
                      ? 'bg-[#5855D6] border-[#5855D6] text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  )}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
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
    const { error: err } = await updateRole(role)
    setSaving(false)
    if (err) {
      setError('Failed to save role — please try again')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
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

      {/* Account actions */}
      <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <h2 className="text-sm font-bold text-zinc-700">Account actions</h2>
        </div>
        <div className="divide-y divide-zinc-100">
          <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-zinc-800">Sign out</p>
              <p className="text-xs text-zinc-500">Your progress is saved and will be here when you return.</p>
            </div>
            <button onClick={() => { signOut(); navigate('/') }}
              className="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-bold rounded-xl hover:bg-zinc-50 transition-colors flex-shrink-0">
              Sign out
            </button>
          </div>
          <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-zinc-800">Reset progress</p>
              <p className="text-xs text-zinc-500">Clears local learning progress. Use if you want to start fresh.</p>
            </div>
            <button onClick={() => {
              if (window.confirm('Reset all local progress? This cannot be undone.')) {
                localStorage.removeItem('aihub_progress')
                localStorage.removeItem('quiz_scores')
                window.location.reload()
              }
            }}
              className="px-4 py-2 border border-red-200 text-red-600 text-sm font-bold rounded-xl hover:bg-red-50 transition-colors flex-shrink-0">
              Reset progress
            </button>
          </div>
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
