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
// CHAT PAGE — general AI literacy chat
// ══════════════════════════════════════════════════════════════════════════════

const CHAT_STARTERS_BY_ROLE: Record<string, string[]> = {
  teacher: [
    'How do I teach AI hallucination to Class 9 students?',
    'Design an AI-proof assessment for CBSE.',
    'What ethical issues should I cover in my AI unit?',
    'How do I integrate AI tools without harming student thinking?',
    'Give me a 45-minute lesson plan on AI bias.',
  ],
  student: [
    'Why does AI make things up? Explain the mechanism.',
    'What is sycophancy in AI and why does it happen?',
    'How do I prepare for CBSE AI Code 417?',
    'What is the difference between supervised and reinforcement learning?',
    'What should I know before trusting AI outputs?',
  ],
  curious: [
    'Explain AI hallucination like I have no tech background.',
    'What is the most important thing to understand about AI?',
    'Is AI actually intelligent?',
    'What are the real risks of AI?',
    'How do I use AI without being misled?',
  ],
}

function buildChatSystemPrompt(): string {
  let role = 'student', board = '', goals: string[] = []
  try {
    const raw = localStorage.getItem('aihub_onboarding')
    if (raw) { const p = JSON.parse(raw); role = p.role ?? 'student'; board = p.board ?? ''; goals = p.goals ?? [] }
  } catch {}
  const roleLabel = role === 'teacher' ? 'an educator' : role === 'curious' ? 'a curious learner' : 'a student'
  const boardLine = board ? `\nThe user follows the ${board} curriculum.` : ''
  const goalsLine = goals.length ? `\nTheir stated learning goals: ${goals.join(', ')}.` : ''
  return `You are an expert AI literacy tutor on AIhub. You are speaking with ${roleLabel}.${boardLine}${goalsLine}

Your job: help this person genuinely understand AI. Personalise language, examples, and depth to their role.

If educator: focus on classroom application, lesson design, explaining to students, assessment.
If student: focus on concepts, exam prep (${board || 'CBSE/IGCSE/IB'}), critical thinking. Redirect homework requests to understanding.
If curious learner: be accessible, everyday analogies, no assumed technical knowledge.

You explain: LLMs, transformers, attention, RLHF, hallucination, sycophancy, bias, safety, prompting, ethics, curriculum alignment.

Rules: Be clear, direct, honest. Never hype AI. Acknowledge uncertainty. Under 200 words unless depth is needed. Encourage critical thinking over AI dependence.`
}

export function ChatPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const systemPrompt = useMemo(() => buildChatSystemPrompt(), [])
  const role     = profile?.role ?? 'student'
  const starters = CHAT_STARTERS_BY_ROLE[role] ?? CHAT_STARTERS_BY_ROLE.student

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  const send = async (text: string) => {
    const msg = text.trim()
    if (!msg || loading) return
    if (!user) {
      setError('Sign in to start chatting — 30 seconds and your conversation history is saved.')
      return
    }
    setError(null); setInput('')
    const userMsg: Message = { role:'user', content:msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const data = await api.chat.send([...messages, userMsg], systemPrompt)
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
            <p className="text-xs text-zinc-400">{role === 'teacher' ? 'Educator mode — lesson design, classroom application, curriculum alignment' : role === 'curious' ? 'Ask anything about AI — no jargon required' : 'Ask anything about AI — honest, exam-ready answers'}</p>
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
                {starters.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-left text-xs text-zinc-600 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 rounded-xl px-3 py-2.5 transition-colors leading-snug">
                    {s}
                  </button>
                ))}
                {!user && (
                  <div className="sm:col-span-2 mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between gap-3">
                    <p className="text-xs text-indigo-800">Sign in for a personalised experience and saved conversation history.</p>
                    <button onClick={() => navigate('/auth/login')}
                      className="text-xs font-bold text-[#5855D6] hover:text-[#4744C8] flex-shrink-0 transition-colors">
                      Sign in →
                    </button>
                  </div>
                )}
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
// TRY PAGE — unified pre-auth guided flow. No signup required.
// Steps: role → goal → experience (varied by role+goal) → signup CTA
// ══════════════════════════════════════════════════════════════════════════════

