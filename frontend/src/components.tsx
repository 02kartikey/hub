/**
 * components.tsx — AIhub OS layout + reusable feature components
 * Brand: "The AI-Native Student Operating System"
 */
import React, { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Brain, Compass, Wrench, Video, BookOpen, Route, Bookmark, BarChart2,
  ShieldCheck, GraduationCap, FlaskConical, X, LayoutDashboard, Users,
  MessageSquare, GitBranch, Globe, ChevronDown, ChevronRight, LogOut,
  ExternalLink, Check, ArrowRight, Send, RotateCcw, Eye, EyeOff, Lightbulb,
  Copy, Sparkles, Star, Clock, AlertCircle, CheckCircle2, Search, Command,
  MessageCircle, Minimize2, ArrowUpRight, Layers, Target, Zap, BookMarked,
  Hash, Play, Menu, Award} from 'lucide-react'
import { cn, Button, Badge, ProgressBar, TypingDots, Kbd, Divider, EmptyState } from './ui'
import { useAuth, useProgress, useBookmarks, getOnboardingProfile,
         saveOnboardingProfile, resetOnboarding, supabase } from './auth'
import { useBadges, BadgeNotificationManager, checkAndAward, BADGES } from './badges'
import { buildSearchIndex, search as searchIndex, isIndexReady } from './search'
import type { SearchResult } from './search'
import { api } from './api'
import type {
  Resource, LearningPath, ExerciseStage, DeepExercise,
  Message, OnboardingProfile, OnboardRole, Perspective, RealWorldCase,
} from './types'

// ══════════════════════════════════════════════════════════════════════════════
// SIDEBAR — OS navigation
// ══════════════════════════════════════════════════════════════════════════════

// Base nav — shown to all users
const NAV_BASE = [
  { group: 'Workspace', items: [
    { label:'Dashboard',   href:'/',            icon:<LayoutDashboard size={15}/> },
    { label:'Browse',      href:'/browse',      icon:<Compass size={15}/> },
    { label:'Curriculum',  href:'/curriculum',  icon:<Globe size={15}/> },
  ]},
  { group: 'Practice', items: [
    { label:'Playground',  href:'/playground',  icon:<FlaskConical size={15}/> },
    { label:'Activities',  href:'/activities',  icon:<Users size={15}/> },
    { label:'Assessment',  href:'/assessment',  icon:<Target size={15}/> },
  ]},
  { group: 'Resources', items: [
    { label:'Seminars',    href:'/seminars',    icon:<Video size={15}/> },
    { label:'Workflows',   href:'/workflows',   icon:<GitBranch size={15}/> },
    { label:'Tool guides', href:'/tools',       icon:<Wrench size={15}/> },
  ]},
  { group: 'My OS', items: [
    { label:'Progress',    href:'/progress',    icon:<BarChart2 size={15}/> },
    { label:'AI Chat',     href:'/chat',        icon:<MessageSquare size={15}/> },
    { label:'Badges',      href:'/badges',      icon:<Award size={15}/> },
  ]},
]

// Teacher-only additions — appended when role === 'teacher'
const NAV_TEACHER_EXTRA = [
  { group: 'Classroom', items: [
    { label:'Teacher Hub',  href:'/teacher',   icon:<GraduationCap size={15}/> },
    { label:'My Classroom', href:'/classroom', icon:<Users size={15}/> },
  ]},
]


// ══════════════════════════════════════════════════════════════════════════════
// ERROR BOUNDARY — catches render crashes, prevents white screen of death
// ══════════════════════════════════════════════════════════════════════════════

interface EBState { hasError: boolean; error: Error | null }
export class ErrorBoundary extends React.Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production: send to error tracking (Sentry etc.)
    console.error('[ErrorBoundary]', error, info.componentStack)
  }
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-4">
          <AlertCircle size={24} className="text-red-500"/>
        </div>
        <h2 className="text-lg font-extrabold text-zinc-900 mb-2 tracking-tight">Something went wrong</h2>
        <p className="text-sm text-zinc-500 max-w-sm leading-relaxed mb-6">
          An unexpected error occurred. Your progress is safe — refresh to continue.
        </p>
        <div className="flex gap-3">
          <button onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2.5 bg-[#5855D6] text-white text-sm font-bold rounded-xl hover:bg-[#4744C8] transition-colors">
            Try again
          </button>
          <button onClick={() => window.location.reload()}
            className="px-4 py-2.5 bg-white text-zinc-700 text-sm font-bold rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors">
            Reload page
          </button>
        </div>
        {import.meta.env.DEV && this.state.error && (
          <pre className="mt-6 p-4 bg-ink-950 text-red-400 text-xs rounded-xl text-left overflow-x-auto max-w-lg">
            {this.state.error.message}
          </pre>
        )}
      </div>
    )
  }
}


// Shows unearned badge count on the Badges nav item — motivational signal
function BadgeNavCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const earned   = JSON.parse(localStorage.getItem('aihub_badges') ?? '[]') as string[]
    const total    = BADGES.length  // derived, not hardcoded
    setCount(Math.max(0, total - earned.length))
    const handler = (e: StorageEvent) => {
      if (e.key === 'aihub_badges') {
        const next = JSON.parse(e.newValue ?? '[]') as string[]
        setCount(Math.max(0, BADGES.length - next.length))
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])
  if (count === 0) return null
  return (
    <span className="flex-shrink-0 text-white font-bold rounded-full flex items-center justify-center"
      style={{ fontSize:10, minWidth:17, height:17, background:'#5855D6', padding:'0 4px' }}>
      {count}
    </span>
  )
}

