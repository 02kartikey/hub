import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Sparkles, Users, BookOpen, Award, Zap, ChevronRight, Brain } from 'lucide-react'
import { cn } from '../ui'
import { useAuth } from '../auth'
// ── Goals per role ─────────────────────────────────────────────────────────────
const TRY_GOALS: Record<string, { id: string; label: string; sub: string; emoji: string }[]> = {
  teacher: [
    { id: 'teach-concepts',  emoji: '🧠', label: 'Teach AI concepts clearly',        sub: 'Make hallucination, bias and LLMs real for students' },
    { id: 'design-assess',   emoji: '📝', label: 'Design AI-proof assessments',      sub: 'Stop AI cheating, start genuine thinking' },
    { id: 'lesson-planning', emoji: '⚡', label: 'Use AI in lesson planning',        sub: 'Save time while improving quality' },
    { id: 'critical-think',  emoji: '🔍', label: 'Build student critical thinking',  sub: 'Teach them to question AI, not just use it' },
  ],
  student: [
    { id: 'exam-prep',       emoji: '🎯', label: 'Prepare for exams',               sub: 'CBSE AI 417, IGCSE Topic 6, IB' },
    { id: 'understand-ai',   emoji: '💡', label: 'Actually understand how AI works', sub: 'Not memorise — genuinely get it' },
    { id: 'use-ai-smart',    emoji: '🛡️', label: 'Use AI without being misled',      sub: 'Homework, research, projects' },
    { id: 'go-deeper',       emoji: '🚀', label: 'Go deeper than my textbook',       sub: 'Real AI literacy, not surface level' },
  ],
  curious: [
    { id: 'ai-limits',       emoji: '🤔', label: 'Understand what AI can\'t do',    sub: 'Hype vs reality, clearly explained' },
    { id: 'fact-check',      emoji: '🔬', label: 'Learn to fact-check AI outputs',  sub: 'Stop being misled by confident AI' },
    { id: 'ai-ethics',       emoji: '⚖️', label: 'AI ethics and real-world impact', sub: 'What it means for society' },
    { id: 'think-clearly',   emoji: '🧭', label: 'Think more clearly about tech',   sub: 'Be the person who actually understands' },
  ],
}

const GOAL_TO_EXERCISE: Record<string, Record<string, {
  id: string; title: string; concept: string; whatYouWillSee: string; whatYouWillKnow: string
}>> = {
  teacher: {
    'teach-concepts':  { id: 'hallucination-hunt', title: 'The Hallucination Hunt',  concept: 'Hallucination',          whatYouWillSee: 'Watch AI confidently invent facts — live, with your own prompts',       whatYouWillKnow: 'Why AI hallucinates and exactly what to tell your students about it' },
    'design-assess':   { id: 'sycophancy-mirror',  title: 'The Sycophancy Mirror',   concept: 'Sycophancy',             whatYouWillSee: 'Watch AI agree with wrong answers to make students feel good',           whatYouWillKnow: 'How to design assessments AI cannot flatter its way through' },
    'lesson-planning': { id: 'few-shot-power',     title: 'Few-Shot Power',          concept: 'Prompting',              whatYouWillSee: 'See how one extra example transforms AI output quality',                 whatYouWillKnow: 'How to engineer prompts that get lesson-ready AI output' },
    'critical-think':  { id: 'bias-probe',         title: 'Bias Probe',              concept: 'Training data bias',     whatYouWillSee: 'Probe AI for embedded biases your students never question',              whatYouWillKnow: 'How to build critical AI thinking into any subject' },
  },
  student: {
    'exam-prep':       { id: 'knowledge-cutoff',   title: 'Knowledge Cutoff',        concept: 'Training data cutoff',   whatYouWillSee: 'Discover where AI knowledge ends — and why it matters for your answers', whatYouWillKnow: 'Why AI is unreliable for current events and how to work around it' },
    'understand-ai':   { id: 'hallucination-hunt', title: 'The Hallucination Hunt',  concept: 'Hallucination',          whatYouWillSee: 'Make AI invent facts with your own prompts — see it happen live',         whatYouWillKnow: 'The most important thing to understand before trusting any AI output' },
    'use-ai-smart':    { id: 'sycophancy-mirror',  title: 'The Sycophancy Mirror',   concept: 'Sycophancy',             whatYouWillSee: 'Watch AI validate wrong homework answers with total confidence',          whatYouWillKnow: 'How to use AI as a tool without being misled by it' },
    'go-deeper':       { id: 'reasoning-limits',   title: 'Reasoning Limits',        concept: 'Logical reasoning',      whatYouWillSee: 'Push AI past its reasoning ability and watch it fail step by step',       whatYouWillKnow: 'Where AI reasoning breaks and how to spot it before it misleads you' },
  },
  curious: {
    'ai-limits':       { id: 'hallucination-hunt', title: 'The Hallucination Hunt',  concept: 'Hallucination',          whatYouWillSee: 'Watch AI confidently invent an event that never happened',               whatYouWillKnow: 'Why AI fills knowledge gaps with confident fiction' },
    'fact-check':      { id: 'hallucination-hunt', title: 'The Hallucination Hunt',  concept: 'Hallucination',          whatYouWillSee: 'Test AI with a false premise and see if it catches it',                  whatYouWillKnow: 'A systematic way to fact-check anything AI tells you' },
    'ai-ethics':       { id: 'bias-probe',         title: 'Bias Probe',              concept: 'Training data bias',     whatYouWillSee: 'Surface hidden biases embedded in AI from its training data',             whatYouWillKnow: 'How bias gets into AI and why it matters for society' },
    'think-clearly':   { id: 'few-shot-power',     title: 'Few-Shot Power',          concept: 'Prompting',              whatYouWillSee: 'See how the same question gets completely different AI quality',           whatYouWillKnow: 'The skill that separates people who use AI well from everyone else' },
  },
}

