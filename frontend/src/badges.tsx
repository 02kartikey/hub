/**
 * badges.tsx — AIhub OS collectible badge system
 *
 * Badges are earned, not given. Each one has a visual identity,
 * a rarity tier, and a specific unlock condition.
 * The system is purely client-side (localStorage) with optional
 * Supabase persistence when the user is signed in.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { cn } from './ui'

// ── Badge definitions ─────────────────────────────────────────────────────────

export type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'secret'

export interface BadgeDef {
  id:          string
  name:        string
  description: string
  flavour:     string          // lore / personality line
  rarity:      BadgeRarity
  icon:        React.ReactNode // SVG element
  condition:   string          // human-readable unlock hint
  hidden?:     boolean         // shows as ??? until unlocked
}

// ── SVG badge art ─────────────────────────────────────────────────────────────
// Each badge is a unique SVG composition — no two look the same.

const SvgBadge = {
  spark: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="url(#spark_bg)"/>
      <path d="M44 16L32 40H42L36 64L56 36H44L44 16Z" fill="white" opacity="0.95"/>
      <defs>
        <radialGradient id="spark_bg" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#F59E0B"/>
          <stop offset="100%" stopColor="#D97706"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  firstLight: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="url(#fl_bg)"/>
      <circle cx="40" cy="38" r="14" fill="none" stroke="white" strokeWidth="2.5" opacity="0.9"/>
      {[0,60,120,180,240,300].map((a,i) => (
        <line key={i}
          x1={40 + 20*Math.cos(a*Math.PI/180)}
          y1={38 + 20*Math.sin(a*Math.PI/180)}
          x2={40 + 27*Math.cos(a*Math.PI/180)}
          y2={38 + 27*Math.sin(a*Math.PI/180)}
          stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
      ))}
      <circle cx="40" cy="38" r="7" fill="white" opacity="0.95"/>
      <defs>
        <radialGradient id="fl_bg" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FCD34D"/>
          <stop offset="100%" stopColor="#F59E0B"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  curious: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="url(#cur_bg)"/>
      <text x="40" y="50" textAnchor="middle" fontSize="30" fill="white" opacity="0.95">?</text>
      <circle cx="56" cy="26" r="8" fill="white" opacity="0.2"/>
      <circle cx="56" cy="26" r="5" fill="white" opacity="0.6"/>
      <defs>
        <radialGradient id="cur_bg" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#8B5CF6"/>
          <stop offset="100%" stopColor="#6D28D9"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  scholar: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="url(#sch_bg)"/>
      <path d="M24 46L40 38L56 46V52C56 52 48 57 40 57C32 57 24 52 24 52V46Z" fill="white" opacity="0.9"/>
      <path d="M14 38L40 25L66 38L40 51L14 38Z" fill="white" opacity="0.6"/>
      <path d="M60 40V52" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
      <circle cx="60" cy="54" r="3" fill="white" opacity="0.7"/>
      <defs>
        <linearGradient id="sch_bg" x1="0" y1="0" x2="80" y2="80">
          <stop offset="0%" stopColor="#10B981"/>
          <stop offset="100%" stopColor="#059669"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  quizWizard: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="url(#qw_bg)"/>
      <path d="M28 28H52V48L46 52H28V28Z" fill="white" opacity="0.15"/>
      <path d="M28 28H52V48L46 52H28V28Z" stroke="white" strokeWidth="2" opacity="0.8"/>
      <path d="M34 37H46M34 43H42" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
      <path d="M34 31H40" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <circle cx="52" cy="54" r="9" fill="#FCD34D"/>
      <path d="M49 54L51.5 56.5L56 51" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <defs>
        <linearGradient id="qw_bg" x1="0" y1="0" x2="80" y2="80">
          <stop offset="0%" stopColor="#3B82F6"/>
          <stop offset="100%" stopColor="#1D4ED8"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  trailblazer: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="url(#tb_bg)"/>
      <path d="M20 55L32 35L42 45L52 28L60 38" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
      {[[32,35],[42,45],[52,28]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="3.5" fill="white" opacity="0.8"/>)}
      <circle cx="60" cy="38" r="5" fill="white" opacity="0.95"/>
      <defs>
        <linearGradient id="tb_bg" x1="0" y1="0" x2="80" y2="80">
          <stop offset="0%" stopColor="#F97316"/>
          <stop offset="100%" stopColor="#DC2626"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  deepDiver: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="url(#dd_bg)"/>
      <path d="M40 16V64" stroke="white" strokeWidth="2" opacity="0.3"/>
      <path d="M24 26H56" stroke="white" strokeWidth="2" opacity="0.2"/>
      <path d="M28 40H52" stroke="white" strokeWidth="2" opacity="0.4"/>
      <path d="M32 54H48" stroke="white" strokeWidth="2" opacity="0.6"/>
      <circle cx="40" cy="40" r="10" fill="none" stroke="white" strokeWidth="2.5" opacity="0.9"/>
      <path d="M36 40L44 40M40 36V44" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
      <defs>
        <radialGradient id="dd_bg" cx="50%" cy="80%" r="80%">
          <stop offset="0%" stopColor="#0EA5E9"/>
          <stop offset="100%" stopColor="#0C4A6E"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  consistent: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="url(#con_bg)"/>
      {[0,1,2,3,4].map(i => (
        <rect key={i} x={18 + i*10} y={58 - (i===0?12:i===1?18:i===2?28:i===3?22:32)}
          width="7" height={i===0?12:i===1?18:i===2?28:i===3?22:32}
          rx="2" fill="white" opacity={0.5 + i*0.1}/>
      ))}
      <defs>
        <linearGradient id="con_bg" x1="0" y1="80" x2="80" y2="0">
          <stop offset="0%" stopColor="#6366F1"/>
          <stop offset="100%" stopColor="#8B5CF6"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  pathMaster: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="url(#pm_bg)"/>
      <path d="M40 18L46.5 31.3L62 33.6L51 44.3L53.5 59.8L40 52.8L26.5 59.8L29 44.3L18 33.6L33.5 31.3L40 18Z"
        fill="white" opacity="0.95"/>
      <defs>
        <radialGradient id="pm_bg" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#F472B6"/>
          <stop offset="100%" stopColor="#BE185D"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  nightOwl: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="url(#no_bg)"/>
      <path d="M52 38C52 48.5 43.5 57 33 57C29.2 57 25.7 55.8 22.8 53.7C26.3 55.7 30.3 57 34.5 57C46.4 57 56 47.4 56 35.5C56 29.5 53.3 24.1 49 20.5C51.2 25.4 52 31.5 52 38Z" fill="white" opacity="0.9"/>
      <circle cx="50" cy="22" r="3" fill="white" opacity="0.6"/>
      <circle cx="58" cy="30" r="2" fill="white" opacity="0.4"/>
      <circle cx="55" cy="16" r="1.5" fill="white" opacity="0.5"/>
      <defs>
        <radialGradient id="no_bg" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#312E81"/>
          <stop offset="100%" stopColor="#0F172A"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  legend: (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="36" fill="url(#leg_bg)"/>
      <circle cx="40" cy="40" r="28" fill="none" stroke="url(#leg_ring)" strokeWidth="1.5" opacity="0.5"/>
      <path d="M40 16L46.5 31.3L62 33.6L51 44.3L53.5 59.8L40 52.8L26.5 59.8L29 44.3L18 33.6L33.5 31.3L40 16Z"
        fill="none" stroke="white" strokeWidth="1.5" opacity="0.6"/>
      <path d="M40 22L44.9 33.5L57.5 35.3L48.75 43.8L50.8 56.5L40 50.8L29.2 56.5L31.25 43.8L22.5 35.3L35.1 33.5L40 22Z"
        fill="white" opacity="0.95"/>
      <defs>
        <radialGradient id="leg_bg" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FCD34D"/>
          <stop offset="40%" stopColor="#F59E0B"/>
          <stop offset="100%" stopColor="#B45309"/>
        </radialGradient>
        <linearGradient id="leg_ring">
          <stop stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
      </defs>
    </svg>
  ),
}

// ── Badge catalogue ───────────────────────────────────────────────────────────

export const BADGES: BadgeDef[] = [
  {
    id: 'spark',
    name: 'The Spark',
    description: 'Completed your first resource',
    flavour: '"Every wildfire starts with a single spark."',
    rarity: 'common',
    icon: SvgBadge.spark,
    condition: 'Complete any resource',
  },
  {
    id: 'first_light',
    name: 'First Light',
    description: 'Opened the app for the first time',
    flavour: '"Before knowledge comes curiosity."',
    rarity: 'common',
    icon: SvgBadge.firstLight,
    condition: 'Just show up',
  },
  {
    id: 'curious',
    name: 'Curious Mind',
    description: 'Completed your onboarding',
    flavour: '"Asking why is the start of everything."',
    rarity: 'common',
    icon: SvgBadge.curious,
    condition: 'Finish the onboarding flow',
  },
  {
    id: 'scholar',
    name: 'Scholar',
    description: 'Completed 5 resources',
    flavour: '"Not quantity. Depth."',
    rarity: 'uncommon',
    icon: SvgBadge.scholar,
    condition: 'Complete 5 resources',
  },
  {
    id: 'quiz_wizard',
    name: 'Quiz Wizard',
    description: 'Passed your first assessment',
    flavour: '"Knowledge tested is knowledge retained."',
    rarity: 'uncommon',
    icon: SvgBadge.quizWizard,
    condition: 'Pass any quiz',
  },
  {
    id: 'trailblazer',
    name: 'Trailblazer',
    description: 'Completed a full learning path',
    flavour: '"You didn\'t follow the path. You became it."',
    rarity: 'rare',
    icon: SvgBadge.trailblazer,
    condition: 'Complete any learning path 100%',
  },
  {
    id: 'deep_diver',
    name: 'Deep Diver',
    description: 'Completed a Playground exercise',
    flavour: '"Most people skim. You dove."',
    rarity: 'uncommon',
    icon: SvgBadge.deepDiver,
    condition: 'Complete any Playground exercise',
  },
  {
    id: 'consistent',
    name: 'On a Roll',
    description: 'Completed 10 resources',
    flavour: '"Consistency is the rarest form of talent."',
    rarity: 'rare',
    icon: SvgBadge.consistent,
    condition: 'Complete 10 resources',
  },
  {
    id: 'path_master',
    name: 'Path Master',
    description: 'Completed 3 learning paths',
    flavour: '"You see the map others can\'t read."',
    rarity: 'legendary',
    icon: SvgBadge.pathMaster,
    condition: 'Complete 3 learning paths',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Learned after 10pm',
    flavour: '"The serious students find you between 10pm and 2am."',
    rarity: 'secret',
    icon: SvgBadge.nightOwl,
    condition: 'Complete a resource after 10pm',
    hidden: true,
  },
  {
    id: 'legend',
    name: 'The Legend',
    description: 'Completed every learning path',
    flavour: '"There are no more worlds to conquer."',
    rarity: 'legendary',
    icon: SvgBadge.legend,
    condition: 'Complete all learning paths',
  },
]

// ── Badge engine ──────────────────────────────────────────────────────────────

const BADGE_KEY = 'aihub_badges'

export function getEarnedBadges(): string[] {
  try { return JSON.parse(localStorage.getItem(BADGE_KEY) ?? '[]') } catch { return [] }
}

export function awardBadge(id: string): boolean {
  const earned = getEarnedBadges()
  if (earned.includes(id)) return false
  try { localStorage.setItem(BADGE_KEY, JSON.stringify([...earned, id])) } catch {}
  return true // true = newly awarded (show toast)
}

export function checkAndAward(context: {
  progressMap: Record<string, number>
  pathsCompleted: number
  quizPassed?: boolean
  playgroundDone?: boolean
  onboarded?: boolean
}): BadgeDef[] {
  const newBadges: BadgeDef[] = []
  const award = (id: string) => {
    if (awardBadge(id)) {
      const def = BADGES.find(b => b.id === id)
      if (def) newBadges.push(def)
    }
  }

  const completed = Object.values(context.progressMap).filter(v => v === 100).length
  const hour = new Date().getHours()

  if (context.onboarded)            award('curious')
  if (completed >= 1)               award('spark')
  if (completed >= 5)               award('scholar')
  if (completed >= 10)              award('consistent')
  if (context.pathsCompleted >= 1)  award('trailblazer')
  if (context.pathsCompleted >= 3)  award('path_master')
  if (context.quizPassed)           award('quiz_wizard')
  if (context.playgroundDone)       award('deep_diver')
  if ((hour >= 22 || hour < 4) && completed >= 1) award('night_owl')

  return newBadges
}

// ── Rarity config ─────────────────────────────────────────────────────────────

const RARITY_CONFIG: Record<BadgeRarity, {
  label: string; bg: string; border: string; text: string; glow: string; ring: string
}> = {
  common:    { label:'Common',    bg:'bg-zinc-100',     border:'border-zinc-200',     text:'text-ink-500',      glow:'',                              ring:'ring-ink-200'   },
  uncommon:  { label:'Uncommon',  bg:'bg-emerald-50',  border:'border-emerald-200', text:'text-emerald-600',  glow:'shadow-[0_0_20px_rgba(16,185,129,0.25)]', ring:'ring-emerald-300' },
  rare:      { label:'Rare',      bg:'bg-blue-50',     border:'border-blue-200',    text:'text-blue-600',     glow:'shadow-[0_0_24px_rgba(59,130,246,0.3)]',  ring:'ring-blue-300'  },
  legendary: { label:'Legendary', bg:'bg-amber-50',    border:'border-amber-200',   text:'text-amber-600',    glow:'shadow-[0_0_32px_rgba(245,158,11,0.4)]',  ring:'ring-amber-300' },
  secret:    { label:'Secret',    bg:'bg-violet-50',   border:'border-violet-200',  text:'text-violet-600',   glow:'shadow-[0_0_28px_rgba(139,92,246,0.35)]', ring:'ring-violet-300'},
}

// ── BadgeCard ─────────────────────────────────────────────────────────────────

export function BadgeCard({ badge, earned, size = 'md' }: {
  badge: BadgeDef; earned: boolean; size?: 'sm' | 'md' | 'lg'
}) {
  const r = RARITY_CONFIG[badge.rarity]
  const [hovered, setHovered] = useState(false)

  const sizeMap = {
    sm: { outer: 'p-3',    icon: 'w-12 h-12', name: 'text-xs', meta: 'text-2xs' },
    md: { outer: 'p-4',    icon: 'w-16 h-16', name: 'text-sm', meta: 'text-xs'  },
    lg: { outer: 'p-5',    icon: 'w-20 h-20', name: 'text-base', meta: 'text-sm'},
  }
  const s = sizeMap[size]

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative flex flex-col items-center text-center rounded-2xl border transition-all duration-300',
        s.outer,
        earned
          ? cn(r.bg, r.border, r.glow, hovered ? 'scale-105 -translate-y-0.5' : '')
          : 'bg-ink-50 border-zinc-200 opacity-50 grayscale'
      )}>
      {/* Rarity pip */}
      {earned && (
        <span className={cn('absolute top-2.5 right-2.5 text-2xs font-bold px-1.5 py-0.5 rounded-md', r.text, r.bg, r.border, 'border')}>
          {r.label}
        </span>
      )}

      {/* Icon */}
      <div className={cn('mb-3 flex-shrink-0', s.icon, !earned && 'opacity-40')}>
        {earned && !badge.hidden ? badge.icon : (
          badge.hidden && !earned
            ? <svg viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="36" fill="#E2E8F0"/><text x="40" y="50" textAnchor="middle" fontSize="28" fill="#94A3B8">?</text></svg>
            : badge.icon
        )}
      </div>

      <h3 className={cn('font-extrabold text-ink-900 mb-0.5 leading-snug', s.name)}>
        {badge.hidden && !earned ? '???' : badge.name}
      </h3>
      {earned ? (
        <p className={cn('text-ink-500 leading-snug', s.meta)}>
          {badge.description}
        </p>
      ) : (
        <p className={cn('text-ink-400 leading-snug', s.meta)}>
          {badge.hidden ? 'Secret badge' : badge.condition}
        </p>
      )}
    </div>
  )
}