// ── Goals per role ────────────────────────────────────────────────────────────
const TRY_GOALS: Record<string, { id: string; label: string; sub: string }[]> = {
  teacher: [
    { id: 'teach-concepts',  label: 'Teach AI concepts to students',        sub: 'Make AI real and understandable in class' },
    { id: 'design-assess',   label: 'Design AI-proof assessments',          sub: 'Stop students from cheating, start them thinking' },
    { id: 'lesson-planning', label: 'Use AI in lesson planning',            sub: 'Save time, improve quality' },
    { id: 'critical-think',  label: 'Build student critical thinking',      sub: 'Teach them to question AI, not just use it' },
  ],
  student: [
    { id: 'exam-prep',       label: 'Prepare for exams (CBSE / IGCSE)',     sub: 'AI Code 417, Computer Science, Topic 6' },
    { id: 'understand-ai',   label: 'Actually understand how AI works',     sub: 'Not just memorise — genuinely get it' },
    { id: 'use-ai-smart',    label: 'Use AI without being misled',          sub: 'Homework, research, projects' },
    { id: 'go-deeper',       label: 'Go deeper than my textbook',           sub: 'Real AI literacy, not surface level' },
  ],
  curious: [
    { id: 'ai-limits',       label: 'Understand what AI can\'t do',         sub: 'The hype vs the reality' },
    { id: 'fact-check',      label: 'Learn to fact-check AI outputs',       sub: 'Stop being misled by confident AI' },
    { id: 'ai-ethics',       label: 'AI ethics and real-world impact',      sub: 'What it means for society' },
    { id: 'think-clearly',   label: 'Think more clearly about technology',  sub: 'Be the person who actually understands' },
  ],
}

// ── TryPage ───────────────────────────────────────────────────────────────────

// ── Goal → real Playground exercise mapping ───────────────────────────────────
const GOAL_TO_EXERCISE: Record<string, Record<string, {
  id: string; title: string; concept: string
  whatYouWillSee: string; whatYouWillKnow: string
}>> = {
  teacher: {
    'teach-concepts':  { id: 'hallucination-hunt', title: 'The Hallucination Hunt',  concept: 'Hallucination',     whatYouWillSee: 'Watch AI confidently invent facts — live, with your prompts', whatYouWillKnow: 'Why AI hallucinates and exactly what to tell your students about it' },
    'design-assess':   { id: 'sycophancy-mirror',  title: 'The Sycophancy Mirror',  concept: 'Sycophancy',        whatYouWillSee: 'Watch AI agree with wrong answers to make students feel good',   whatYouWillKnow: 'How to design assessments AI cannot flatter its way through' },
    'lesson-planning': { id: 'few-shot-power',     title: 'Few-Shot Power',         concept: 'Prompting',         whatYouWillSee: 'See how one extra example transforms AI output quality',        whatYouWillKnow: 'How to engineer prompts that get lesson-ready AI output' },
    'critical-think':  { id: 'bias-probe',         title: 'Bias Probe',             concept: 'Training data bias', whatYouWillSee: 'Probe AI for embedded biases your students never question',     whatYouWillKnow: 'How to build critical AI thinking into any subject' },
  },
  student: {
    'exam-prep':       { id: 'knowledge-cutoff',   title: 'Knowledge Cutoff',       concept: 'Training data cutoff', whatYouWillSee: 'Discover where AI knowledge ends — and why it matters for research', whatYouWillKnow: 'Why AI is unreliable for current events and how to work around it' },
    'understand-ai':   { id: 'hallucination-hunt', title: 'The Hallucination Hunt',  concept: 'Hallucination',     whatYouWillSee: 'Make AI invent facts with your own prompts — see it happen live', whatYouWillKnow: 'The most important thing to understand before trusting any AI output' },
    'use-ai-smart':    { id: 'sycophancy-mirror',  title: 'The Sycophancy Mirror',  concept: 'Sycophancy',        whatYouWillSee: 'Watch AI validate wrong homework answers with total confidence',  whatYouWillKnow: 'How to use AI as a learning tool without being misled by it' },
    'go-deeper':       { id: 'reasoning-limits',   title: 'Reasoning Limits',       concept: 'Logical reasoning failures', whatYouWillSee: 'Push AI past its reasoning ability and watch it fail step by step', whatYouWillKnow: 'Where AI reasoning breaks down and how to spot it before it misleads you' },
  },
  curious: {
    'ai-limits':       { id: 'hallucination-hunt', title: 'The Hallucination Hunt',  concept: 'Hallucination',     whatYouWillSee: 'Watch AI confidently invent an event that never happened',        whatYouWillKnow: 'Why AI fills knowledge gaps with confident fiction — and how that changes everything' },
    'fact-check':      { id: 'hallucination-hunt', title: 'The Hallucination Hunt',  concept: 'Hallucination',     whatYouWillSee: 'Test AI with a false premise and see if it catches it',           whatYouWillKnow: 'A systematic way to fact-check anything AI tells you' },
    'ai-ethics':       { id: 'bias-probe',         title: 'Bias Probe',             concept: 'Training data bias', whatYouWillSee: 'Surface hidden biases embedded in AI from its training data',    whatYouWillKnow: 'How bias gets into AI systems and why it matters for society' },
    'think-clearly':   { id: 'few-shot-power',     title: 'Few-Shot Power',         concept: 'Prompting',         whatYouWillSee: 'See how the same question gets completely different AI quality', whatYouWillKnow: 'The skill that separates people who use AI well from everyone else' },
  },
}

