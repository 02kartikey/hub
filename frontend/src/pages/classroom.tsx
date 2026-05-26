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

  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
function TeacherClassroomDashboard() {
  const { user, profile } = useAuth()

  // State
  const [classroom,    setClassroom]    = useState<Classroom | null>(null)
  const [students,     setStudents]     = useState<StudentRow[]>([])
  const [assignments,  setAssignments]  = useState<Assignment[]>([])
  const [resources,    setResources]    = useState<Resource[]>([])
  const [loading,      setLoading]      = useState(true)
  const [copied,       setCopied]       = useState(false)
  const [sortBy,       setSortBy]       = useState<'rate' | 'name' | 'quiz' | 'streak'>('rate')
  const [filter,       setFilter]       = useState<'all' | 'at-risk' | 'excelling'>('all')
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [assignOpen,   setAssignOpen]   = useState(false)

  const firstName = profile?.full_name?.split(' ')[0] ?? null
  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayStr  = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2200)
  }

  const loadDashboard = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // Get or create classroom
      const { data: clsRows } = await supabase
        .from('classrooms').select('*').eq('teacher_id', user.id).limit(1)
      let cls: Classroom | null = clsRows?.[0] ?? null
      if (!cls) {
        const tryInsert = async (): Promise<Classroom | null> => {
          const { data, error } = await supabase
            .from('classrooms')
            .insert({ teacher_id: user.id, code: generateCode(), name: 'My Classroom' })
            .select().single()
          if (error?.code === '23505') return tryInsert()
          return data ?? null
        }
        cls = await tryInsert()
      }
      if (!cls) return
      setClassroom(cls)

      // Members
      const { data: memberRows } = await supabase
        .from('classroom_members').select('student_id, joined_at').eq('classroom_id', cls.id)
      if (!memberRows?.length) { setStudents([]); return }

      const ids = memberRows.map(m => m.student_id)

      // Parallel fetch: profiles + resource progress + quiz results
      const [{ data: profileRows }, { data: progressRows }, { data: quizRows }, { data: assignRows }] =
        await Promise.all([
          supabase.from('profiles').select('id, full_name, email').in('id', ids),
          supabase.from('resource_progress').select('user_id, completed').in('user_id', ids),
          supabase.from('quiz_results').select('user_id, score').in('user_id', ids),
          supabase.from('assignments').select('*').eq('classroom_id', cls.id).order('created_at', { ascending: false }),
        ])

      setAssignments(assignRows ?? [])

      setStudents(memberRows.map(m => {
        const p      = profileRows?.find(x => x.id === m.student_id)
        const prog   = progressRows?.filter(x => x.user_id === m.student_id) ?? []
        const done   = prog.filter(x => x.completed).length
        const quizzes = quizRows?.filter(x => x.user_id === m.student_id) ?? []
        const avgQuiz = quizzes.length
          ? Math.round(quizzes.reduce((s, q) => s + q.score, 0) / quizzes.length)
          : null

        // Streak: approximate from updated_at recency — real impl would use a streak table
        const streak = 0 // placeholder — real data needs a streak tracking table

        return {
          id: m.student_id,
          name: p?.full_name ?? 'Student',
          email: p?.email ?? '',
          joinedAt: m.joined_at,
          started: prog.length,
          completed: done,
          rate: prog.length > 0 ? Math.round((done / prog.length) * 100) : 0,
          streak,
          quizScore: avgQuiz,
          pathProgress: {},  // would need path_progress table for real per-path data
        }
      }))
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  // Load assignable resources once
  useEffect(() => {
    api.resources.list({ limit: 60 }).then(r => setResources(r.data)).catch(() => {})
  }, [])

  const handleAssign = async (item: AssignableItem, dueDate: string, note: string) => {
    try {
      const { assignment } = await api.classroom.createAssignment({
        content_type: item.type,
        content_id: item.id,
        title: item.title,
        note: note || undefined,
        due_date: dueDate || undefined,
      })
      setAssignments(prev => [assignment, ...prev])
    } catch (e) {
      console.error('Assign failed', e)
    }
  }

  const deleteAssignment = async (id: string) => {
    try {
      await api.classroom.deleteAssignment(id)
      setAssignments(prev => prev.filter(a => a.id !== id))
    } catch {}
  }

  // Derived
  const atRisk     = students.filter(s => s.rate < 20 || s.quizScore != null && s.quizScore < 50)
  const excelling  = students.filter(s => s.rate >= 80 && (s.quizScore == null || s.quizScore >= 75))
  const avgRate    = students.length ? Math.round(students.reduce((s, r) => s + r.rate, 0) / students.length) : 0
  const avgQuiz    = students.filter(s => s.quizScore != null).length
    ? Math.round(students.filter(s => s.quizScore != null).reduce((s, r) => s + (r.quizScore ?? 0), 0) / students.filter(s => s.quizScore != null).length)
    : null
  const totalDone  = students.reduce((s, r) => s + r.completed, 0)

  const filteredStudents = (
    filter === 'at-risk'   ? atRisk :
    filter === 'excelling' ? excelling : students
  ).slice().sort((a, b) =>
    sortBy === 'rate'   ? b.rate - a.rate :
    sortBy === 'name'   ? a.name.localeCompare(b.name) :
    sortBy === 'quiz'   ? (b.quizScore ?? -1) - (a.quizScore ?? -1) :
                          b.streak - a.streak
  )

  const selectedStudentData = students.find(s => s.id === selectedStudent) ?? null

  if (selectedStudentData) return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      <StudentProfile
        student={selectedStudentData}
        assignments={assignments}
        onBack={() => setSelectedStudent(null)}
      />
    </div>
  )

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto space-y-5 animate-fade-in">

      {/* Assign modal */}
      {assignOpen && (
        <AssignModal
          resources={resources}
          onClose={() => setAssignOpen(false)}
          onAssign={handleAssign}
        />
      )}

      {/* ── Greeting banner ──────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden px-6 py-7"
        style={{ background: 'linear-gradient(135deg, #0A0A0B 0%, #1A1840 55%, #2D2880 100%)' }}>
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 0)', backgroundSize: '22px 22px' }}/>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-2xs font-semibold text-white/30 uppercase tracking-[0.14em] mb-1.5">{todayStr}</p>
            <h1 className="text-xl font-bold text-white tracking-tight mb-1.5">
              {greeting}{firstName ? `, ${firstName}` : ''} 🎓
            </h1>
            <p className="text-xs text-white/40 mb-4 max-w-md leading-relaxed">
              {students.length > 0
                ? `${students.length} student${students.length !== 1 ? 's' : ''} in your classroom${atRisk.length > 0 ? ` · ${atRisk.length} need attention` : ''}.`
                : 'Your classroom is ready. Share the code below to get started.'}
            </p>
            {classroom && (
              <div className="inline-flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/20"
                  style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <span className="text-2xs font-bold text-white/40 uppercase tracking-widest">Class code</span>
                  <span className="text-lg font-black text-white tracking-[0.22em]">{classroom.code}</span>
                </div>
                <button onClick={() => copyCode(classroom.code)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border',
                    copied ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                           : 'bg-white/10 text-white/60 hover:bg-white/20 border-white/10'
                  )}>
                  {copied ? <><Check size={11}/> Copied!</> : <><Copy size={11}/> Copy code</>}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { val: students.length,           label: 'Students'  },
              { val: `${avgRate}%`,             label: 'Avg done'  },
              { val: avgQuiz != null ? `${avgQuiz}%` : '—', label: 'Avg quiz' },
              { val: atRisk.length,             label: 'At risk',  danger: atRisk.length > 0 },
            ].map(s => (
              <div key={s.label} className="px-4 py-2.5 rounded-xl border border-white/10 text-center min-w-[62px]"
                style={{ background: s.danger && atRisk.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)' }}>
                <p className={cn('text-xl font-bold leading-none mb-0.5', s.danger && atRisk.length > 0 ? 'text-red-300' : 'text-white')}>{s.val}</p>
                <p className="text-2xs text-white/30 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── At-risk alert ─────────────────────────────────────────────────────── */}
      {atRisk.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
          <AlertTriangle size={14} className="text-orange-500 flex-shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="text-xs text-orange-800 leading-relaxed">
              <strong>{atRisk.slice(0, 3).map(s => s.name.split(' ')[0]).join(', ')}{atRisk.length > 3 ? ` +${atRisk.length - 3} more` : ''}</strong> are below 20% completion or scoring under 50% on quizzes.
            </p>
          </div>
          <button onClick={() => setFilter('at-risk')}
            className="text-2xs font-bold text-orange-700 hover:text-orange-900 transition-colors flex-shrink-0">
            View →
          </button>
        </div>
      )}

      {/* ── Actions row ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setAssignOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#5855D6] text-white text-xs font-bold rounded-xl hover:bg-[#4744C8] transition-colors shadow-sm">
          <Plus size={13}/> Assign to class
        </button>
        <div className="flex gap-1.5">
          {(['all', 'at-risk', 'excelling'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors',
                filter === f ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300'
              )}>
              {f === 'all' ? `All (${students.length})` : f === 'at-risk' ? `⚠️ At risk (${atRisk.length})` : `✨ Excelling (${excelling.length})`}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="text-xs text-zinc-600 bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#5855D6]">
            <option value="rate">Sort: Completion</option>
            <option value="quiz">Sort: Quiz score</option>
            <option value="streak">Sort: Streak</option>
            <option value="name">Sort: Name</option>
          </select>
          <button onClick={loadDashboard} title="Refresh"
            className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-600 transition-colors">
            <RotateCcw size={13}/>
          </button>
        </div>
      </div>

      {/* ── Active assignments ────────────────────────────────────────────────── */}
      {assignments.length > 0 && (
        <section>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Active assignments</p>
          <div className="space-y-2">
            {assignments.map(a => (
              <div key={a.id}
                className="flex items-center gap-3 px-4 py-3 bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 transition-colors">
                <span className={cn('text-2xs font-bold px-2 py-0.5 rounded flex-shrink-0 capitalize',
                  a.content_type === 'resource' ? 'bg-blue-50 text-blue-700' :
                  a.content_type === 'exercise' ? 'bg-amber-50 text-amber-700' :
                  a.content_type === 'path'     ? 'bg-violet-50 text-violet-700' :
                                                  'bg-emerald-50 text-emerald-700'
                )}>{a.content_type}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-800 truncate">{a.title}</p>
                  {a.note && <p className="text-2xs text-zinc-400 truncate mt-0.5">{a.note}</p>}
                </div>
                {a.due_date && (
                  <span className="text-2xs text-zinc-400 flex-shrink-0">
                    Due {new Date(a.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#5855D6] rounded-full transition-all"
                      style={{ width: students.length > 0 ? `${Math.round(((a.completedCount ?? 0) / students.length) * 100)}%` : '0%' }}/>
                  </div>
                  <span className="text-2xs font-bold text-zinc-500">{a.completedCount ?? 0}/{students.length}</span>
                </div>
                <button onClick={() => deleteAssignment(a.id)}
                  className="p-1 rounded hover:bg-red-50 text-zinc-300 hover:text-red-400 transition-colors flex-shrink-0">
                  <X size={12}/>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Student roster ────────────────────────────────────────────────────── */}
      <section>
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
          {filter === 'all' ? 'All students' : filter === 'at-risk' ? '⚠️ At-risk students' : '✨ Excelling students'} ({filteredStudents.length})
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16 bg-white border border-zinc-200 rounded-xl">
            <Spinner size={20} className="text-[#5855D6]"/>
          </div>
        ) : students.length === 0 ? (
          <div className="bg-gradient-to-br from-indigo-50 via-white to-zinc-50 border border-[#DDDDF8] rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center mx-auto mb-4">
              <Users size={22} className="text-zinc-400"/>
            </div>
            <p className="text-sm font-bold text-zinc-800 mb-1.5">No students yet</p>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto mb-5 leading-relaxed">
              Share your class code with students — they enter it from their dashboard to join.
            </p>
            {classroom && (
              <div className="inline-flex items-center gap-3 px-5 py-3 bg-white rounded-xl border border-zinc-200">
                <span className="text-2xs font-bold text-zinc-400 uppercase tracking-widest">Code</span>
                <span className="text-xl font-black text-zinc-900 tracking-[0.18em]">{classroom.code}</span>
                <button onClick={() => copyCode(classroom.code)}
                  className="text-2xs font-bold text-[#5855D6] hover:text-[#4744C8] transition-colors ml-1">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
            <p className="text-sm text-zinc-500">No students in this filter.</p>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_60px_64px_70px_140px_80px] gap-3 px-5 py-2.5 bg-zinc-50 border-b border-zinc-200">
              {['Student', 'Done', 'Streak', 'Quiz', 'Progress', ''].map(h => (
                <span key={h} className="text-2xs font-bold uppercase tracking-widest text-zinc-400">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-zinc-50">
              {filteredStudents.map(s => {
                const initials = s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                const isAtRisk = s.rate < 20 || (s.quizScore != null && s.quizScore < 50)
                return (
                  <div key={s.id}
                    className="grid grid-cols-[1fr_60px_64px_70px_140px_80px] gap-3 px-5 py-3.5 items-center hover:bg-zinc-50/70 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isAtRisk && <AlertTriangle size={10} className="text-orange-400 flex-shrink-0"/>}
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-2xs font-bold', avatarColor(s.name))}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-800 truncate">{s.name}</p>
                        <p className="text-2xs text-zinc-400 truncate">
                          Joined {new Date(s.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    <p className={cn('text-xs font-bold', s.completed > 0 ? 'text-emerald-600' : 'text-zinc-400')}>
                      {s.completed}
                    </p>
                    <p className={cn('text-xs font-bold', s.streak === 0 ? 'text-red-400' : s.streak >= 7 ? 'text-emerald-600' : 'text-zinc-700')}>
                      {s.streak > 0 ? `🔥 ${s.streak}` : '—'}
                    </p>
                    <p className={cn('text-xs font-bold',
                      s.quizScore == null ? 'text-zinc-300' :
                      s.quizScore >= 75 ? 'text-emerald-600' :
                      s.quizScore < 50  ? 'text-red-500' : 'text-amber-600'
                    )}>
                      {s.quizScore != null ? `${s.quizScore}%` : '—'}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all duration-700',
                          s.rate === 100 ? 'bg-emerald-500' :
                          s.rate >= 60   ? 'bg-[#5855D6]'   : 'bg-amber-400'
                        )} style={{ width: `${s.rate}%` }}/>
                      </div>
                      <span className="text-2xs font-bold text-zinc-500 w-8 text-right">{s.rate}%</span>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={() => setSelectedStudent(s.id)}
                        className="px-3 py-1 text-2xs font-bold text-[#5855D6] bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors">
                        Profile →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}


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