// ── Badge toast ───────────────────────────────────────────────────────────────
// Fires on screen bottom-right, auto-dismisses after 5s

export function BadgeToast({ badge, onDone }: { badge: BadgeDef; onDone: () => void }) {
  const r = RARITY_CONFIG[badge.rarity]
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true),  80)
    const t2 = setTimeout(() => { setLeaving(true); setTimeout(onDone, 400) }, 5000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-[9998] flex items-center gap-4 px-5 py-4 rounded-2xl border shadow-modal max-w-xs transition-all duration-400',
      r.bg, r.border, r.glow,
      visible && !leaving ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
    )}>
      {/* Badge icon */}
      <div className="w-14 h-14 flex-shrink-0 animate-float">
        {badge.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-2xs font-black uppercase tracking-widest mb-1', r.text)}>
          Badge unlocked · {r.label}
        </p>
        <p className="text-sm font-extrabold text-ink-900 leading-tight mb-0.5">{badge.name}</p>
        <p className="text-xs text-ink-500 leading-snug">{badge.description}</p>
      </div>
      <button onClick={() => { setLeaving(true); setTimeout(onDone, 300) }}
        className="absolute top-2.5 right-2.5 w-5 h-5 flex items-center justify-center text-ink-300 hover:text-ink-600 transition-colors text-xs">
        ×
      </button>
    </div>
  )
}