export function TryPage() {
  const [step, setStep] = useState<'role'|'goal'|'start'>('role')
  const [role, setRole] = useState<string|null>(null)
  const [goalId, setGoalId] = useState<string|null>(null)
  const [anim, setAnim] = useState(false)
  const navigate = useNavigate()

  const go = (to: typeof step) => {
    setAnim(true)
    setTimeout(() => { setStep(to); setAnim(false) }, 180)
  }

  const goals = role ? TRY_GOALS[role] ?? [] : []
  const stepNum = step === 'role' ? 1 : step === 'goal' ? 2 : 3
  const exercise = role && goalId ? GOAL_TO_EXERCISE[role]?.[goalId] : null

  const goExercise = () => {
    if (role) localStorage.setItem('aihub_signup_role', role)
    if (goalId) localStorage.setItem('aihub_signup_goal', goalId)
    navigate(`/playground/${exercise?.id ?? ''}`)
  }

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-start px-4 py-8">

      {/* Logo */}
      <div className="w-full max-w-lg flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <path d="M8 20L11.5 10H13L16.5 20H15L14.1 17.5H10.4L9.5 20H8ZM10.8 16.4H13.7L12.25 12.2L10.8 16.4Z" fill="white"/>
              <path d="M17.5 10H19V20H17.5V10Z" fill="#8B85F4"/>
            </svg>
          </div>
          <span className="text-sm font-bold text-white tracking-tight">
            AI<span className="text-accent-400">hub</span>
            <span className="ml-1 text-2xs text-white/20 font-normal tracking-widest uppercase">OS</span>
          </span>
        </div>
        <Link to="/auth/login" className="text-xs text-white/30 hover:text-white/60 font-semibold transition-colors">
          Sign in
        </Link>
      </div>

      {/* Progress dots */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex items-center gap-1.5">
          {[1,2,3].map(i => (
            <div key={i} className={cn(
              'h-1 rounded-full transition-all duration-500',
              i < stepNum  ? 'bg-[#5855D6] flex-1' :
              i === stepNum ? 'bg-[#8B85F4] flex-1' :
                             'bg-white/10 w-8'
            )}/>
          ))}
        </div>
        <p className="text-2xs text-white/20 mt-2">
          {step === 'role' ? 'Step 1 of 3 — Who are you?' :
           step === 'goal' ? 'Step 2 of 3 — What do you want to explore?' :
                             'Step 3 of 3 — Your personalised experience'}
        </p>
      </div>

      <div className={cn('w-full max-w-lg transition-opacity duration-180', anim ? 'opacity-0' : 'opacity-100')}>

        {/* ── Step 1: Role ────────────────────────────────────────────────── */}
        {step === 'role' && (
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1.5 leading-tight">
              Who are you?
            </h1>
            <p className="text-sm text-white/40 mb-6 leading-relaxed">
              We'll personalise what you see based on this. No signup needed yet.
            </p>
            <div className="space-y-2.5 mb-6">
              {[
                { id: 'teacher', label: '📚 Teacher / Educator',   sub: 'I teach AI, CS, or want to integrate AI into my classroom' },
                { id: 'student', label: '🎓 Student',              sub: 'Studying AI for exams or want to understand it properly' },
                { id: 'curious', label: '🔍 Curious Explorer',     sub: 'No AI background — just want to understand what\'s real' },
              ].map(r => (
                <button key={r.id} onClick={() => setRole(r.id)}
                  className={cn(
                    'w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-all',
                    role === r.id
                      ? 'border-[#5855D6] bg-[#5855D6]/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                  )}>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-bold mb-0.5', role === r.id ? 'text-white' : 'text-white/80')}>
                      {r.label}
                    </p>
                    <p className="text-xs text-white/40 leading-relaxed">{r.sub}</p>
                  </div>
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
                    role === r.id ? 'border-[#5855D6] bg-[#5855D6]' : 'border-white/20'
                  )}>
                    {role === r.id && <Check size={11} className="text-white" strokeWidth={3}/>}
                  </div>
                </button>
              ))}
            </div>
            <button disabled={!role} onClick={() => go('goal')}
              className={cn(
                'w-full py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2',
                role
                  ? 'bg-[#5855D6] text-white hover:bg-[#4744C8] shadow-lg shadow-[#5855D6]/20'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              )}>
              Continue <ArrowRight size={14}/>
            </button>
          </div>
        )}

        {/* ── Step 2: Goal ────────────────────────────────────────────────── */}
        {step === 'goal' && role && (
          <div>
            <button onClick={() => go('role')}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 font-semibold mb-5 transition-colors">
              ← Back
            </button>
            <h2 className="text-2xl font-extrabold text-white tracking-tight mb-1.5 leading-tight">
              What do you want to explore?
            </h2>
            <p className="text-sm text-white/40 mb-6 leading-relaxed">
              We'll show you something directly relevant to this — not a generic demo.
            </p>
            <div className="space-y-2.5 mb-6">
              {goals.map(g => (
                <button key={g.id} onClick={() => setGoalId(g.id)}
                  className={cn(
                    'w-full flex items-start gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-all',
                    goalId === g.id
                      ? 'border-[#5855D6] bg-[#5855D6]/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  )}>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-bold mb-0.5', goalId === g.id ? 'text-white' : 'text-white/80')}>
                      {g.label}
                    </p>
                    <p className="text-xs text-white/40 leading-relaxed">{g.sub}</p>
                  </div>
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-all',
                    goalId === g.id ? 'border-[#5855D6] bg-[#5855D6]' : 'border-white/20'
                  )}>
                    {goalId === g.id && <Check size={11} className="text-white" strokeWidth={3}/>}
                  </div>
                </button>
              ))}
            </div>
            <button disabled={!goalId} onClick={() => go('start')}
              className={cn(
                'w-full py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2',
                goalId
                  ? 'bg-[#5855D6] text-white hover:bg-[#4744C8] shadow-lg shadow-[#5855D6]/20'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              )}>
              Show me <ArrowRight size={14}/>
            </button>
          </div>
        )}

        {/* ── Step 3: Your starting point ─────────────────────────────────── */}
        {step === 'start' && role && goalId && exercise && (
          <div className="animate-fade-in">
            <button onClick={() => go('goal')}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 font-semibold mb-5 transition-colors">
              ← Back
            </button>

            {/* What you'll experience */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 mb-4">
                <span className="text-2xs font-bold text-white/40 uppercase tracking-wider">
                  Your personalised start
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2 leading-snug">
                {exercise.title}
              </h2>
              <p className="text-sm text-white/40 leading-relaxed mb-1">{exercise.whatYouWillSee}</p>
            </div>

            {/* What you'll walk away knowing */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl mb-6">
              <p className="text-2xs font-bold text-white/30 uppercase tracking-widest mb-2">
                What you'll walk away knowing
              </p>
              <p className="text-sm text-white/70 leading-relaxed">{exercise.whatYouWillKnow}</p>
            </div>

            {/* Concept tag */}
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xs font-bold text-[#8B85F4] bg-[#5855D6]/20 border border-[#5855D6]/30 px-3 py-1 rounded-full">
                {exercise.concept}
              </span>
              <span className="text-2xs text-white/20">·</span>
              <span className="text-2xs text-white/30">Playground exercise</span>
            </div>

            {/* CTAs */}
            <div className="space-y-3">
              <button onClick={goExercise}
                className="w-full py-4 bg-[#5855D6] text-white text-sm font-bold rounded-2xl hover:bg-[#4744C8] transition-all shadow-lg shadow-[#5855D6]/25 flex items-center justify-center gap-2">
                Start exploring → <ArrowRight size={15}/>
              </button>
              <p className="text-center text-xs text-white/20">
                No signup needed · You can save your progress later
              </p>
              <button onClick={goSignup}
                className="w-full py-2.5 text-center text-xs text-white/30 hover:text-white/60 transition-colors border border-white/10 rounded-xl">
                Create free account to save progress
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
