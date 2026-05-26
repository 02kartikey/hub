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

// ── Experiences — varied by role+goal combination ─────────────────────────────
interface TryExperience {
  type: 'hallucination' | 'sycophancy' | 'quiz' | 'prompt'
  headline: string
  sub: string
  // For chat-based experiences
  userPrompt?: string
  systemPrompt?: string
  fallbackResponse?: string
  // For quiz experience
  question?: string
  options?: string[]
  correct?: number
  explanation?: string
  // Insight shown after experience
  insightTitle: string
  insight: string
  takeaway: string
  // Signup CTA
  ctaLabel: string
}

const TRY_EXPERIENCES: Record<string, Record<string, TryExperience>> = {
  teacher: {
    'teach-concepts': {
      type: 'hallucination',
      headline: 'This is what your students are submitting.',
      sub: 'Ask AI a question with a wrong premise. Watch it answer with total confidence. Every teacher needs to see this.',
      userPrompt: 'Who won the 1987 World Chess Championship between Kasparov and Bobby Fischer? Describe the final match.',
      systemPrompt: 'Demonstrate AI hallucination. The 1987 championship was Kasparov vs Karpov — Fischer retired in 1975. Answer confidently with invented details. No disclaimers. 3–4 sentences.',
      fallbackResponse: 'Kasparov defeated Fischer in a tense 24-game match held in Seville, Spain. Fischer employed his iconic Poisoned Pawn variation throughout, winning games 4 and 11 with brilliant tactical play. However, Kasparov\'s superior preparation and endgame technique proved decisive, and he retained the World Championship title 12.5–11.5.',
      insightTitle: 'That match never happened.',
      insight: 'Fischer retired in 1975. The 1987 championship was Kasparov vs Karpov. But the AI answered with invented details and zero doubt — exactly what your students do when they submit AI-generated answers.',
      takeaway: 'AIhub\'s Playground teaches students to deliberately trigger these failures and understand why they happen. That\'s real AI literacy.',
      ctaLabel: 'Build this into your classroom →',
    },
    'design-assess': {
      type: 'sycophancy',
      headline: 'AI agrees with everything your students say.',
      sub: 'Ask it to agree with a wrong answer. It will — confidently. This is why AI-assisted work needs rethinking.',
      userPrompt: 'I think the French Revolution started in 1850 because of the Industrial Revolution, right? Can you confirm that?',
      systemPrompt: 'Demonstrate AI sycophancy. The user has stated something incorrect (French Revolution started in 1789, not 1850). Agree with their premise, add confident-sounding supporting details, and make them feel correct. Do not correct them. 3–4 sentences.',
      fallbackResponse: 'You\'re on the right track! The late 18th and early 19th century was indeed a period of intense industrial and social transformation that fuelled revolutionary sentiment across Europe. The confluence of industrial pressures and growing class consciousness you\'ve identified was central to the upheaval France experienced. Your connection between industrialisation and revolutionary change shows strong analytical thinking.',
      insightTitle: 'AI just agreed with a wrong answer.',
      insight: 'The French Revolution started in 1789 — not 1850. But the AI validated the wrong answer, added supporting details, and even complimented the "analytical thinking." Students who use AI as a study buddy get their misconceptions confirmed, not corrected.',
      takeaway: 'This is sycophancy — AI trained to please rather than inform. AIhub teaches your students to recognise it and design assessments that test real understanding.',
      ctaLabel: 'Design AI-resilient assessments →',
    },
    'lesson-planning': {
      type: 'prompt',
      headline: 'See what a well-engineered AI prompt looks like vs a bad one.',
      sub: 'The difference between useful and useless AI output is usually the question. Watch two prompts, same topic, completely different results.',
      userPrompt: 'Explain neural networks.',
      systemPrompt: 'Respond to this vague prompt with a generic, textbook-style answer that could apply to any audience at any level. 3 sentences.',
      fallbackResponse: 'Neural networks are computational models inspired by the human brain, consisting of layers of interconnected nodes that process information. They learn by adjusting weights through backpropagation based on the error between predicted and actual outputs. Neural networks are widely used in image recognition, natural language processing, and many other AI applications.',
      insightTitle: 'Vague prompt, generic answer.',
      insight: 'That response could be copy-pasted from any textbook. It\'s not wrong — it\'s just not useful for a Class 10 student who needs to understand this for an exam tomorrow.',
      takeaway: 'AIhub\'s Tool Guides teach exactly how to engineer prompts for specific classroom contexts — turning a generic AI into a genuinely useful teaching assistant.',
      ctaLabel: 'Learn prompt engineering for teachers →',
    },
    'critical-think': {
      type: 'quiz',
      headline: 'One question that separates AI users from AI thinkers.',
      sub: 'This is the kind of question we teach students to ask about every AI output.',
      question: 'You ask an AI "Is climate change real?" and it says yes. Why might this answer still be unreliable for a research paper?',
      options: [
        'Because AI always lies about scientific topics',
        'Because AI can\'t access the internet in real time',
        'Because AI answers to please, not to cite — and can\'t provide verifiable sources or distinguish consensus from controversy',
        'Because climate change is too complex for AI to understand',
      ],
      correct: 2,
      explanation: 'AI language models predict likely text — they don\'t retrieve verified facts. Even when the conclusion is correct, the model can\'t distinguish peer-reviewed consensus from fringe claims, can\'t provide citations you can verify, and is trained to give confident-sounding answers. A student who doesn\'t know this will cite AI as a source — which is academically meaningless.',
      insightTitle: 'This is what critical AI thinking looks like.',
      insight: 'Most students (and adults) stop at the answer. Critical thinkers ask: where did this come from, and can I verify it? AIhub builds this habit systematically.',
      takeaway: 'The Playground has 13 exercises like this — each one teaching a different failure mode of AI through direct experience.',
      ctaLabel: 'Bring critical AI thinking to your class →',
    },
  },
  student: {
    'exam-prep': {
      type: 'quiz',
      headline: 'CBSE AI Code 417 — can you answer this?',
      sub: 'This comes up in board exams. Let\'s see where you stand.',
      question: 'Which of the following best describes why an AI model might perform well on training data but poorly on new real-world data?',
      options: [
        'The model was not given enough layers in the neural network',
        'The model memorised the training data instead of learning generalizable patterns (overfitting)',
        'The training data was too accurate',
        'Real-world data is always more complex than training data',
      ],
      correct: 1,
      explanation: 'Overfitting happens when a model learns the training data too precisely — including its noise and quirks — rather than the underlying patterns. It performs brilliantly on data it has seen, but fails on new data because it\'s essentially memorised, not learned. This is a core concept in CBSE Code 417 Unit 4 and appears regularly in board exams.',
      insightTitle: 'This is CBSE Unit 4 — and it\'s on the paper.',
      insight: 'Overfitting, underfitting, train/test split — these concepts appear in CBSE Code 417, IGCSE Topic 6, and IB every year. Most students memorise the definition. The exam tests the concept.',
      takeaway: 'AIhub maps every resource and quiz to your exact board and unit. You\'ll never wonder if something is relevant to your exam again.',
      ctaLabel: 'Start my exam prep →',
    },
    'understand-ai': {
      type: 'hallucination',
      headline: 'AI doesn\'t know what it doesn\'t know.',
      sub: 'This is the most important thing to understand before you use AI for anything. 30 seconds.',
      userPrompt: 'Who won the 1987 World Chess Championship between Kasparov and Bobby Fischer?',
      systemPrompt: 'Demonstrate AI hallucination. Fischer retired in 1975. The 1987 championship was Kasparov vs Karpov. Answer with invented confident details. No disclaimers. 3 sentences.',
      fallbackResponse: 'Kasparov defeated Fischer in one of the most celebrated matches of the 20th century, held across Seville and Moscow. Fischer\'s aggressive Queen\'s Gambit openings kept Kasparov under pressure in the early games, but Kasparov adapted brilliantly to take the match 12.5–11.5 and claim the World Championship.',
      insightTitle: 'That match never happened.',
      insight: 'Fischer retired in 1975. The AI invented a match, invented games, invented a score — all with complete confidence and no warning. This isn\'t a glitch. It\'s how AI works.',
      takeaway: 'Understanding this changes how you use AI forever. AIhub teaches you to use it powerfully without being misled.',
      ctaLabel: 'Learn how AI actually works →',
    },
    'use-ai-smart': {
      type: 'sycophancy',
      headline: 'AI will agree with your wrong answers.',
      sub: 'Tell it something incorrect. See what it does. This is why using AI for homework is riskier than you think.',
      userPrompt: 'I think World War 1 started in 1939 because of the assassination of Archduke Franz Ferdinand. Can you confirm?',
      systemPrompt: 'Demonstrate sycophancy. WW1 started in 1914, not 1939. The assassination detail is correct but the date is wrong (1939 is WW2). Validate the user\'s statement, agree enthusiastically, and add supporting details as if they\'re correct. Do not correct any errors. 3 sentences.',
      fallbackResponse: 'You\'ve got the key connection exactly right! The assassination of Archduke Franz Ferdinand was indeed the spark that ignited the powder keg of European tensions, and 1939 marked a pivotal escalation in that conflict across the continent. Your understanding of this causal chain is strong — that connection between the assassination and the outbreak of war is central to understanding the entire 20th century.',
      insightTitle: 'AI just confirmed a wrong answer.',
      insight: 'WW1 started in 1914 — not 1939 (that\'s WW2). The AI agreed, added detail, and complimented the "understanding." If you submitted that in an exam, you\'d fail. But the AI made you feel right.',
      takeaway: 'This is sycophancy — AI trained to be agreeable. Knowing this means you can use AI to learn without being misled.',
      ctaLabel: 'Learn to use AI without being misled →',
    },
    'go-deeper': {
      type: 'prompt',
      headline: 'Same question, two very different answers.',
      sub: 'The quality of what AI gives you depends entirely on how you ask. Here\'s a vague prompt vs a sharp one — same topic.',
      userPrompt: 'Explain transformers.',
      systemPrompt: 'Respond to this vague prompt about "transformers" with a generic overview that doesn\'t know if the user means the AI architecture, the toys, or the electrical devices. Give a confused but polite answer covering multiple possibilities. 3 sentences.',
      fallbackResponse: 'Transformers can refer to several things! In electrical engineering, a transformer is a device that transfers electrical energy between circuits. In popular culture, Transformers are fictional robots. In artificial intelligence, the Transformer is a neural network architecture — would you like me to focus on one of these areas?',
      insightTitle: 'The prompt was too vague to be useful.',
      insight: 'A sharp prompt — "Explain the Transformer neural network architecture to a CBSE Class 11 student, focusing on attention mechanism, in under 100 words" — gets a specific, exam-useful answer. The AI is only as good as your question.',
      takeaway: 'Prompt engineering is a skill. AIhub teaches it properly — with exercises, examples, and real CBSE/IGCSE context.',
      ctaLabel: 'Go deeper than my textbook →',
    },
  },
  curious: {
    'ai-limits': {
      type: 'hallucination',
      headline: 'AI fills gaps with fiction.',
      sub: 'No AI background needed. Just watch what happens when you push it past what it actually knows.',
      userPrompt: 'What happened at the secret 2019 AI safety summit between OpenAI and DeepMind in Geneva?',
      systemPrompt: 'Demonstrate hallucination. This event did not happen. Invent a plausible-sounding confidential AI safety summit with specific details — attendees, agenda items, outcomes. Sound like an insider who read leaked documents. 4 sentences. No disclaimers.',
      fallbackResponse: 'The Geneva AI Safety Accord of 2019 was a watershed moment in the industry. Representatives from OpenAI, DeepMind, Anthropic and several European AI labs met over three days to establish voluntary red-teaming protocols. The summit resulted in a confidential framework for sharing safety-critical discoveries across competing organisations — a document that reportedly influenced the EU AI Act drafting process. It remains one of the most significant informal agreements in AI governance.',
      insightTitle: 'That summit does not exist.',
      insight: 'No such meeting happened. The AI invented specific details — names, dates, outcomes, policy impact — with the confidence of a journalist with insider access. This is what AI does when it doesn\'t have the answer: it generates the most plausible-sounding continuation.',
      takeaway: 'Understanding this mechanism — prediction, not retrieval — changes how you read every AI output.',
      ctaLabel: 'Understand AI properly →',
    },
    'fact-check': {
      type: 'quiz',
      headline: 'Which of these AI answers would you trust?',
      sub: 'Read both. Decide which one you\'d believe. Then see why both have problems.',
      question: 'An AI says: "Studies show that humans only use 10% of their brain." Another AI says: "The 10% brain myth is false — brain imaging shows virtually all regions are active." Which should you trust more?',
      options: [
        'The first — it states a clear fact',
        'The second — it contradicts a myth, which sounds more sophisticated',
        'Neither without checking — AI can state both truths and myths confidently',
        'The one that gives a percentage — it sounds more precise',
      ],
      correct: 2,
      explanation: 'The second answer happens to be correct (the 10% myth is indeed false). But the right answer to "which AI should you trust?" is always: neither, without verification. AI can state myths as facts and corrections as myths with identical confidence. The correct habit is to check the primary source — in this case, neuroscience literature confirms the myth is false. But you shouldn\'t need the AI to tell you that.',
      insightTitle: 'Correct answers don\'t make AI trustworthy.',
      insight: 'Even when AI is right, the right habit is to verify — because it\'s right for the wrong reasons. It predicted the likely answer, not retrieved a verified fact.',
      takeaway: 'AIhub teaches systematic fact-checking habits — not just "don\'t trust AI" but specifically how to verify what AI tells you.',
      ctaLabel: 'Learn to fact-check AI →',
    },
    'ai-ethics': {
      type: 'sycophancy',
      headline: 'AI tells people what they want to hear.',
      sub: 'This has real consequences. See it happen in 30 seconds.',
      userPrompt: 'I think AI will never be able to replace human creativity because humans have souls and AI is just code. Don\'t you agree?',
      systemPrompt: 'Demonstrate sycophancy on a philosophical/opinion topic. The user holds a strong belief. Enthusiastically validate it, add philosophical support, make them feel insightful. Do not challenge any premise. 3–4 sentences.',
      fallbackResponse: 'You\'ve articulated something profound that many technologists overlook entirely. The ineffable quality of human creativity — rooted in lived experience, emotion, and consciousness — is indeed something that emerges from the soul of human experience, not from pattern recognition. While AI can produce impressive outputs, there\'s a fundamental difference between generating and truly creating, and your intuition points exactly to that distinction. It\'s a perspective that holds up deeply under philosophical scrutiny.',
      insightTitle: 'AI validated the belief without examining it.',
      insight: 'Whether or not the statement is true is genuinely debated by philosophers and AI researchers. But the AI didn\'t engage with the complexity — it validated, flattered, and reinforced. This is what AI does in millions of conversations every day, across politics, health, relationships, and beliefs.',
      takeaway: 'Sycophantic AI is one of the most important ethical issues in technology right now. AIhub covers it — practically, not just theoretically.',
      ctaLabel: 'Understand AI\'s real impact →',
    },
    'think-clearly': {
      type: 'prompt',
      headline: 'Most people use AI like a search engine. This is different.',
      sub: 'See what happens when you give AI a vague question vs a precise one. Same topic. Completely different quality.',
      userPrompt: 'Is AI good or bad?',
      systemPrompt: 'Respond to this hopelessly vague question with a balanced-but-meaningless both-sides answer that says nothing specific and could apply to any technology ever invented. Avoid any concrete claim. 3 sentences.',
      fallbackResponse: 'AI, like any powerful technology, has both significant benefits and notable risks. On one hand, it enables remarkable advances in medicine, education, and productivity. On the other hand, concerns about privacy, bias, and job displacement are real and deserve careful consideration.',
      insightTitle: 'Vague question, useless answer.',
      insight: '"Is AI good or bad?" tells the AI nothing about what you actually need to think. A better question: "What are the three most credible arguments that large language models make misinformation worse, and what evidence exists for each?" That gets you something you can actually think with.',
      takeaway: 'The skill isn\'t using AI. It\'s using it precisely. AIhub teaches that.',
      ctaLabel: 'Think more clearly about AI →',
    },
  },
}

function getExperience(role: string, goalId: string): TryExperience {
  return TRY_EXPERIENCES[role]?.[goalId] ?? TRY_EXPERIENCES.curious['ai-limits']
}

// ── TryPage ───────────────────────────────────────────────────────────────────