// ── Badge queue manager ───────────────────────────────────────────────────────
// Renders one toast at a time from a queue

export function BadgeNotificationManager({ queue, onClear }: {
  queue: BadgeDef[]; onClear: (id: string) => void
}) {
  if (!queue.length) return null
  const current = queue[0]
  return <BadgeToast key={current.id} badge={current} onDone={() => onClear(current.id)}/>
}

// ── useBadges hook ────────────────────────────────────────────────────────────

export function useBadges() {
  const [earned, setEarned] = useState<string[]>(() => getEarnedBadges())
  const [queue,  setQueue]  = useState<BadgeDef[]>([])

  const refresh = useCallback(() => setEarned(getEarnedBadges()), [])

  const award = useCallback((badges: BadgeDef[]) => {
    if (!badges.length) return
    refresh()
    setQueue(prev => [...prev, ...badges])
  }, [refresh])

  const clearFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(b => b.id !== id))
  }, [])

  // Award first_light once — listen for auth sign-in event rather than mount
  // Using a storage event + direct call: only shows toast once per device
  useEffect(() => {
    const tryAward = () => {
      if (awardBadge('first_light')) {
        const def = BADGES.find(b => b.id === 'first_light')
        if (def) setQueue(prev => prev.find(b => b.id === 'first_light') ? prev : [...prev, def])
        refresh()
      }
    }
    // Award when this hook first mounts AND the badge hasn't been awarded yet
    // awardBadge is idempotent so this is safe — but only queue toast once
    tryAward()
    // Also re-check on storage changes (another tab awarded it)
    window.addEventListener('storage', tryAward)
    return () => window.removeEventListener('storage', tryAward)
  }, []) // empty deps — runs once on mount, which is in AppShell (persistent)

  return { earned, queue, award, clearFromQueue, refresh }
}