// Tour trigger button — shown at bottom of sidebar
export function TourTrigger({ onStart }: { onStart: () => void }) {
  return (
    <button onClick={onStart}
      className="flex items-center gap-2 w-full px-2.5 py-2 rounded-[8px] transition-colors hover:bg-zinc-50 group"
      style={{ fontSize:13, color:'var(--text-3)' }}
      title="Take the product tour">
      <div className="w-[15px] h-[15px] flex items-center justify-center flex-shrink-0">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M5.5 5C5.5 4.448 5.948 4 6.5 4C7.052 4 7.5 4.448 7.5 5C7.5 5.552 7.052 6 6.5 6V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="6.5" cy="8.5" r="0.6" fill="currentColor"/>
        </svg>
      </div>
      <span className="group-hover:text-zinc-700 transition-colors">Product tour</span>
    </button>
  )
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation()
  const { profile }  = useAuth()
  const isTeacher    = profile?.role === 'teacher'
  const NAV          = isTeacher ? [...NAV_BASE, ...NAV_TEACHER_EXTRA] : NAV_BASE

  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[2px] lg:hidden" onClick={onClose}/>}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col bg-white',
        'transition-transform duration-200 ease-smooth lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
        'w-[224px] flex-shrink-0',
      )} style={{ borderRight:'1px solid var(--border)' }}>
        {/* Logo */}
        <div className="flex items-center justify-between h-[52px] px-5 flex-shrink-0" style={{ borderBottom:"1px solid var(--border)" }}>
          <Link to="/" className="flex items-center gap-2.5 group">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
              <rect width="28" height="28" rx="7" fill="#0A0A0B"/>
              <path d="M8 20L11.5 10H13L16.5 20H15L14.1 17.5H10.4L9.5 20H8ZM10.8 16.4H13.7L12.25 12.2L10.8 16.4Z" fill="white"/>
              <path d="M17.5 10H19V20H17.5V10Z" fill="#8B85F4"/>
            </svg>
            <div className="flex items-baseline gap-0">
              <span className="text-[14px] font-extrabold tracking-tight leading-none" style={{ color:"#0A0A0B" }}>AI</span>
              <span className="text-[14px] font-extrabold tracking-tight leading-none" style={{ color:"#5855D6" }}>hub</span>
              <span className="ml-1 text-[9px] font-bold text-zinc-300 tracking-[0.18em] uppercase leading-none self-center">OS</span>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden p-1 text-zinc-400 hover:text-zinc-700 rounded-md hover:bg-zinc-100">
            <X size={14}/>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5 no-scrollbar">
          {NAV.map(({ group, items }) => (
            <div key={group}>
              <p style={{ fontSize:10.5, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#C0C0CA", padding:"0 8px 6px" }}>{group}</p>
              <div className="space-y-0.5">
                {items.map(item => {
                  const active = pathname === item.href ||
                    (item.href !== '/' && !item.href.includes('?') && pathname.startsWith(item.href))
                  const tourId = item.href.replace('/', '').replace('/', '-') || 'home'
                  const isBadges = item.href === '/badges'
                  return (
                    <Link key={item.href} to={item.href} data-tour={tourId} className={cn(
                      'flex items-center gap-2.5 px-2.5 py-[7px] rounded-[8px] transition-all duration-100 w-full',
                      active
                        ? 'font-semibold bg-[#EEEEFF] text-[#5855D6]'
                        : 'font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50',
                    )} style={{ fontSize:13.5 }}>
                      <span className={cn('flex-shrink-0 w-[15px] h-[15px] flex items-center justify-center', active ? 'text-[#5855D6]' : 'text-zinc-400')}>{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {isBadges && <BadgeNavCount/>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Tour + User */}
        <div className="px-3 py-2.5 flex-shrink-0 space-y-0.5" style={{ borderTop:"1px solid var(--border)" }}>
          <TourTrigger onStart={() => window.dispatchEvent(new CustomEvent('aihub:start-tour'))}/>
          <SidebarUser/>
        </div>
      </aside>
    </>
  )
}

function SidebarUser() {
  const { user, profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  if (!user) return (
    <Link to="/auth/login"
      className="flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors">
      Sign in
    </Link>
  )
  const name = profile?.full_name ?? user.email?.split('@')[0] ?? 'You'
  const initials = name.slice(0,2).toUpperCase()
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 w-full px-2 py-2 rounded-md hover:bg-zinc-50 transition-colors">
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black" style={{ background:"#EEEEFF", color:"#5855D6" }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-zinc-900 truncate" style={{ fontSize:13 }}>{name}</p>
          <p className="text-zinc-400 truncate" style={{ fontSize:11 }}>{user.email}</p>
        </div>
        <ChevronDown size={12} className="text-zinc-400 flex-shrink-0"/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl shadow-panel border border-zinc-200 z-50 py-1 overflow-hidden animate-slide-up">
            <Link to="/settings" onClick={() => setOpen(false)}
              className="block px-3.5 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">Settings</Link>
            <Divider className="my-1"/>
            <button onClick={() => { signOut(); setOpen(false) }}
              className="w-full text-left px-3.5 py-2 text-sm text-signal-red hover:bg-red-50 transition-colors flex items-center gap-2">
              <LogOut size={13}/> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TOPBAR
// ══════════════════════════════════════════════════════════════════════════════

export function Topbar({ onMenuClick, onCmdK }: { onMenuClick: () => void; onCmdK: () => void }) {
  return (
    <header className="flex items-center gap-3 flex-shrink-0 px-5" style={{ height:"var(--topbar-h)", background:"var(--topbar-bg)", backdropFilter:"blur(16px) saturate(180%)", WebkitBackdropFilter:"blur(16px) saturate(180%)", borderBottom:"1px solid var(--border)" }}>
      <button onClick={onMenuClick} className="lg:hidden p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors">
        <Menu size={16}/>
      </button>
      <button onClick={onCmdK} className="flex items-center gap-2.5 flex-1 max-w-xl mx-auto px-4 py-2.5 rounded-xl transition-all hover:shadow-card-hover"
        style={{ background:"white", border:"1px solid var(--border)", boxShadow:"0 1px 2px rgba(0,0,0,0.04)" }}>
        <Search size={14} className="text-zinc-400 flex-shrink-0"/>
        <span className="flex-1 text-left" style={{ fontSize:13.5, color:"var(--text-3)" }}>Search resources, paths, topics…</span>
        <kbd className="hidden sm:flex items-center px-1.5 py-0.5 rounded-md font-medium text-zinc-400 border border-zinc-200" style={{ fontSize:11, background:"var(--surface-sub)" }}>⌘K</kbd>
      </button>
    </header>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMMAND PALETTE — ⌘K, the signature UX of the OS
// ══════════════════════════════════════════════════════════════════════════════

const CMD_STARTERS = [
  { icon:<FlaskConical size={14}/>, label:'Start a Playground exercise', href:'/playground' },
  { icon:<Search size={14}/>,       label:'Find resources on a topic', href:'/browse' },
  { icon:<Target size={14}/>,       label:'Take an assessment', href:'/assessment' },
  { icon:<GitBranch size={14}/>,    label:'See AI tool walkthroughs', href:'/workflows' },
  { icon:<Globe size={14}/>,        label:'View my curriculum path', href:'/curriculum' },
  { icon:<MessageSquare size={14}/>,label:'Open AI literacy chat', href:'/chat' },
]

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query,    setQuery]    = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading,  setLoading]  = useState(false)
  const [mode,     setMode]     = useState<'search' | 'chat'>('search')
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [intent,   setIntent]   = useState<{ difficulty?: string; type?: string; board?: string } | null>(null)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate  = useNavigate()

  // Build search index from all resources on mount
  useEffect(() => {
    if (isIndexReady()) return
    Promise.all([
      fetch('/api/resources?limit=200').then(r => r.json()),
      fetch('/api/paths').then(r => r.json()),
    ]).then(([resData, pathData]) => {
      buildSearchIndex(resData.data ?? [], pathData.data ?? [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 60); setQuery(''); setResults([]); setMode('search'); setMessages([]) }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); open ? onClose() : undefined }
      if (e.key === 'Escape' && open) onClose()
      if (!open) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && results.length > 0 && mode === 'search' && query.trim()) {
        e.preventDefault()
        const r = results[selected]
        if (r) { navigate(r.type === 'resource' ? `/content/${r.id}` : `/paths/${r.id}`); onClose() }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, results, selected, mode, query, navigate])

  // Live search as user types
  useEffect(() => {
    if (!query.trim() || mode === 'chat') { setResults([]); setIntent(null); return }
    const { results: res, intent: int } = searchIndex(query, { limit: 8 })
    setResults(res)
    setIntent(int)
    setSelected(0)
  }, [query, mode])

  const sendChat = async (text: string) => {
    if (!text.trim()) return
    setMode('chat')
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setQuery(''); setLoading(true)
    try {
      const data = await api.chat.send([...messages, userMsg],
        'You are a sharp AI literacy assistant embedded in a student OS. Give concise, direct answers. Max 100 words. When relevant, mention specific resources or learning paths from the platform.')
      setMessages(prev => [...prev, { role: 'assistant', content: data.text }])
    } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }]) }
    finally { setLoading(false) }
  }

  const QUICK = CMD_STARTERS

  if (!open) return null

  const hasFilters = intent && (intent.difficulty || intent.type || intent.board)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-modal border border-zinc-200 overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-100">
          {mode === 'chat'
            ? <Zap size={16} className="text-[#5855D6] flex-shrink-0"/>
            : <Search size={16} className="text-zinc-400 flex-shrink-0"/>}
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); if (mode === 'chat' && !messages.length) setMode('search') }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (results.length > 0 && mode === 'search') return // handled above
                if (query.trim()) sendChat(query)
              }
            }}
            placeholder={mode === 'chat' ? 'Follow up…' : 'Search resources, paths, topics… or ask AI'}
            className="flex-1 text-sm text-zinc-900 placeholder:text-zinc-400 bg-transparent focus:outline-none"
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            {mode === 'chat' && (
              <button onClick={() => { setMessages([]); setMode('search'); setQuery('') }}
                className="text-2xs text-zinc-400 hover:text-zinc-700 font-semibold transition-colors px-2 py-1 rounded-lg hover:bg-zinc-50">
                Clear
              </button>
            )}
            <Kbd>Esc</Kbd>
          </div>
        </div>

        {/* Intent filter chips — shown when natural language parsed filters */}
        {hasFilters && mode === 'search' && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#EEEEFF] border-b border-[#DDDDF8]">
            <Zap size={11} className="text-[#5855D6] flex-shrink-0"/>
            <span className="text-2xs text-[#5855D6] font-semibold">Filters detected:</span>
            {intent.difficulty && (
              <span className="px-2 py-0.5 bg-[#DDDDF8] text-[#4744C8] text-2xs font-bold rounded-full capitalize">{intent.difficulty}</span>
            )}
            {intent.type && (
              <span className="px-2 py-0.5 bg-[#DDDDF8] text-[#4744C8] text-2xs font-bold rounded-full capitalize">{intent.type}</span>
            )}
            {intent.board && (
              <span className="px-2 py-0.5 bg-[#DDDDF8] text-[#4744C8] text-2xs font-bold rounded-full">{intent.board}</span>
            )}
          </div>
        )}

        {/* Search results */}
        {mode === 'search' && results.length > 0 && (
          <div className="max-h-[400px] overflow-y-auto divide-y divide-ink-50">
            <p className="px-4 py-2 text-2xs font-bold uppercase tracking-widest text-zinc-300">
              Results
            </p>
            {results.map((r, i) => {
              const res = r.raw as any
              const isPath = r.type === 'path'
              return (
                <button key={r.id}
                  onClick={() => { navigate(isPath ? `/paths/${r.id}` : `/content/${r.id}`); onClose() }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                    i === selected ? 'bg-[#EEEEFF]' : 'hover:bg-zinc-50'
                  )}>
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-2xs font-black',
                    isPath ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                  )}>
                    {isPath
                      ? <GitBranch size={13}/>
                      : res.type === 'video'   ? <Play size={13}/>
                      : res.type === 'book'    ? <BookOpen size={13}/>
                      : res.type === 'article' ? <Hash size={13}/>
                      : <Layers size={13}/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{res.title}</p>
                    <p className="text-2xs text-zinc-400 truncate mt-0.5">
                      {isPath
                        ? `Learning path · ${res.estimatedHours}h · ${res.difficulty}`
                        : `${res.type} · ${res.difficulty ?? ''} · ${res.source ?? ''}`}
                    </p>
                  </div>
                  <ArrowRight size={12} className={cn('flex-shrink-0 transition-colors', i === selected ? 'text-[#5855D6]' : 'text-zinc-300')}/>
                </button>
              )
            })}
            {/* AI search option */}
            <button onClick={() => sendChat(query)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors border-t border-zinc-100">
              <div className="w-8 h-8 rounded-lg bg-[#EEEEFF] flex items-center justify-center flex-shrink-0">
                <Zap size={13} className="text-[#5855D6]"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-700">Ask AI about "<span className="text-[#5855D6]">{query}</span>"</p>
                <p className="text-2xs text-zinc-400 mt-0.5">Get a personalised recommendation</p>
              </div>
            </button>
          </div>
        )}

        {/* No results */}
        {mode === 'search' && query.trim() && results.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-zinc-500 mb-1">No resources found for "<span className="font-semibold text-zinc-700">{query}</span>"</p>
            <button onClick={() => sendChat(query)}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-[#5855D6] text-white text-xs font-bold rounded-xl hover:bg-[#4744C8] transition-colors">
              <Zap size={12}/> Ask AI instead
            </button>
          </div>
        )}

        {/* AI chat mode */}
        {mode === 'chat' && messages.length > 0 && (
          <div className="max-h-72 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'bg-ink-900 text-white rounded-br-sm'
                    : 'rounded-bl-sm border border-zinc-100" style={{ background:"#F5F4FF", color:"var(--text-1)" }}')}>
                  {m.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Zap size={11} className="text-[#5855D6]"/>
                      <span className="text-2xs font-bold text-[#5855D6] uppercase tracking-wide">AI</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#EEEEFF] border border-[#DDDDF8] rounded-xl rounded-bl-sm px-3.5 py-2.5">
                  <TypingDots/>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick nav (empty state) */}
        {mode === 'search' && !query && (
          <div className="py-2">
            <p className="px-4 py-1.5 text-2xs font-bold uppercase tracking-widest text-zinc-300">Quick access</p>
            {QUICK.map(s => (
              <button key={s.href} onClick={() => { navigate(s.href); onClose() }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors">
                <span className="text-zinc-400 flex-shrink-0">{s.icon}</span>
                {s.label}
                <ArrowRight size={13} className="text-zinc-300 ml-auto flex-shrink-0"/>
              </button>
            ))}
            <Divider className="mx-4 my-2"/>
            <p className="px-4 pb-2 text-xs text-zinc-400">Press Enter to ask your AI research partner</p>
          </div>
        )}

        {/* Chat follow-up bar */}
        {mode === 'chat' && (
          <div className="border-t border-zinc-100 px-4 py-2.5 flex items-center gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && query.trim()) sendChat(query) }}
              placeholder="Follow up…"
              className="flex-1 text-xs text-zinc-700 placeholder:text-zinc-400 bg-transparent focus:outline-none"
            />
            <button onClick={() => sendChat(query)} disabled={!query.trim() || loading}
              className="text-[#5855D6] hover:text-[#4744C8] disabled:opacity-30 transition-colors">
              <Send size={14}/>
            </button>
          </div>
        )}

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-zinc-100 flex items-center gap-4 text-2xs text-zinc-300">
          <span className="flex items-center gap-1"><Kbd>↑↓</Kbd> navigate</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
          <span className="flex items-center gap-1"><Kbd>Esc</Kbd> close</span>
          <span className="ml-auto">Enter without selecting → ask AI</span>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// APP SHELL
// ══════════════════════════════════════════════════════════════════════════════

// ── Mobile bottom navigation bar — visible only on small screens ──────────────
function MobileBottomNav() {
  const { pathname } = useLocation()
  const { profile }  = useAuth()
  const isTeacher    = profile?.role === 'teacher'

  const tabs = [
    { href: '/',           icon: <LayoutDashboard size={20}/>, label: 'Home'      },
    { href: '/browse',     icon: <Compass size={20}/>,         label: 'Browse'    },
    { href: '/playground', icon: <FlaskConical size={20}/>,    label: 'Play'      },
    { href: '/chat',       icon: <MessageSquare size={20}/>,   label: 'Chat'      },
    { href: isTeacher ? '/classroom' : '/progress',
      icon: isTeacher ? <Users size={20}/> : <BarChart2 size={20}/>,
      label: isTeacher ? 'Class' : 'Progress' },
  ]

  return (
    <nav className={cn(
      'fixed bottom-0 left-0 right-0 z-40 lg:hidden',
      'bg-white border-t border-zinc-200 safe-area-inset-bottom',
    )}>
      <div className="flex items-stretch h-14">
        {tabs.map(tab => {
          const active = pathname === tab.href ||
            (tab.href !== '/' && pathname.startsWith(tab.href))
          return (
            <Link key={tab.href} to={tab.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
                active ? 'text-[#5855D6]' : 'text-zinc-400 hover:text-zinc-600'
              )}>
              <span className={cn('transition-transform', active ? 'scale-110' : '')}>
                {tab.icon}
              </span>
              <span className={cn('text-[10px] font-semibold leading-none', active ? 'text-[#5855D6]' : 'text-zinc-400')}>
                {tab.label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#5855D6] rounded-full"/>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [cmdOpen,     setCmdOpen]     = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(v => !v) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const AUTH = ['/auth/login','/auth/signup']
  if (AUTH.some(r => pathname.startsWith(r))) return <>{children}</>

  const { queue: badgeQueue, clearFromQueue, award } = useBadges()
  const [appShowTour, setAppShowTour] = useState(false)

  // Listen for badge events dispatched from anywhere in the app
  useEffect(() => {
    const badgeHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (Array.isArray(detail) && detail.length) award(detail)
    }
    const tourHandler = () => setAppShowTour(true)
    window.addEventListener('aihub:badges',     badgeHandler)
    window.addEventListener('aihub:start-tour', tourHandler)
    return () => {
      window.removeEventListener('aihub:badges',     badgeHandler)
      window.removeEventListener('aihub:start-tour', tourHandler)
    }
  }, [award])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background:"var(--page-bg)" }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} onCmdK={() => setCmdOpen(true)}/>
        {/* pb-16 on mobile to make room for bottom tab bar */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">{children}</main>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)}/>
      <BadgeNotificationManager queue={badgeQueue} onClear={clearFromQueue}/>
      {appShowTour && <SpotlightTour onDone={() => setAppShowTour(false)}/>}
      {/* Mobile bottom nav — hidden on large screens */}
      <MobileBottomNav/>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT CARD — editorial, not a product tile
// ══════════════════════════════════════════════════════════════════════════════

// Per-type gradient + icon for thumbnails (used by SmartThumbnail + ResourceBanner)
const THUMB_CONFIG: Record<string, { gradient: string; tag: string }> = {
  video:       { gradient: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)', tag: 'bg-white/15 text-white' },
  seminar:     { gradient: 'linear-gradient(135deg,#1a0f2e 0%,#2d1b69 100%)', tag: 'bg-white/15 text-white' },
  book:        { gradient: 'linear-gradient(135deg,#0f2027 0%,#1a3a4a 100%)', tag: 'bg-white/15 text-white' },
  course:      { gradient: 'linear-gradient(135deg,#0a2018 0%,#14532d 100%)', tag: 'bg-white/15 text-white' },
  guide:       { gradient: 'linear-gradient(135deg,#1c1008 0%,#3d2708 100%)', tag: 'bg-white/15 text-white' },
  article:     { gradient: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)', tag: 'bg-white/15 text-white' },
  walkthrough: { gradient: 'linear-gradient(135deg,#0a1a0f 0%,#14532d 100%)', tag: 'bg-white/15 text-white' },
  pdf:         { gradient: 'linear-gradient(135deg,#1a0f0f 0%,#3d1c1c 100%)', tag: 'bg-white/15 text-white' },
}

const THUMB_ICON: Record<string, ReactNode> = {
  video:       <Play size={32} strokeWidth={1.5}/>,
  seminar:     <Play size={32} strokeWidth={1.5}/>,
  book:        <BookOpen size={32} strokeWidth={1.5}/>,
  course:      <Layers size={32} strokeWidth={1.5}/>,
  guide:       <Zap size={32} strokeWidth={1.5}/>,
  article:     <Hash size={32} strokeWidth={1.5}/>,
  walkthrough: <GitBranch size={32} strokeWidth={1.5}/>,
  pdf:         <BookOpen size={32} strokeWidth={1.5}/>,
}

const DIFFICULTY_DOT = { beginner:'bg-signal-green', intermediate:'bg-signal-blue', advanced:'bg-[#5855D6]' }

// Per-type rich gradient palettes for text thumbnails
const TEXT_THUMB_GRADIENT: Record<string, string> = {
  video:       'linear-gradient(145deg,#0f172a 0%,#1e3a5f 60%,#1e40af 100%)',
  seminar:     'linear-gradient(145deg,#1a0f2e 0%,#2d1b69 60%,#7c3aed 100%)',
  book:        'linear-gradient(145deg,#0c1a2e 0%,#0f2a4a 50%,#1e4d73 100%)',
  course:      'linear-gradient(145deg,#052e16 0%,#14532d 55%,#166534 100%)',
  guide:       'linear-gradient(145deg,#1c1008 0%,#451a03 50%,#92400e 100%)',
  article:     'linear-gradient(145deg,#0f172a 0%,#1e293b 55%,#334155 100%)',
  walkthrough: 'linear-gradient(145deg,#0a1a0f 0%,#14532d 50%,#15803d 100%)',
  pdf:         'linear-gradient(145deg,#1a0f0f 0%,#450a0a 50%,#991b1b 100%)',
}

/**
 * SmartThumbnail — three-tier fallback:
 * 1. YouTube thumbnail (videos with youtubeId) — photographic
 * 2. Text card (non-video or failed YouTube) — title + source on rich gradient
 * 3. Gradient icon (absolute fallback) — type icon on gradient
 *
 * Zero broken images. Every card looks intentional.
 */
export function SmartThumbnail({ resource, className }: { resource: Resource; className?: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const hasYT     = !!resource.youtubeId && !imgFailed
  const gradient  = TEXT_THUMB_GRADIENT[resource.type] ?? TEXT_THUMB_GRADIENT.article
  const icon      = THUMB_ICON[resource.type] ?? THUMB_ICON.article

  return (
    <div className={cn('absolute inset-0', className)}>
      {/* Base gradient always rendered */}
      <div className="absolute inset-0 noise" style={{ background: gradient }}>
        {/* Icon watermark — shows through for text cards, barely visible under YT thumb */}
        <div className={cn('absolute inset-0 flex items-center justify-center transition-opacity', hasYT ? 'opacity-0' : 'opacity-[0.12]')}>
          {icon && React.cloneElement(icon as React.ReactElement, { size: 48, strokeWidth: 1 })}
        </div>
      </div>

      {/* YouTube image overlay */}
      {resource.youtubeId && !imgFailed && (
        <img
          src={`https://img.youtube.com/vi/${resource.youtubeId}/mqdefault.jpg`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-80 transition-opacity group-hover:opacity-90"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      )}

      {/* Text card overlay — title + source for non-YT resources */}
      {!hasYT && (
        <div className="absolute inset-0 flex flex-col justify-end p-3" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)' }}>
          {resource.source && (
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45 mb-1 truncate">
              {resource.source}
            </p>
          )}
          <p className="text-[11px] font-bold text-white leading-tight line-clamp-2 [text-shadow:0_1px_4px_rgba(0,0,0,0.4)]">
            {resource.title}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * ResourceBanner — taller version for the ContentPage detail view.
 * Replaces the minimal dark "Open resource" card with a rich visual header.
 */
export function ResourceBanner({ resource }: { resource: Resource }) {
  const [imgFailed, setImgFailed] = useState(false)
  const cfg = THUMB_CONFIG[resource.type] ?? THUMB_CONFIG.article
  const icon = THUMB_ICON[resource.type] ?? THUMB_ICON.article
  const isVideo = resource.type === 'video' || resource.type === 'seminar'

  return (
    <div className="relative rounded-2xl overflow-hidden h-44 mb-6">
      {/* Gradient base */}
      <div className="absolute inset-0" style={{ background: cfg.gradient }}>
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 0)', backgroundSize: '18px 18px' }}/>
        <div className="absolute inset-0 flex items-center justify-center text-white/15">
          {React.cloneElement(icon as React.ReactElement, { size: 64, strokeWidth: 1 })}
        </div>
      </div>

      {/* YouTube thumbnail overlay (videos only, when not failed) */}
      {resource.youtubeId && !imgFailed && (
        <img
          src={`https://img.youtube.com/vi/${resource.youtubeId}/hqdefault.jpg`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      )}

      {/* Gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"/>
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent"/>

      {/* Content anchored bottom-left */}
      <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          {resource.source && (
            <p className="text-2xs text-white/50 font-medium mb-1.5 uppercase tracking-wider">{resource.source}</p>
          )}
          <h1 className="text-lg font-bold text-white leading-snug line-clamp-2">{resource.title}</h1>
        </div>
        {/* Open resource CTA — only for non-video */}
        {!isVideo && (
          <a href={resource.url} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-white text-zinc-900 rounded-xl text-xs font-bold hover:bg-zinc-100 transition-colors shadow-sm">
            Open <ExternalLink size={11}/>
          </a>
        )}
      </div>
    </div>
  )
}

export function ContentCard({ resource }: { resource: Resource }) {
  const { isComplete } = useProgress()
  const { isBookmarked, toggle } = useBookmarks()
  const done = isComplete(resource.id)
  const bookmarked = isBookmarked(resource.id)
  const isPlayable = resource.type === 'video' || resource.type === 'seminar'

  return (
    <Link to={`/content/${resource.id}`}
      className="group flex flex-col bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:shadow-card-hover hover:border-zinc-300 transition-all duration-200">
      {/* Thumbnail — SmartThumbnail always shows, YouTube overlaid on top when available */}
      <div className="relative h-[116px] overflow-hidden">
        <SmartThumbnail resource={resource}/>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"/>

        {/* Type badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wide backdrop-blur-sm bg-white/15 text-white">
            {resource.type}
          </span>
        </div>

        {/* Play button */}
        {isPlayable && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:bg-white/30 group-hover:scale-110 transition-all duration-200 border border-white/30">
              <Play size={14} className="text-white ml-0.5" fill="white"/>
            </div>
          </div>
        )}

        {/* Duration */}
        {resource.duration && (
          <div className="absolute bottom-2 right-2 text-2xs font-semibold text-white/80 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded">
            {resource.duration}
          </div>
        )}

        {/* Done checkmark */}
        {done && (
          <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-signal-green flex items-center justify-center">
            <Check size={11} className="text-white" strokeWidth={3}/>
          </div>
        )}

        {/* Bookmark */}
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggle(resource.id) }}
          className={cn('absolute bottom-2 left-2.5 w-6 h-6 rounded-full flex items-center justify-center transition-all',
            bookmarked
              ? 'bg-[#5855D6] text-white'
              : 'bg-black/30 text-white/70 hover:bg-black/50 backdrop-blur-sm')}>
          <Bookmark size={11} fill={bookmarked ? 'currentColor' : 'none'}/>
        </button>
      </div>

      {/* Body */}
      <div className="p-3.5 flex flex-col flex-1 gap-2">
        {/* Author line */}
        {resource.author && (
          <p className="text-2xs text-zinc-400 font-medium truncate">{resource.author}</p>
        )}

        {/* Title */}
        <h3 className="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2 group-hover:text-[#5855D6] transition-colors duration-100">
          {resource.title}
        </h3>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', DIFFICULTY_DOT[resource.difficulty as keyof typeof DIFFICULTY_DOT] ?? 'bg-zinc-300')}/>
            <span className="text-2xs text-zinc-400 font-medium capitalize">{resource.difficulty}</span>
            {resource.boards?.includes('CBSE') && (
              <span className="text-2xs text-zinc-300">· CBSE</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-2xs text-zinc-400">
            <Star size={10} className="text-amber-400 fill-amber-400"/>
            <span className="font-semibold text-zinc-600">{resource.rating}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function ContentGrid({ resources }: { resources: Resource[] }) {
  if (!resources.length) return (
    <div className="flex flex-col items-center justify-center py-16 bg-zinc-50 border border-zinc-200 rounded-2xl text-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 shadow-card flex items-center justify-center mb-4">
        <Search size={20} className="text-zinc-400"/>
      </div>
      <p className="text-sm font-bold text-zinc-700 mb-1">No resources match your filters</p>
      <p className="text-xs text-zinc-400 max-w-xs leading-relaxed mb-5">Try clearing a filter, broadening your search, or start with a curated learning path.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/paths/lp1" className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#5855D6] text-white text-xs font-bold rounded-lg hover:bg-[#4744C8] transition-colors">
          Start AI Fundamentals <ArrowRight size={11}/>
        </Link>
        <Link to="/curriculum" className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-zinc-700 text-xs font-bold rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors">
          View all paths
        </Link>
      </div>
    </div>
  )
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {resources.map((r, i) => (
        <div key={r.id} className={i === 0 ? 'sm:col-span-2' : ''}>
          <ContentCard resource={r}/>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// FILTER ROW
// ══════════════════════════════════════════════════════════════════════════════

const FILTERS = {
  difficulty: ['beginner','intermediate','advanced'],
  audience:   ['teacher','student'],
  type:       ['video','seminar','article','book','course','guide'],
  board:      ['CBSE','IGCSE','IB','RBSE'],
}

export function FilterRow({ filters, onChange }: {
  filters: Record<string,string>; onChange: (f: Record<string,string>) => void
}) {
  const set = (k: string, v: string) => onChange({ ...filters, [k]: filters[k] === v ? '' : v })
  const active = Object.values(filters).filter(Boolean).length

  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {Object.entries(FILTERS).flatMap(([key, values]) => values.map(v => {
        const on = filters[key] === v
        return (
          <button key={`${key}-${v}`} onClick={() => set(key,v)}
            className={cn(
              'px-2.5 py-1 rounded-full font-semibold border transition-all duration-100 capitalize',
              on
                ? 'bg-ink-900 text-white border-ink-900 shadow-sm'
                : 'border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 bg-white',
            )}>
            {v}
          </button>
        )
      }))}
      {active > 0 && (
        <button onClick={() => onChange({})}
          className="px-2.5 py-1 rounded-full text-signal-red hover:bg-red-50 font-semibold transition-colors border border-transparent">
          Clear {active}
        </button>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// HOME — OS hero + capability modules
// ══════════════════════════════════════════════════════════════════════════════

export function OSHero({ name }: { name?: string }) {
  const hour  = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return (
    <div className="relative rounded-2xl overflow-hidden px-8 py-10 mb-8"
      style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1e1b4b 60%, #312e81 100%)' }}>
      {/* Dot texture */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 0)', backgroundSize: '24px 24px' }}/>
      {/* Glows */}
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#5855D6]/10 blur-3xl pointer-events-none"/>
      <div className="absolute -bottom-24 -left-12 w-72 h-72 rounded-full bg-violet-500/15 blur-3xl pointer-events-none"/>

      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 mb-5">
          <Zap size={11} className="text-accent-300"/>
          <span className="text-2xs font-bold text-white/70 uppercase tracking-widest">AI-Native Learning OS</span>
        </div>

        {name ? (
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
                {greet}, {name}.
              </h1>
              <p className="text-sm text-white/50 max-w-lg leading-relaxed">
                Your OS is ready. Pick up where you left off, or explore something new.
              </p>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <Link to="/playground"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-900 rounded-xl text-xs font-bold hover:bg-zinc-50 transition-colors shadow-sm">
                Playground <ArrowRight size={13}/>
              </Link>
              <Link to="/browse"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white rounded-xl text-xs font-bold border border-white/15 hover:bg-white/20 transition-colors">
                Browse resources
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-8 flex-wrap">
            <div className="max-w-xl">
              <h1 className="text-4xl font-bold text-white tracking-tight mb-3 leading-tight">
                Train to think like<br/>
                <span className="bg-gradient-to-r from-white via-accent-300 to-violet-300 bg-clip-text text-transparent">
                  the top 1%.
                </span>
              </h1>
              <p className="text-sm text-white/55 max-w-md leading-relaxed mb-6">
                Researchers. Founders. Analysts. Engineers. They don't just use AI — they operate with it. This is where that starts.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/playground"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-900 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-colors shadow-sm">
                  Start the Playground <ArrowRight size={14}/>
                </Link>
                <Link to="/browse"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white rounded-xl text-sm font-bold border border-white/15 hover:bg-white/20 transition-colors">
                  Explore resources
                </Link>
              </div>
            </div>
            {/* Stats strip — visible on desktop */}
            <div className="hidden lg:flex flex-col gap-3">
              {[
                { val: '50+', label: 'Resources' },
                { val: '8',   label: 'Learning paths' },
                { val: '15',  label: 'Activities' },
                { val: '6',   label: 'AI tool guides' },
              ].map(s => (
                <div key={s.label} className="text-right">
                  <p className="text-2xl font-black text-white leading-none">{s.val}</p>
                  <p className="text-2xs text-white/35 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function CapabilityModules() {
  const modules = [
    { icon:<FlaskConical size={18}/>, label:'Playground',  sub:'Hands-on experiments',   href:'/playground', num:'01' },
    { icon:<Target size={18}/>,       label:'Assessment',  sub:'Test & get certified',   href:'/assessment', num:'02' },
    { icon:<Users size={18}/>,        label:'Activities',  sub:'15 classroom exercises', href:'/activities', num:'03' },
    { icon:<Globe size={18}/>,        label:'Curriculum',  sub:'CBSE, IGCSE, IB paths',  href:'/curriculum', num:'04' },
    { icon:<GitBranch size={18}/>,    label:'Workflows',   sub:'AI tool walkthroughs',   href:'/workflows',  num:'05' },
    { icon:<MessageSquare size={18}/>,label:'AI Chat',     sub:'Research partner',       href:'/chat',       num:'06' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      {modules.map(m => (
        <Link key={m.href} to={m.href}
          className="group relative flex flex-col gap-4 p-4 bg-white rounded-2xl transition-all duration-200"
          style={{ border:'1px solid var(--border)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow='0 6px 24px -4px rgba(0,0,0,0.09)'; (e.currentTarget as HTMLElement).style.borderColor='#C4C2E8' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow=''; (e.currentTarget as HTMLElement).style.borderColor='var(--border)' }}>
          <span className="absolute top-3.5 right-4 font-bold tabular-nums" style={{ fontSize:10, color:'#D5D5DB', letterSpacing:'0.05em' }}>{m.num}</span>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-zinc-100 text-zinc-500 group-hover:bg-[#EEEEFF] group-hover:text-[#5855D6] transition-all duration-150">
            {m.icon}
          </div>
          <div>
            <p className="font-bold leading-none mb-1 group-hover:text-[#5855D6] transition-colors" style={{ fontSize:13, color:'var(--text-1)' }}>{m.label}</p>
            <p className="leading-snug" style={{ fontSize:11, color:'var(--text-3)' }}>{m.sub}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

export function LearningPathStrip({ paths, pathProgress={} }: {
  paths: LearningPath[]; pathProgress?: Record<string,number>
}) {
  const icons: Record<string, ReactNode> = {
    Brain:<Brain size={15}/>, MessageSquare:<MessageSquare size={15}/>, GraduationCap:<GraduationCap size={15}/>,
    ShieldCheck:<ShieldCheck size={15}/>, BookOpen:<BookOpen size={15}/>, Route:<Route size={15}/>,
    Globe:<Globe size={15}/>, GitBranch:<GitBranch size={15}/>,
  }
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-zinc-800">Learning paths</h2>
        <Link to="/curriculum" className="text-xs text-[#5855D6] hover:text-[#4744C8] font-semibold flex items-center gap-1">
          All paths <ChevronRight size={12}/>
        </Link>
      </div>
      <div className="relative">
        <div className="absolute right-0 top-0 bottom-2 w-10 z-10 pointer-events-none lg:hidden" style={{ background:'linear-gradient(to right,transparent,var(--page-bg))' }}/>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar snap-x">
        {paths.slice(0, 8).map(path => {
          const prog = pathProgress[path.id] ?? 0
          return (
            <Link key={path.id} to={`/paths/${path.id}`}
              className="group flex-shrink-0 w-[220px] snap-start bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:shadow-card-hover hover:border-zinc-300 transition-all duration-200">
              {/* Coloured accent stripe */}
              <div className={cn('h-1 w-full', path.accentColor)}/>
              <div className="p-4">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3', path.accentColor)}>
                  {icons[path.iconName] ?? <Brain size={15}/>}
                </div>
                <h3 className="text-sm font-bold text-zinc-800 leading-snug mb-2 line-clamp-2 group-hover:text-[#5855D6] transition-colors">
                  {path.title}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-2xs text-zinc-400"><Clock size={10}/> {path.estimatedHours}h</span>
                  <Badge variant={path.difficulty as any} size="xs"/>
                </div>
                {prog > 0 && (
                  <div className="mt-3">
                    <ProgressBar value={prog} size="xs"/>
                    <p className="text-2xs text-zinc-400 mt-1">{prog}% complete</p>
                  </div>
                )}
              </div>
            </Link>
          )
        })}
        </div>
      </div>
    </section>
  )
}


// ── Tool SVG lettermarks ─────────────────────────────────────────────────────
// Custom-designed SVG lettermark badges — not official logos, inspired by brand identity
const TOOL_MARKS: Record<string, (size: number) => React.ReactElement> = {
  ChatGPT: (sz) => (
    <svg width={sz} height={sz} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#1a1a1a"/>
      <path d="M20 8C13.373 8 8 13.373 8 20C8 26.627 13.373 32 20 32C26.627 32 32 26.627 32 20C32 13.373 26.627 8 20 8Z" fill="none" stroke="#10a37f" strokeWidth="1.5"/>
      <path d="M15 20C15 17.238 17.238 15 20 15C22.762 15 25 17.238 25 20C25 22.762 22.762 25 20 25" stroke="#10a37f" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="20" cy="20" r="2.5" fill="#10a37f"/>
    </svg>
  ),
  Claude: (sz) => (
    <svg width={sz} height={sz} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#cc785c"/>
      <path d="M12 28L17.5 12H19.5L25 28H23L21.8 24.5H15.2L14 28H12ZM15.8 23H21.2L18.5 14.8L15.8 23Z" fill="white" fillOpacity="0.95"/>
    </svg>
  ),
  Perplexity: (sz) => (
    <svg width={sz} height={sz} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#1e3a5f"/>
      <path d="M20 10L28 15V25L20 30L12 25V15L20 10Z" fill="none" stroke="#7eb8ff" strokeWidth="1.5"/>
      <path d="M20 10V30M12 15L28 25M28 15L12 25" stroke="#7eb8ff" strokeWidth="1" strokeOpacity="0.5"/>
      <circle cx="20" cy="20" r="3" fill="#7eb8ff"/>
    </svg>
  ),
  NotebookLM: (sz) => (
    <svg width={sz} height={sz} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#f8fafc"/>
      <rect x="11" y="10" width="18" height="20" rx="3" fill="none" stroke="#334155" strokeWidth="1.5"/>
      <path d="M15 16H25M15 20H25M15 24H21" stroke="#334155" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="27" cy="27" r="5" fill="#4285f4"/>
      <path d="M25 27H29M27 25V29" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Gemini: (sz) => (
    <svg width={sz} height={sz} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#1a3a4a"/>
      <path d="M20 8C20 8 20 14 14 20C20 26 20 32 20 32C20 32 20 26 26 20C20 14 20 8 20 8Z" fill="url(#gem_grad)"/>
      <defs>
        <linearGradient id="gem_grad" x1="14" y1="8" x2="26" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4fb3d4"/>
          <stop offset="1" stopColor="#4285f4"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  Midjourney: (sz) => (
    <svg width={sz} height={sz} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#1a1a2e"/>
      <path d="M12 28L18 12H20L22 17L24 12H26L22 22L26 28H24L22 24L18 28H12Z" fill="#8b9fff" fillOpacity="0.9"/>
    </svg>
  ),
}

export function ToolLettermark({ toolName, size = 40 }: { toolName: string; size?: number }) {
  const mark = TOOL_MARKS[toolName]
  if (mark) return mark(size)
  // Fallback for unknown tools
  const initials = toolName.slice(0, 2).toUpperCase()
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#1e293b"/>
      <text x="20" y="26" textAnchor="middle" fill="white" fontSize="14" fontWeight="800" fontFamily="system-ui">{initials}</text>
    </svg>
  )
}

export function ToolGuideStrip({ tools }: { tools: { id:string; toolName:string; guideCount:number; logoColor:string; textColor:string }[] }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-zinc-800">AI tool walkthroughs</h2>
        <Link to="/tools" className="text-xs text-[#5855D6] hover:text-[#4744C8] font-semibold flex items-center gap-1">
          All tools <ChevronRight size={12}/>
        </Link>
      </div>
      <div className="relative">
        <div className="absolute right-0 top-0 bottom-2 w-10 z-10 pointer-events-none lg:hidden" style={{ background:'linear-gradient(to right,transparent,var(--page-bg))' }}/>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar snap-x">
        {tools.map(t => (
          <Link key={t.id} to={`/tools/${t.id}`}
            className="group flex-shrink-0 w-[148px] snap-start bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-zinc-300 hover:shadow-card-hover transition-all duration-200">
            {/* Brand coloured header with lettermark */}
            <div className={cn('flex items-center gap-2.5 px-3.5 pt-3.5 pb-3', t.logoColor)}>
              <ToolLettermark toolName={t.toolName} size={32}/>
              <div className="min-w-0">
                <p className={cn('text-xs font-extrabold leading-tight truncate', t.textColor)}>{t.toolName}</p>
                <p className={cn('text-[10px] opacity-55 font-medium', t.textColor)}>{t.guideCount} guides</p>
              </div>
            </div>
            {/* CTA footer */}
            <div className="px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-2xs font-semibold text-zinc-500 group-hover:text-[#5855D6] transition-colors">View guides</span>
              <ChevronRight size={11} className="text-zinc-300 group-hover:text-[#5855D6] transition-colors"/>
            </div>
          </Link>
        ))}
      </div>
    </div>
    </section>
  )
}

export function PersonalisedBanner() {
  const [profile, setProfile] = useState<ReturnType<typeof getOnboardingProfile>>(null)
  useEffect(() => { setProfile(getOnboardingProfile()) }, [])
  if (!profile) return null

  const R = {
    teacher: { bg: 'bg-amber-50 border-amber-100',   bar: 'bg-amber-400',   text: 'text-amber-800',   label: 'Teacher mode',  subtext: 'text-amber-600' },
    student: { bg: 'bg-[#EEEEFF] border-[#DDDDF8]', bar: 'bg-[#5855D6]',   text: 'text-accent-800',  label: 'Student mode',  subtext: 'text-[#5855D6]' },
    curious: { bg: 'bg-violet-50 border-violet-100', bar: 'bg-violet-500',  text: 'text-violet-800',  label: 'Explorer mode', subtext: 'text-violet-600' },
  }
  const r = R[profile.role]

  return (
    <div className={cn('relative flex items-center gap-4 pl-5 pr-4 py-3.5 rounded-xl border mb-6 overflow-hidden flex-wrap', r.bg)}>
      {/* Left accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-xl', r.bar)}/>
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <span className={cn('text-xs font-bold', r.text)}>{r.label}</span>
        {profile.board && profile.board !== 'Not applicable' && (
          <span className={cn('px-2 py-0.5 rounded-md bg-white/70 text-xs font-semibold border border-white/60', r.text)}>
            {profile.board}
          </span>
        )}
        {profile.goals?.length > 0 && (
          <span className={cn('text-xs hidden sm:block truncate', r.subtext)}>
            {profile.goals.slice(0, 2).join(' · ')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {[
          { l: 'Curriculum', h: '/curriculum' },
          { l: 'Playground', h: '/playground' },
          { l: 'Activities',  h: '/activities' },
        ].map(link => (
          <Link key={link.h} to={link.h}
            className={cn('inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/60 border border-white/50 hover:bg-white transition-colors', r.text)}>
            {link.l} <ChevronRight size={10}/>
          </Link>
        ))}
        <button onClick={() => { resetOnboarding(); setProfile(null) }}
          className={cn('p-1.5 rounded-lg hover:bg-white/60 transition-colors ml-1', r.subtext)} title="Reset profile">
          <RotateCcw size={11}/>
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// STAGE CHAT + STAGE PROGRESS — playground components (unchanged functionality)
// ══════════════════════════════════════════════════════════════════════════════

// Maps exercise concepts to platform resource topics for smart recommendations
const CONCEPT_TOPICS: Record<string, string[]> = {
  'Hallucination':                  ['How AI works', 'LLMs', 'Critical thinking'],
  'Sycophancy':                     ['How AI works', 'AI safety', 'Critical thinking'],
  'Training data bias':             ['AI ethics', 'How AI works'],
  'Training data cutoff':           ['How AI works', 'LLMs'],
  'Prompt injection':               ['AI safety', 'Prompting'],
  'Few-shot prompting':             ['Prompting', 'How AI works'],
  'Logical reasoning failures':     ['How AI works', 'Critical thinking'],
  'Token prediction':               ['How AI works', 'LLMs'],
  'RLHF and alignment':             ['AI safety', 'How AI works'],
  'AI text detection':              ['Critical thinking', 'Generative AI'],
  'Context window and memory':      ['How AI works', 'LLMs'],
  'Multimodal AI limits':           ['How AI works', 'Deep learning'],
  'Error compounding in AI chains': ['AI safety', 'How AI works'],
}
export { CONCEPT_TOPICS }

/** Builds a rich per-stage system prompt that teaches, corrects, and recommends platform resources */
function buildPlaygroundSystemPrompt(
  exercise: DeepExercise,
  stage: ExerciseStage,
  stageIndex: number,
  totalStages: number,
  completedStages: Set<number>,
  resources: Resource[]
): string {
  const completedTitles = [...completedStages]
    .map(i => exercise.stages[i]?.title).filter(Boolean)

  const learnList = (exercise.whatYouWillLearn || []).slice(0, 3)
    .map((l: string) => `- ${l}`).join('\n')

  const resourceLines = resources.slice(0, 6).map(r =>
    `- "${r.title}" (${r.type}, ${r.difficulty}) — ${r.description.slice(0, 110)}… → /content/${r.id}`
  ).join('\n')

  const completedNote = completedTitles.length > 0
    ? `STUDENT PROGRESS: They have already completed — ${completedTitles.join(', ')}. Build on these naturally.`
    : `STUDENT PROGRESS: This is their very first stage. Be welcoming and make it easy to start.`

  const noticeList = stage.whatToNotice.map((w: string) => `- ${w}`).join('\n')

  return [
    `You are a warm, patient AI literacy tutor on AIhub — an educational platform for students (age 10+), teachers, and complete beginners with no AI background.`,
    ``,
    `EXERCISE: "${exercise.title}"`,
    `CONCEPT BEING TAUGHT: ${exercise.concept}`,
    `WHAT THE STUDENT WILL LEARN:`,
    learnList,
    ``,
    `CURRENT STAGE ${stageIndex + 1} of ${totalStages}: "${stage.title}"`,
    `STAGE TEACHING GOAL: ${stage.instruction}`,
    `KEY INSIGHTS TO GUIDE THE STUDENT TOWARD:`,
    noticeList,
    ``,
    completedNote,
    ``,
    `HOW TO RESPOND:`,
    `1. Always answer the student's question clearly and helpfully. Use simple language — explain any jargon. Write as if explaining to a curious 12-year-old, but never be patronising.`,
    `2. Use real-world, everyday examples (school, social media, everyday objects) to make concepts concrete.`,
    `3. After every answer, always add a short section that begins with exactly "💡 Prompt tip:" — in 1–2 sentences, tell the student how they could rephrase or improve their question for better learning. If their question was already excellent, say so briefly and suggest a variation. This section is mandatory.`,
    `4. If a student goes off-topic or seems stuck, gently redirect them toward the exercise concept: "${exercise.concept}".`,
    `5. Be warm, patient, and enthusiastic. Every question is valid. Never make the student feel silly.`,
    ``,
    `PLATFORM RESOURCES — Recommend ONLY from this list when a student asks for a guide, wants to learn more, or their question matches a topic:`,
    resourceLines || `- No specific resources matched — suggest the student visit the Browse section on AIhub.`,
    ``,
    `When recommending, say: "On AIhub, I'd suggest checking out '[title]' — you can find it in the Browse section." Never invent resources.`,
  ].join('\n')
}

/** Splits an AI response into the main answer and the optional prompt tip */
function parseAIResponse(content: string): { main: string; tip: string | null } {
  const marker = '💡 Prompt tip:'
  const idx = content.indexOf(marker)
  if (idx === -1) return { main: content.trim(), tip: null }
  return {
    main: content.slice(0, idx).trim(),
    tip: content.slice(idx + marker.length).trim(),
  }
}

export function StageChat({ exercise, stage, stageIndex, totalStages, completedStages, relevantResources, onStageComplete, isCompleted }: {
  exercise: DeepExercise
  stage: ExerciseStage
  stageIndex: number
  totalStages: number
  completedStages: Set<number>
  relevantResources: Resource[]
  onStageComplete: () => void
  isCompleted: boolean
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [showSystem, setShowSystem]     = useState(false)
  const [showHints, setShowHints]       = useState(false)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([]); setInput('')
    setShowSystem(false); setShowHints(false); setShowFollowUp(false); setError(null)
  }, [stage.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const builtSystemPrompt = useMemo(
    () => buildPlaygroundSystemPrompt(exercise, stage, stageIndex, totalStages, completedStages, relevantResources),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exercise.id, stage.id, stageIndex, completedStages.size, relevantResources.length]
  )

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    setError(null)
    const userMsg: Message = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const data = await api.chat.send([...messages, userMsg], builtSystemPrompt)
      setMessages(prev => [...prev, { role: 'assistant', content: data.text }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const hasResponded = messages.some(m => m.role === 'assistant')

  return (
    <div className="flex flex-col h-full bg-white">

      {/* Chat messages — stage mission card lives inside here, not as a separate header */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

        {/* Mission card — always at top, collapses context in place */}
        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xs font-bold text-zinc-400 uppercase tracking-wider">
              Stage {stageIndex + 1} / {totalStages}
            </span>
            {isCompleted && <Badge variant="green" size="xs">Done</Badge>}
          </div>
          <h3 className="text-sm font-semibold text-zinc-900 mb-1">{stage.title}</h3>
          <p className="text-xs text-zinc-500 leading-relaxed mb-3">{stage.instruction}</p>

          {/* Compact toggle row */}
          <div className="flex items-center gap-4 pt-3 border-t border-zinc-100 flex-wrap">
            <button onClick={() => setShowSystem(v => !v)}
              className="flex items-center gap-1 text-2xs text-[#5855D6] hover:text-[#4744C8] font-semibold">
              {showSystem ? <EyeOff size={11}/> : <Eye size={11}/>}
              {showSystem ? 'Hide' : 'System prompt'}
            </button>
            <button onClick={() => setShowHints(v => !v)}
              className="flex items-center gap-1 text-2xs text-amber-600 hover:text-amber-700 font-semibold">
              <Lightbulb size={11}/>
              {showHints ? 'Hide hints' : 'Hints'}
            </button>
            {stage.followUps.length > 0 && (
              <button onClick={() => setShowFollowUp(v => !v)}
                className="flex items-center gap-1 text-2xs text-zinc-400 hover:text-zinc-700 font-semibold">
                {showFollowUp ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
                Follow-ups
              </button>
            )}
          </div>

          {/* Expandable panels — expand downward within the mission card */}
          {showSystem && (
            <div className="mt-3 p-3 bg-ink-950 rounded-xl">
              <p className="text-2xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">What the AI was told</p>
              <pre className="text-2xs text-accent-300 font-mono leading-relaxed whitespace-pre-wrap">{builtSystemPrompt}</pre>
            </div>
          )}
          {showHints && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
              <p className="text-2xs font-bold text-amber-700 uppercase tracking-wider">What to observe</p>
              {stage.whatToNotice.map((h, i) => (
                <p key={i} className="text-xs text-amber-800 leading-relaxed flex items-start gap-1.5">
                  <span className="text-amber-400 flex-shrink-0 mt-0.5">→</span>{h}
                </p>
              ))}
            </div>
          )}
          {showFollowUp && (
            <div className="mt-3 p-3 bg-white border border-zinc-100 rounded-xl space-y-2.5">
              <p className="text-2xs font-bold text-zinc-500 uppercase tracking-wider">Try these follow-up prompts</p>
              {stage.followUps.map((fu, i) => (
                <div key={i} className="flex items-start gap-2">
                  <p className="flex-1 text-xs text-zinc-600 leading-relaxed">{fu}</p>
                  <button onClick={() => setInput(fu)}
                    className="px-2 py-0.5 text-2xs font-semibold text-[#5855D6] border border-[#5855D6] rounded-md hover:bg-indigo-50 flex-shrink-0 transition-colors">
                    Use
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suggested prompt card — shown only before any message */}
        {messages.length === 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">
              Suggested prompt to try
            </p>
            <p className="text-sm text-indigo-800 leading-relaxed mb-4">{stage.promptToTry}</p>
            <div className="flex items-center gap-3">
              <button onClick={() => send(stage.promptToTry)}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
                <Send size={11}/> Send this
              </button>
              <button onClick={() => setInput(stage.promptToTry)}
                className="px-4 py-2 border border-indigo-200 text-indigo-600 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors">
                Edit first
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] bg-ink-900 text-white rounded-2xl rounded-br-sm px-5 py-3.5 text-sm leading-relaxed">
                  {msg.content}
                </div>
              </div>
            )
          }
          const { main, tip } = parseAIResponse(msg.content)
          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] space-y-3">
                <div className="bg-zinc-50 border border-zinc-100 rounded-2xl rounded-bl-sm px-5 py-4">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">AI response</p>
                  <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">{main}</p>
                </div>
                {tip && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                    <Lightbulb size={14} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                    <div>
                      <p className="text-xs font-bold text-amber-700 mb-1">Prompt tip</p>
                      <p className="text-xs text-amber-800 leading-relaxed">{tip}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-50 border border-zinc-100 rounded-2xl rounded-bl-sm px-5 py-4"><TypingDots/></div>
          </div>
        )}
        {error && (
          <p className="text-sm text-signal-red bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-zinc-100 px-4 py-3 bg-white">
        <div className="relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(input) }
            }}
            rows={2}
            placeholder="Write a prompt, or use the suggestion above…"
            className="w-full px-4 py-2.5 pr-12 text-sm resize-none rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-transparent transition-all leading-relaxed"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="absolute right-2.5 bottom-2.5 w-8 h-8 rounded-lg bg-ink-900 text-white flex items-center justify-center hover:bg-ink-800 disabled:opacity-30 transition-colors">
            <Send size={13}/>
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-2xs text-zinc-400">⌘↩ to send</p>
          <button
            onClick={() => { setMessages([]); setInput(''); setError(null) }}
            className="flex items-center gap-1 text-2xs text-zinc-400 hover:text-zinc-600 transition-colors">
            <RotateCcw size={10}/> Reset
          </button>
        </div>

        {!hasResponded && !isCompleted && (
          <p className="mt-2 text-center text-2xs text-zinc-400 pb-1">
            Send a prompt above to unlock stage completion.
          </p>
        )}
        {hasResponded && !isCompleted && (
          <button onClick={onStageComplete}
            className="mt-2.5 w-full py-2.5 bg-signal-green text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
            I've observed this — {stageIndex < totalStages - 1 ? 'next stage' : 'see analysis'} →
          </button>
        )}
        {isCompleted && stageIndex < totalStages - 1 && (
          <button onClick={onStageComplete}
            className="mt-2.5 w-full py-2.5 bg-zinc-100 text-zinc-700 text-sm font-semibold rounded-xl hover:bg-zinc-200 transition-colors">
            Continue to next stage →
          </button>
        )}
      </div>
    </div>
  )
}


export function StageProgress({ stages, currentStageIdx, completedStages, onSelect }: {
  stages: ExerciseStage[]; currentStageIdx: number; completedStages: Set<number>; onSelect: (idx: number) => void
}) {
  return (
    <div className="flex items-center gap-0">
      {stages.map((stage, idx) => {
        const done = completedStages.has(idx)
        const active = idx === currentStageIdx
        const locked = idx > 0 && !completedStages.has(idx - 1) && !active
        const label = stage.title.replace(`Stage ${idx + 1} — `, '').replace(`Stage ${idx + 1} - `, '')
        return (
          <React.Fragment key={stage.id}>
            <button
              onClick={() => !locked && onSelect(idx)}
              disabled={locked}
              title={label}
              aria-label={`Stage ${idx + 1}: ${label}${done ? ' (done)' : active ? ' (current)' : ''}`}
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center border-2 text-2xs font-bold transition-all flex-shrink-0',
                locked ? 'opacity-30 cursor-not-allowed border-zinc-200 text-zinc-400' :
                done    ? 'bg-signal-green border-signal-green text-white cursor-pointer' :
                active  ? 'bg-white border-[#5855D6] text-[#5855D6] cursor-pointer shadow-sm' :
                          'bg-white border-zinc-200 text-zinc-400 cursor-pointer hover:border-zinc-400'
              )}>
              {done ? <CheckCircle2 size={12}/> : idx + 1}
            </button>
            {idx < stages.length - 1 && (
              <div className={cn('h-0.5 flex-1 transition-colors min-w-[12px]',
                completedStages.has(idx) ? 'bg-signal-green' : 'bg-zinc-100')}/>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// DEEP ANALYSIS — post-exercise analysis tabs
// ══════════════════════════════════════════════════════════════════════════════

export function PerspectivesPanel({ perspectives }: { perspectives: Perspective[] }) {
  const [active, setActive] = useState(0)
  const p = perspectives[active]
  if (!p) return null
  return (
    <div className="rounded-xl border border-zinc-200 overflow-hidden">
      <div className="flex overflow-x-auto border-b border-zinc-100 bg-zinc-50 no-scrollbar">
        {perspectives.map((per, idx) => (
          <button key={per.role} onClick={() => setActive(idx)}
            className={cn('flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all border-b-2',
              active === idx ? 'border-accent-500 text-[#5855D6] bg-white' : 'border-transparent text-zinc-500 hover:text-zinc-700')}>
            <span className="text-base">{per.icon}</span>{per.role}
          </button>
        ))}
      </div>
      <div className="p-5 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">{p.icon}</span>
          <p className="text-sm font-bold text-zinc-900">{p.role}</p>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-2xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Their view</p>
            <p className="text-sm text-zinc-700 leading-relaxed">{p.view}</p>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-2xs font-bold uppercase tracking-widest text-amber-600 mb-1.5">Their concern</p>
            <p className="text-sm text-amber-900 leading-relaxed">{p.concern}</p>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
            <p className="text-2xs font-bold uppercase tracking-widest text-emerald-600 mb-1.5">What they'd do</p>
            <p className="text-sm text-emerald-900 leading-relaxed">{p.action}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RealWorldCasesPanel({ cases }: { cases: RealWorldCase[] }) {
  return (
    <div className="space-y-4">
      {cases.map((c, i) => (
        <div key={i} className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
          <div className="flex items-start gap-3 p-4 bg-zinc-50 border-b border-zinc-100">
            <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertCircle size={13} className="text-zinc-600"/>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">{c.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{c.context}</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-zinc-400 mb-1.5">What happened</p>
              <p className="text-sm text-zinc-700 leading-relaxed">{c.what}</p>
            </div>
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-2xs font-bold uppercase tracking-widest text-red-500 mb-1.5">Impact</p>
              <p className="text-sm text-red-900 leading-relaxed">{c.impact}</p>
            </div>
            <div className="p-3 bg-[#EEEEFF] border border-[#DDDDF8] rounded-lg">
              <p className="text-2xs font-bold uppercase tracking-widest text-[#5855D6] mb-1.5">The lesson</p>
              <p className="text-sm text-accent-900 leading-relaxed">{c.lesson}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

type AnalysisTab = 'concept'|'mechanism'|'perspectives'|'cases'|'misconceptions'|'changes'
const TABS: { id: AnalysisTab; label: string }[] = [
  {id:'concept',label:'Core concept'},{id:'mechanism',label:'How it works'},
  {id:'perspectives',label:'Perspectives'},{id:'cases',label:'Real cases'},
  {id:'misconceptions',label:'Myths'},{id:'changes',label:'Change this'},
]

export function DeepAnalysis({ exercise, onNext, onRepeat, relevantResources = [] }: {
  exercise: DeepExercise; onNext?: () => void; onRepeat: () => void; relevantResources?: Resource[]
}) {
  const [tab, setTab] = useState<AnalysisTab>('concept')
  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="bg-ink-900 px-6 py-6 text-white">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-signal-green flex items-center justify-center"><Check size={12} strokeWidth={3}/></div>
          <span className="text-xs font-bold text-signal-green uppercase tracking-widest">Exercise complete</span>
        </div>
        <h2 className="text-xl font-bold mb-1">{exercise.title}</h2>
        <p className="text-sm text-white/50">{exercise.concept} · Deep analysis</p>
      </div>
      <div className="border-b border-zinc-200 px-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-0.5 min-w-max py-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all',
                tab === t.id ? 'bg-ink-900 text-white' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 max-w-2xl">
        {tab === 'concept' && (
          <div className="space-y-5">
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-zinc-400 mb-3">The core concept</p>
              <p className="text-sm text-zinc-700 leading-relaxed">{exercise.coreConcept}</p>
            </div>
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-zinc-400 mb-3">What this means</p>
              <div className="space-y-2.5">
                {exercise.implications.map((imp,i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded bg-[#EEEEFF] text-[#5855D6] text-2xs font-bold flex items-center justify-center mt-0.5">{i+1}</span>
                    <p className="text-sm text-zinc-700 leading-relaxed">{imp}</p>
                  </div>
                ))}
              </div>
            </div>
            {relevantResources.length > 0 && (
              <div className="pt-5 border-t border-zinc-100">
                <p className="text-2xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Continue learning on AIhub</p>
                <div className="space-y-2">
                  {relevantResources.slice(0, 4).map(r => (
                    <Link key={r.id} to={`/content/${r.id}`}
                      className="flex items-start gap-3 p-3.5 bg-white border border-zinc-200 rounded-xl hover:border-indigo-200 hover:bg-indigo-50 transition-all group">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-800 group-hover:text-[#5855D6] transition-colors leading-snug">{r.title}</p>
                        <p className="text-2xs text-zinc-400 mt-1 capitalize">{r.type} · {r.difficulty}</p>
                      </div>
                      <ArrowRight size={13} className="text-zinc-300 group-hover:text-[#5855D6] flex-shrink-0 mt-0.5 transition-colors"/>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {tab === 'mechanism' && (
          <div>
            <p className="text-2xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Why this happens technically</p>
            <div className="p-4 bg-ink-950 rounded-xl">
              <p className="text-xs text-emerald-400 font-mono leading-relaxed whitespace-pre-wrap">{exercise.mechanism}</p>
            </div>
            <p className="text-xs text-zinc-400 mt-3">Understanding the mechanism — not just the effect — is what separates AI awareness from AI literacy.</p>
          </div>
        )}
        {tab === 'perspectives' && (
          <div>
            <p className="text-sm text-zinc-500 mb-4">This concept looks different depending on who you are. Read every perspective before forming a view.</p>
            <PerspectivesPanel perspectives={exercise.perspectives}/>
          </div>
        )}
        {tab === 'cases' && (
          <div>
            <p className="text-sm text-zinc-500 mb-4">Real, documented cases where this concept had tangible consequences.</p>
            <RealWorldCasesPanel cases={exercise.realWorldCases}/>
          </div>
        )}
        {tab === 'misconceptions' && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500 mb-4">The most common wrong beliefs about this concept.</p>
            {exercise.misconceptions.map((m,i) => (
              <div key={i} className="rounded-xl border border-zinc-200 overflow-hidden">
                <div className="flex items-start gap-3 p-4 bg-red-50 border-b border-red-100">
                  <span className="text-xs font-bold text-red-500 flex-shrink-0 mt-0.5">MYTH</span>
                  <p className="text-sm text-red-900 font-semibold">{m.myth}</p>
                </div>
                <div className="flex items-start gap-3 p-4 bg-emerald-50">
                  <span className="text-xs font-bold text-emerald-600 flex-shrink-0 mt-0.5">REALITY</span>
                  <p className="text-sm text-emerald-900 leading-relaxed">{m.reality}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'changes' && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500 mb-4">Understanding without behaviour change is academic.</p>
            {exercise.behaviourChanges.map((b,i) => (
              <div key={i} className="rounded-xl border border-zinc-200 overflow-hidden">
                <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                  <p className="text-xs font-semibold text-zinc-700">{b.situation}</p>
                </div>
                <div className="p-4 grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xs font-bold text-signal-red uppercase tracking-widest mb-2">Before</p>
                    <p className="text-sm text-zinc-600 leading-relaxed">{b.oldBehaviour}</p>
                  </div>
                  <div>
                    <p className="text-2xs font-bold text-signal-green uppercase tracking-widest mb-2">After</p>
                    <p className="text-sm text-zinc-800 font-medium leading-relaxed">{b.newBehaviour}</p>
                  </div>
                </div>
              </div>
            ))}
            {exercise.furtherReading.length > 0 && (
              <div className="mt-6">
                <p className="text-2xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Go deeper</p>
                <div className="space-y-2">
                  {exercise.furtherReading.map((r,i) => (
                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 hover:bg-zinc-50 transition-all group">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-800 group-hover:text-[#5855D6] transition-colors">{r.title}</p>
                        <p className="text-2xs text-zinc-400 mt-0.5">{r.source}</p>
                      </div>
                      <ArrowUpRight size={13} className="text-zinc-400 flex-shrink-0"/>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-white border-t border-zinc-200 px-5 py-3 flex items-center gap-3">
        <button onClick={onRepeat} className="px-4 py-2 text-xs font-semibold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors">
          Repeat exercise
        </button>
        {onNext && (
          <button onClick={onNext} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-ink-900 text-white rounded-lg hover:bg-ink-800 transition-colors ml-auto">
            Next exercise <ArrowRight size={13}/>
          </button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// RESOURCE ASSISTANT — inline AI tutor
// ══════════════════════════════════════════════════════════════════════════════

export function ResourceAssistant({ resource, onClose }: { resource: Resource; onClose?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  const systemPrompt = `You are an expert AI literacy tutor helping a student understand this specific resource:
Title: "${resource.title}"
Type: ${resource.type} | Topics: ${resource.topics.join(', ')}
Description: ${resource.description}
${resource.cbseUnit ? `CBSE: ${resource.cbseUnit}` : ''}
${resource.igcseSection ? `IGCSE: ${resource.igcseSection}` : ''}
Rules: Be concise (max 150 words). Ask probing questions. Connect to what they know. If off-topic, redirect.`

  // Generate resource-specific starters from the resource's topics and type
  const STARTERS = useMemo(() => {
    const topicList = resource.topics?.slice(0, 2).join(' and ') || 'this topic'
    const base = [
      `What is the most important concept in this ${resource.type}?`,
      `Why does ${topicList} matter in real-world AI?`,
      `What do most people get wrong about ${topicList}?`,
      `How does this connect to what I might already know about AI?`,
      `Quiz me on the key ideas from this ${resource.type}.`,
    ]
    // Prepend a topic-specific opener if we have topic data
    if (resource.topics?.length) {
      base.unshift(`Explain "${resource.topics[0]}" as if I'm completely new to it.`)
    }
    return base.slice(0, 5)
  }, [resource])

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    setError(null); setInput('')
    const userMsg: Message = { role:'user', content:text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const data = await api.chat.send([...messages, userMsg], systemPrompt)
      setMessages(prev => [...prev, { role:'assistant', content:data.text }])
    } catch(e) { setError(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col w-80 xl:w-96 flex-shrink-0 border-l border-zinc-100 bg-white">
      <div className="flex-shrink-0 flex items-center gap-2 px-3.5 py-3 border-b border-zinc-100 bg-ink-900">
        <Zap size={13} className="text-accent-300 flex-shrink-0"/>
        <span className="text-xs font-bold text-white flex-1">AI Tutor</span>
        {onClose && (
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <X size={12}/>
          </button>
        )}
      </div>
      <div className="flex-shrink-0 px-3.5 py-2.5 bg-zinc-50 border-b border-zinc-100">
        <p className="text-2xs font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Tutoring on</p>
        <p className="text-xs font-semibold text-zinc-800 line-clamp-1">{resource.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <Badge variant={resource.type as any} size="xs"/>
          <Badge variant={resource.difficulty as any} size="xs"/>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-2xs font-semibold text-zinc-400 uppercase tracking-widest">Start here</p>
            {STARTERS.map(s => (
              <button key={s} onClick={() => send(s)}
                className="w-full text-left text-xs text-zinc-600 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg px-3 py-2 transition-colors leading-snug font-medium">
                {s}
              </button>
            ))}
          </div>
        ) : messages.map((msg,i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed',
              msg.role === 'user'
                ? 'bg-ink-900 text-white rounded-br-sm font-medium'
                : 'bg-[#EEEEFF] border border-[#DDDDF8] text-zinc-800 rounded-bl-sm')}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-[#EEEEFF] border border-[#DDDDF8] rounded-xl rounded-bl-sm px-3 py-2"><TypingDots/></div></div>}
        {error && <p className="text-2xs text-signal-red">{error}</p>}
        <div ref={bottomRef}/>
      </div>
      <div className="flex-shrink-0 border-t border-zinc-100 px-3.5 py-2.5 bg-white">
        <div className="flex items-center gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Ask about this resource…"
            className="flex-1 text-xs px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-transparent placeholder:text-zinc-400 font-medium"/>
          <button onClick={() => send(input)} disabled={!input.trim()||loading}
            className="w-8 h-8 rounded-lg bg-ink-900 text-white flex items-center justify-center hover:bg-ink-800 disabled:opacity-30 transition-colors flex-shrink-0">
            <Send size={12}/>
          </button>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="mt-1.5 text-2xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1">
            <RotateCcw size={9}/> Clear
          </button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING — 3-step OS setup flow
// ══════════════════════════════════════════════════════════════════════════════

const ROLES = [
  { id:'teacher' as OnboardRole, icon:<GraduationCap size={24}/>, label:'Educator',
    sub:'I teach AI, CS, or want to integrate AI into my classroom',
    color:'from-amber-500 to-orange-500',
    goals:['Understand what CBSE/IGCSE/IB AI curriculum requires','Use AI tools effectively in lesson planning','Design assessments that work alongside AI','Find structured classroom activities','Help students think critically about AI'] },
  { id:'student' as OnboardRole, icon:<BookOpen size={24}/>, label:'Student',
    sub:'I am studying AI as part of my curriculum or want to go deeper',
    color:'from-accent-500 to-blue-500',
    goals:['Prepare for CBSE Code 417 or IGCSE Topic 6 exams','Understand how AI works, not just memorise it','Use AI tools without being misled','Build genuine AI literacy','Go deeper than my textbook'] },
  { id:'curious' as OnboardRole, icon:<Sparkles size={24}/>, label:'Researcher',
    sub:'I want to think, analyse, and use AI like the top 1%',
    color:'from-violet-500 to-purple-500',
    goals:['Understand what AI can and cannot actually do','Learn to fact-check and verify AI outputs','Understand AI ethics and real-world implications','Use AI tools without being manipulated','Think critically about technology and society'] },
]

const BOARDS = ['CBSE','IGCSE','IB','RBSE / State Board','Not applicable']


// ══════════════════════════════════════════════════════════════════════════════
// SPOTLIGHT TOUR
// ══════════════════════════════════════════════════════════════════════════════

const TOUR_STEPS = [
  {
    id: 'dashboard',
    targetSelector: '[data-tour="dashboard"]',
    title: 'Your Dashboard',
    body: 'Everything about your learning journey lives here — progress, paths, quick access to every tool.',
    emoji: '🏠',
    position: 'right' as const,
  },
  {
    id: 'browse',
    targetSelector: '[data-tour="browse"]',
    title: 'Browse Resources',
    body: 'Curated videos, books, courses, and seminars — all tagged by board, difficulty, and topic. Filter by your curriculum.',
    emoji: '🔍',
    position: 'right' as const,
  },
  {
    id: 'curriculum',
    targetSelector: '[data-tour="curriculum"]',
    title: 'Curriculum Hub',
    body: 'Learning paths aligned to CBSE Code 417, IGCSE, IB, and RBSE. Pick your board, follow the path.',
    emoji: '📚',
    position: 'right' as const,
  },
  {
    id: 'playground',
    targetSelector: '[data-tour="playground"]',
    title: 'AI Playground',
    body: 'Hands-on experiments where you actually interact with AI models and observe their behaviour.',
    emoji: '🧪',
    position: 'right' as const,
  },
  {
    id: 'workflows',
    targetSelector: '[data-tour="workflows"]',
    title: 'Workflows',
    body: 'Step-by-step walkthroughs for AI tools — how to use them effectively for learning, teaching, and research.',
    emoji: '⚡',
    position: 'right' as const,
  },
  {
    id: 'activities',
    targetSelector: '[data-tour="activities"]',
    title: 'Activities',
    body: 'Structured classroom and group exercises. Designed for teachers, useful for solo learners too.',
    emoji: '👥',
    position: 'right' as const,
  },
]

export function SpotlightTour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [visible, setVisible] = useState(false)

  const current = TOUR_STEPS[step]

  useEffect(() => {
    // Small delay on first render for layout to settle
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const el = document.querySelector(current.targetSelector) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      const r = el.getBoundingClientRect()
      setRect(r)
      el.classList.add('tour-highlight')
      return () => el.classList.remove('tour-highlight')
    }
    setRect(null)
  }, [step, current.targetSelector])

  const next = () => {
    if (step < TOUR_STEPS.length - 1) setStep(s => s + 1)
    else finish()
  }
  const finish = () => { setVisible(false); setTimeout(onDone, 300) }

  // Compute tooltip position
  const tooltipStyle: React.CSSProperties = {}
  if (rect) {
    const PAD = 16
    tooltipStyle.top = Math.max(PAD, rect.top + rect.height / 2 - 100)
    tooltipStyle.left = rect.right + PAD
    // Flip left if off screen
    if (rect.right + 316 > window.innerWidth) {
      tooltipStyle.left = rect.left - 316 - PAD
    }
  } else {
    // Fallback: centred
    tooltipStyle.top = '50%'
    tooltipStyle.left = '50%'
    tooltipStyle.transform = 'translate(-50%,-50%)'
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[9990] animate-fade-in">
      {/* Dim overlay (click to skip) */}
      <div className="tour-spotlight-overlay active" onClick={finish}/>

      {/* Tooltip */}
      <div className="tour-tooltip" style={tooltipStyle} onClick={e => e.stopPropagation()}>
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-3">
          {TOUR_STEPS.map((_, i) => (
            <div key={i} className={cn('h-1 rounded-full transition-all duration-300', i === step ? 'bg-[#5855D6] w-5' : i < step ? 'bg-accent-200 w-1.5' : 'bg-zinc-200 w-1.5')}/>
          ))}
          <button onClick={finish} className="ml-auto p-1 rounded-md text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
            <X size={12}/>
          </button>
        </div>

        {/* Content */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{current.emoji}</span>
            <h3 className="text-base font-bold text-zinc-900">{current.title}</h3>
          </div>
          <p className="text-sm text-zinc-500 leading-relaxed">{current.body}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-400">{step + 1} of {TOUR_STEPS.length}</span>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800 rounded-lg hover:bg-zinc-50 transition-colors">
                ← Back
              </button>
            )}
            <button onClick={next}
              className="px-4 py-1.5 bg-[#5855D6] text-white text-xs font-bold rounded-lg hover:bg-[#4744C8] transition-colors flex items-center gap-1.5">
              {step === TOUR_STEPS.length - 1 ? 'Done 🎉' : 'Next'} {step < TOUR_STEPS.length - 1 && <ArrowRight size={11}/>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OnboardingFlow({ onComplete }: { onComplete: (p: OnboardingProfile) => void }) {
  // Pre-fill role from signup selection — avoids asking twice
  const signupRole = ((): OnboardRole | null => {
    try {
      const v = localStorage.getItem('aihub_signup_role')
      return (v === 'teacher' || v === 'student' || v === 'curious') ? v : null
    } catch { return null }
  })()

  const [step, setStep] = useState<'role'|'board'|'goals'>(signupRole ? 'board' : 'role')
  const [role, setRole] = useState<OnboardRole|null>(signupRole)
  const [board, setBoard] = useState('')
  const [goals, setGoals] = useState<string[]>([])
  const [anim, setAnim] = useState(false)
  const roleData = ROLES.find(r => r.id === role)

  const go = useCallback((to: typeof step) => {
    setAnim(true); setTimeout(() => { setStep(to); setAnim(false) }, 200)
  }, [])

  const { user } = useAuth()

  const done = useCallback(async () => {
    if (!role) return
    const p: OnboardingProfile = { role, board:board||undefined, goals, completed:true, completedAt:new Date().toISOString() }
    saveOnboardingProfile(p)
    // Persist role to Supabase profiles so dashboard branching works server-side
    if (user) {
      try {
        await supabase.from('profiles').update({ role }).eq('id', user.id)
      } catch { /* localStorage fallback still works */ }
    }
    // Award onboarding badge
    const onboardBadges = checkAndAward({ progressMap: {}, pathsCompleted: 0, onboarded: true })
    if (onboardBadges.length) window.dispatchEvent(new CustomEvent('aihub:badges', { detail: onboardBadges }))
    onComplete(p)
  }, [role, board, goals, onComplete, user])

  return (
    <div className={cn('transition-opacity duration-200', anim ? 'opacity-0' : 'opacity-100')}>
      {step === 'role' && (
        <div>
          <div className="flex items-center gap-1.5 mb-5">
            {[1,2,3].map(i => (
              <div key={i} className={cn('h-1.5 rounded-full transition-all duration-300', i === 1 ? 'bg-[#5855D6] flex-1' : 'bg-zinc-100 w-6')}/>
            ))}
          </div>
          <h2 className="text-2xl font-extrabold text-zinc-900 mb-1.5 tracking-tight">Who are you?</h2>
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">This shapes your entire experience. You can change it any time.</p>
          <div className="space-y-2.5 mb-7">
            {ROLES.map(r => (
              <button key={r.id} onClick={() => setRole(r.id)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-150',
                  role === r.id
                    ? 'border-accent-500 bg-gradient-to-r from-accent-600 to-violet-600 shadow-lg'
                    : 'border-zinc-200 bg-white hover:border-[#C0BFEF] hover:shadow-card'
                )}>
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
                  role === r.id ? 'bg-white/20 text-white' : `bg-gradient-to-br ${r.color} text-white`
                )}>
                  {r.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-base font-bold mb-0.5 leading-snug', role === r.id ? 'text-white' : 'text-zinc-900')}>
                    {r.label}
                  </p>
                  <p className={cn('text-xs leading-relaxed', role === r.id ? 'text-white/65' : 'text-zinc-500')}>
                    {r.sub}
                  </p>
                </div>
                <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                  role === r.id ? 'border-white bg-white/20' : 'border-zinc-300')}>
                  {role === r.id && <Check size={11} className="text-white" strokeWidth={3}/>}
                </div>
              </button>
            ))}
          </div>
          <button disabled={!role} onClick={() => go(role === 'teacher' || role === 'student' ? 'board' : 'goals')}
            className={cn('w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
              role
                ? 'bg-gradient-to-r from-accent-600 to-violet-600 text-white hover:from-accent-700 hover:to-violet-700 shadow-sm'
                : 'bg-zinc-100 text-zinc-300 cursor-not-allowed')}>
            Continue <ArrowRight size={15}/>
          </button>
        </div>
      )}
      {step === 'board' && roleData && (
        <div>
          <button onClick={() => go('role')} className="text-xs font-semibold text-zinc-400 hover:text-zinc-700 mb-5 flex items-center gap-1">← Back</button>
          <p className="text-2xs font-bold uppercase tracking-widest text-zinc-400 mb-1">Step 2 of 3</p>
          <h2 className="text-2xl font-bold text-zinc-900 mb-1 tracking-tight">Your curriculum?</h2>
          <p className="text-sm text-zinc-500 mb-7">We map resources and paths to your exact board.</p>
          <div className="space-y-2 mb-7">
            {BOARDS.map(b => (
              <button key={b} onClick={() => setBoard(b)}
                className={cn('w-full flex items-center justify-between px-5 py-4 rounded-xl border-2 text-left transition-all',
                  board === b ? 'border-ink-900 bg-ink-900 text-white' : 'border-zinc-200 bg-white hover:border-ink-400 text-zinc-700')}>
                <span className="text-sm font-semibold">{b}</span>
                {board === b && <Check size={15}/>}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => go('goals')} className="px-4 py-3.5 text-sm text-zinc-500 hover:text-zinc-700 font-semibold">Skip</button>
            <button disabled={!board} onClick={() => go('goals')}
              className={cn('flex-1 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all',
                board ? 'bg-ink-900 text-white hover:bg-ink-800' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed')}>
              Continue <ArrowRight size={15}/>
            </button>
          </div>
        </div>
      )}
      {step === 'goals' && roleData && (
        <div>
          <button onClick={() => go(role === 'curious' ? 'role' : 'board')} className="text-xs font-semibold text-zinc-400 hover:text-zinc-700 mb-5 flex items-center gap-1">← Back</button>
          <p className="text-2xs font-bold uppercase tracking-widest text-zinc-400 mb-1">Step 3 of 3</p>
          <h2 className="text-2xl font-bold text-zinc-900 mb-1 tracking-tight">What's your focus?</h2>
          <p className="text-sm text-zinc-500 mb-7">Pick as many as you want. We'll start you there.</p>
          <div className="space-y-2 mb-7">
            {roleData.goals.map(g => {
              const sel = goals.includes(g)
              return (
                <button key={g} onClick={() => setGoals(p => sel ? p.filter(x => x !== g) : [...p, g])}
                  className={cn('w-full flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 text-left transition-all',
                    sel ? 'border-ink-900 bg-zinc-50' : 'border-zinc-200 bg-white hover:border-ink-400')}>
                  <div className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
                    sel ? 'border-ink-900 bg-ink-900' : 'border-zinc-300')}>
                    {sel && <Check size={12} className="text-white" strokeWidth={3}/>}
                  </div>
                  <span className={cn('text-sm', sel ? 'font-semibold text-zinc-900' : 'text-zinc-700')}>{g}</span>
                </button>
              )
            })}
          </div>
          <div className="flex gap-3">
            <button onClick={done} className="px-4 py-3.5 text-sm text-zinc-500 hover:text-zinc-700 font-semibold">Skip</button>
            <button onClick={done} className="flex-1 py-3.5 bg-ink-900 text-white rounded-xl text-sm font-bold hover:bg-ink-800 flex items-center justify-center gap-2 transition-all">
              {goals.length > 0 ? 'Launch my OS' : 'Continue'} <ArrowRight size={15}/>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function OnboardingModal() {
  const [show, setShow]       = useState(false)
  const [showTour, setShowTour] = useState(false)

  useEffect(() => { if (!getOnboardingProfile()?.completed) setShow(true) }, [])

  const handleComplete = () => {
    setShow(false)
    // Wait for navigation render + data fetch: use requestIdleCallback when available,
    // otherwise a 1.5s timeout (enough for a P75 cold load on 4G)
    const fire = () => setShowTour(true)
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      // @ts-ignore
      window.requestIdleCallback(fire, { timeout: 3000 })
    } else {
      setTimeout(fire, 1500)
    }
  }

  return (
    <>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(9,11,17,0.65)', backdropFilter: 'blur(8px)' }}>
          <div className="relative bg-white rounded-3xl shadow-modal w-full max-w-md overflow-hidden animate-scale-in">

            {/* Decorative header strip */}
            <div className="relative h-2 overflow-hidden">
              <div className="absolute inset-0" style={{ background: '#0A0A0B' }}/>
            </div>

            <div className="p-7">
              {/* Wordmark */}
              <div className="flex items-center gap-3 mb-6">
                <svg width="36" height="36" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                  <rect width="28" height="28" rx="8" fill="#0F172A"/>
                  <path d="M8 20L11.5 10H13L16.5 20H15L14.1 17.5H10.4L9.5 20H8ZM10.8 16.4H13.7L12.25 12.2L10.8 16.4Z" fill="white"/>
                  <path d="M17.5 10H19V20H17.5V10Z" fill="#6366F1"/>
                </svg>
                <div>
                  <p className="text-base font-extrabold text-zinc-900 tracking-tight leading-none">
                    AI<span className="text-[#5855D6]">hub</span> <span className="text-zinc-300 text-xs font-bold tracking-widest uppercase">OS</span>
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">Personalise your experience in 60 seconds</p>
                </div>
              </div>

              <OnboardingFlow onComplete={handleComplete}/>
            </div>
          </div>
        </div>
      )}

      {showTour && <SpotlightTour onDone={() => setShowTour(false)}/>}
    </>
  )
}