const ROLES = [
  { id: 'teacher', emoji: '📚', label: 'Teacher / Educator',  sub: 'Integrate AI into class, design assessments, teach AI literacy' },
  { id: 'student', emoji: '🎓', label: 'Student',             sub: 'Exam prep, genuinely understand AI, use it without being misled' },
  { id: 'curious', emoji: '🔍', label: 'Curious Explorer',    sub: 'No background needed — understand what\'s real about AI' },
]

const STATS = [
  { val: '12,000+', label: 'learners' },
  { val: '400+',    label: 'schools' },
  { val: '28',      label: 'learning paths' },
]

export function TryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Restore from localStorage so navigating away doesn't reset progress
  const [step,   setStep]   = useState<'role'|'goal'|'start'>(() => {
    const s = localStorage.getItem('aihub_try_step') as 'role'|'goal'|'start'|null
    return s ?? 'role'
  })
  const [role,   setRole]   = useState<string|null>(() => localStorage.getItem('aihub_try_role'))
  const [goalId, setGoalId] = useState<string|null>(() => localStorage.getItem('aihub_try_goal'))
  const [anim,   setAnim]   = useState(false)

  // Redirect signed-in users to home
  useEffect(() => { if (user) navigate('/', { replace: true }) }, [user])

  // Persist step/role/goal so revisiting doesn't restart
  useEffect(() => { localStorage.setItem('aihub_try_step', step) }, [step])
  useEffect(() => { if (role)   localStorage.setItem('aihub_try_role',       role)   }, [role])
  useEffect(() => { if (goalId) localStorage.setItem('aihub_try_goal',       goalId) }, [goalId])

  const go = (to: typeof step) => {
    setAnim(true)
    setTimeout(() => { setStep(to); setAnim(false) }, 160)
  }

  const goals    = role ? TRY_GOALS[role] ?? [] : []
  const stepNum  = step === 'role' ? 1 : step === 'goal' ? 2 : 3
  const exercise = role && goalId ? GOAL_TO_EXERCISE[role]?.[goalId] : null

  const goExercise = () => {
    if (role)   localStorage.setItem('aihub_signup_role', role)
    if (goalId) localStorage.setItem('aihub_signup_goal', goalId)
    navigate(`/playground/${exercise?.id ?? ''}`)
  }

  const goSignup = () => {
    if (role)   localStorage.setItem('aihub_signup_role', role)
    if (goalId) localStorage.setItem('aihub_signup_goal', goalId)
    localStorage.setItem('aihub_try_done', '1')
    navigate('/auth/signup')
  }

  const pickRole = (r: string) => {
    setRole(r)
    if (r !== role) setGoalId(null)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #0A0A0B 0%, #12102A 50%, #0D0B1F 100%)' }}>

      {/* ── Top bar ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <path d="M8 20L11.5 10H13L16.5 20H15L14.1 17.5H10.4L9.5 20H8ZM10.8 16.4H13.7L12.25 12.2L10.8 16.4Z" fill="white"/>
              <path d="M17.5 10H19V20H17.5V10Z" fill="#8B85F4"/>
            </svg>
          </div>
          <span className="text-sm font-bold text-white tracking-tight">
            AI<span style={{ color: '#8B85F4' }}>hub</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/auth/login"
            className="text-xs font-semibold transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseOver={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
            onMouseOut={e  => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
            Sign in
          </Link>
          <Link to="/auth/signup"
            className="text-xs font-bold px-4 py-2 rounded-xl transition-all"
            style={{ background: 'rgba(139,133,244,0.15)', border: '1px solid rgba(139,133,244,0.25)', color: '#8B85F4' }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(139,133,244,0.25)')}
            onMouseOut={e  => (e.currentTarget.style.background = 'rgba(139,133,244,0.15)')}>
            Create account
          </Link>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full px-4 lg:px-6 pb-12 gap-10 lg:gap-16">

        {/* ── Left: persistent context panel ── */}
        <div className="lg:w-80 flex-shrink-0 pt-8 lg:pt-16">
          {/* Hero text */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-5"
              style={{ background: 'rgba(139,133,244,0.12)', border: '1px solid rgba(139,133,244,0.2)' }}>
              <Sparkles size={11} style={{ color: '#8B85F4' }}/>
              <span className="text-2xs font-bold tracking-widest uppercase" style={{ color: '#8B85F4' }}>
                Free · No signup needed
              </span>
            </div>
            <h1 className="font-extrabold text-white leading-tight mb-3" style={{ fontSize: 28, letterSpacing: '-0.02em' }}>
              Stop guessing<br/>
              about AI.<br/>
              <span style={{ color: '#8B85F4' }}>Start understanding it.</span>
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)', maxWidth: 280 }}>
              Curriculum-aligned AI literacy for students, teachers, and curious minds. No jargon. No hype.
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-5 mb-8">
            {STATS.map(s => (
              <div key={s.label}>
                <p className="text-base font-extrabold text-white leading-none mb-0.5">{s.val}</p>
                <p className="text-2xs font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Feature pills */}
          <div className="space-y-2 hidden lg:block">
            {[
              { icon: Brain,    text: '28 learning paths across CBSE, IGCSE & IB' },
              { icon: Zap,      text: 'Live AI experiments — try hallucination in seconds' },
              { icon: BookOpen, text: 'Quizzes tied to every learning path' },
              { icon: Award,    text: 'Badges and progress tracking' },
              { icon: Users,    text: 'Classroom tools for teachers' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(139,133,244,0.1)' }}>
                  <Icon size={12} style={{ color: '#8B85F4' }}/>
                </div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: step flow ── */}
        <div className="flex-1 pt-6 lg:pt-10">

          {/* Progress bar */}
          <div className="mb-7">
            <div className="flex items-center gap-1 mb-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-1 rounded-full transition-all duration-500 flex-1"
                  style={{
                    background: i < stepNum ? '#5855D6' : i === stepNum ? '#8B85F4' : 'rgba(255,255,255,0.08)'
                  }}/>
              ))}
            </div>
            <p className="text-2xs font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>
              {step === 'role'  ? 'Step 1 of 3 — Pick your role' :
               step === 'goal'  ? 'Step 2 of 3 — Choose your goal' :
                                  'Step 3 of 3 — Your personalised experience'}
            </p>
          </div>

          <div className={cn('transition-opacity duration-160', anim ? 'opacity-0' : 'opacity-100')}>

            {/* ── Step 1: Role ─────────────────────────────────────────────── */}
            {step === 'role' && (
              <div>
                <h2 className="text-xl font-extrabold text-white mb-1 tracking-tight">Who are you?</h2>
                <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  We'll tailor everything to your context. Takes 20 seconds.
                </p>
                <div className="space-y-2.5 mb-6">
                  {ROLES.map(r => (
                    <button key={r.id} onClick={() => pickRole(r.id)}
                      className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all"
                      style={{
                        border: role === r.id ? '2px solid #5855D6' : '2px solid rgba(255,255,255,0.07)',
                        background: role === r.id ? 'rgba(88,85,214,0.12)' : 'rgba(255,255,255,0.03)',
                      }}>
                      <span className="text-2xl flex-shrink-0">{r.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold mb-0.5" style={{ color: role === r.id ? 'white' : 'rgba(255,255,255,0.8)' }}>
                          {r.label}
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>{r.sub}</p>
                      </div>
                      <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
                        style={{
                          border: role === r.id ? '2px solid #5855D6' : '2px solid rgba(255,255,255,0.15)',
                          background: role === r.id ? '#5855D6' : 'transparent',
                        }}>
                        {role === r.id && <Check size={11} className="text-white" strokeWidth={3}/>}
                      </div>
                    </button>
                  ))}
                </div>
                <button disabled={!role} onClick={() => go('goal')}
                  className="w-full py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                  style={{
                    background: role ? '#5855D6' : 'rgba(255,255,255,0.05)',
                    color: role ? 'white' : 'rgba(255,255,255,0.2)',
                    cursor: role ? 'pointer' : 'not-allowed',
                    boxShadow: role ? '0 8px 24px rgba(88,85,214,0.3)' : 'none',
                  }}>
                  Continue <ArrowRight size={14}/>
                </button>
              </div>
            )}

            {/* ── Step 2: Goal ──────────────────────────────────────────────── */}
            {step === 'goal' && role && (
              <div>
                <button onClick={() => go('role')}
                  className="flex items-center gap-1 text-xs font-semibold mb-5 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                  onMouseOver={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                  onMouseOut={e  => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}>
                  ← Back
                </button>
                <h2 className="text-xl font-extrabold text-white mb-1 tracking-tight">What do you want to explore?</h2>
                <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  We'll show you something directly relevant — not a generic tour.
                </p>
                <div className="space-y-2.5 mb-6">
                  {goals.map(g => (
                    <button key={g.id} onClick={() => setGoalId(g.id)}
                      className="w-full flex items-start gap-4 px-5 py-4 rounded-2xl text-left transition-all"
                      style={{
                        border: goalId === g.id ? '2px solid #5855D6' : '2px solid rgba(255,255,255,0.07)',
                        background: goalId === g.id ? 'rgba(88,85,214,0.12)' : 'rgba(255,255,255,0.03)',
                      }}>
                      <span className="text-xl flex-shrink-0 mt-0.5">{g.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold mb-0.5" style={{ color: goalId === g.id ? 'white' : 'rgba(255,255,255,0.8)' }}>
                          {g.label}
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>{g.sub}</p>
                      </div>
                      <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 transition-all"
                        style={{
                          border: goalId === g.id ? '2px solid #5855D6' : '2px solid rgba(255,255,255,0.15)',
                          background: goalId === g.id ? '#5855D6' : 'transparent',
                        }}>
                        {goalId === g.id && <Check size={11} className="text-white" strokeWidth={3}/>}
                      </div>
                    </button>
                  ))}
                </div>
                <button disabled={!goalId} onClick={() => go('start')}
                  className="w-full py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                  style={{
                    background: goalId ? '#5855D6' : 'rgba(255,255,255,0.05)',
                    color: goalId ? 'white' : 'rgba(255,255,255,0.2)',
                    cursor: goalId ? 'pointer' : 'not-allowed',
                    boxShadow: goalId ? '0 8px 24px rgba(88,85,214,0.3)' : 'none',
                  }}>
                  Show me what I'll learn <ArrowRight size={14}/>
                </button>
              </div>
            )}

            {/* ── Step 3: Experience preview ───────────────────────────────── */}
            {step === 'start' && role && goalId && exercise && (
              <div>
                <button onClick={() => go('goal')}
                  className="flex items-center gap-1 text-xs font-semibold mb-5 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                  onMouseOver={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                  onMouseOut={e  => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}>
                  ← Back
                </button>

                {/* Preview card */}
                <div className="rounded-2xl p-5 mb-5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(139,133,244,0.15)', color: '#8B85F4', border: '1px solid rgba(139,133,244,0.25)' }}>
                      {exercise.concept}
                    </span>
                    <span className="text-2xs" style={{ color: 'rgba(255,255,255,0.2)' }}>· Playground exercise</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-white mb-1 tracking-tight">{exercise.title}</h2>
                  <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>{exercise.whatYouWillSee}</p>

                  <div className="rounded-xl p-4" style={{ background: 'rgba(88,85,214,0.08)', border: '1px solid rgba(88,85,214,0.15)' }}>
                    <p className="text-2xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(139,133,244,0.6)' }}>
                      You'll walk away knowing
                    </p>
                    <p className="text-sm text-white leading-relaxed">{exercise.whatYouWillKnow}</p>
                  </div>
                </div>

                {/* CTAs */}
                <div className="space-y-3">
                  <button onClick={goExercise}
                    className="w-full py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #5855D6 0%, #4744C8 100%)',
                      boxShadow: '0 8px 32px rgba(88,85,214,0.35)',
                    }}
                    onMouseOver={e => (e.currentTarget.style.boxShadow = '0 12px 40px rgba(88,85,214,0.5)')}
                    onMouseOut={e  => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(88,85,214,0.35)')}>
                    Start exploring <ArrowRight size={15}/>
                  </button>

                  <p className="text-center text-2xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
                    No account needed · 2 minutes · Save progress later
                  </p>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }}/>
                    <span className="text-2xs" style={{ color: 'rgba(255,255,255,0.15)' }}>or</span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }}/>
                  </div>

                  <button onClick={goSignup}
                    className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                    style={{
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.5)',
                      background: 'transparent',
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                    }}>
                    Create free account — save my progress
                    <ChevronRight size={13}/>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