// ── BadgesPage ────────────────────────────────────────────────────────────────

export function BadgesPage() {
  const earned = getEarnedBadges()
  const earnedSet = new Set(earned)

  const byRarity: Record<BadgeRarity, BadgeDef[]> = {
    common: [], uncommon: [], rare: [], legendary: [], secret: [],
  }
  BADGES.forEach(b => byRarity[b.rarity].push(b))

  const rarityOrder: BadgeRarity[] = ['legendary', 'rare', 'uncommon', 'common', 'secret']
  const earnedCount = BADGES.filter(b => earnedSet.has(b.id)).length

  return (
    <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 mb-4">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1L7.9 4.7H11.9L8.7 7.1L9.9 10.8L6.5 8.5L3.1 10.8L4.3 7.1L1.1 4.7H5.1L6.5 1Z"
              fill="#D97706"/>
          </svg>
          <span className="text-xs font-semibold text-amber-700">Collectible badges</span>
        </div>
        <h1 className="text-3xl font-extrabold text-ink-900 tracking-tight mb-2">Your badges</h1>
        <p className="text-sm text-ink-500 max-w-lg leading-relaxed">
          Each badge is earned, not given. Some are obvious. Some are hidden. All are permanent.
        </p>
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 mb-8 flex items-center gap-5">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-ink-800">Collection progress</span>
            <span className="text-sm font-extrabold text-ink-900">{earnedCount} / {BADGES.length}</span>
          </div>
          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(earnedCount / BADGES.length) * 100}%`,
                background: 'linear-gradient(90deg, #6366F1, #F59E0B)',
              }}
            />
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-extrabold text-ink-900">{Math.round((earnedCount / BADGES.length) * 100)}%</p>
          <p className="text-2xs text-ink-400 font-medium">complete</p>
        </div>
      </div>

      {/* Badge grid by rarity */}
      {rarityOrder.map(rarity => {
        const badges = byRarity[rarity]
        if (!badges.length) return null
        const r = RARITY_CONFIG[rarity]
        const earnedInTier = badges.filter(b => earnedSet.has(b.id)).length
        return (
          <section key={rarity} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <h2 className={cn('text-xs font-black uppercase tracking-widest', r.text)}>{r.label}</h2>
              <div className="flex-1 h-px bg-zinc-100"/>
              <span className="text-xs text-ink-400 font-semibold">{earnedInTier}/{badges.length}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {badges.map(b => (
                <BadgeCard key={b.id} badge={b} earned={earnedSet.has(b.id)} size="md"/>
              ))}
            </div>
          </section>
        )
      })}

      {earnedCount === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-ink-400 leading-relaxed">
            Complete resources, pass quizzes, and explore the platform to start earning badges.
          </p>
          <Link to="/paths/lp1"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#5855D6] text-white text-sm font-bold rounded-xl hover:bg-[#4744C8] transition-colors">
            Start earning →
          </Link>
        </div>
      )}
    </div>
  )
}
