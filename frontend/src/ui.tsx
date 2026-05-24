/**
 * ui.tsx — design system primitives
 * AIhub OS — "The AI-Native Student Operating System"
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes } from 'react'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

// ── Badge ──────────────────────────────────────────────────────────────────────
type BadgeVariant = 'default'|'video'|'seminar'|'guide'|'walkthrough'|'pdf'|'book'|'course'|'article'
  | 'beginner'|'intermediate'|'advanced' | 'teacher'|'student'
  | 'blue'|'green'|'amber'|'red'|'purple'|'indigo'|'outline'

const BADGE: Record<BadgeVariant, string> = {
  // Type badges — zinc neutral, clean
  default:      'bg-zinc-100 text-zinc-600',
  video:        'bg-zinc-900 text-white',
  seminar:      'bg-zinc-100 text-zinc-700',
  guide:        'bg-zinc-100 text-zinc-600',
  walkthrough:  'bg-zinc-100 text-zinc-600',
  pdf:          'bg-zinc-100 text-zinc-600',
  book:         'bg-zinc-100 text-zinc-700',
  course:       'bg-zinc-100 text-zinc-700',
  article:      'bg-zinc-100 text-zinc-600',
  // Difficulty — semantic colour, intentional signal
  beginner:     'bg-emerald-50 text-emerald-700',
  intermediate: 'bg-amber-50 text-amber-700',
  advanced:     'bg-zinc-900 text-white',
  // Audience
  teacher:      'bg-zinc-100 text-zinc-700',
  student:      'bg-zinc-100 text-zinc-600',
  // Status/utility
  blue:         'bg-[#EEEEFF] text-[#5855D6]',
  green:        'bg-emerald-50 text-emerald-700',
  amber:        'bg-amber-50 text-amber-700',
  red:          'bg-red-50 text-red-700',
  purple:       'bg-[#EEEEFF] text-[#5855D6]',
  indigo:       'bg-[#EEEEFF] text-[#5855D6]',
  outline:      'ring-1 ring-zinc-200 text-zinc-600',
}

const TYPE_LABELS: Partial<Record<BadgeVariant,string>> = {
  video:'Video', seminar:'Seminar', guide:'Guide', walkthrough:'Walkthrough',
  pdf:'PDF', book:'Book', course:'Course', article:'Article',
}

export function Badge({ variant='default', children, className, size='sm' }: {
  variant?: BadgeVariant; children?: ReactNode; className?: string; size?: 'xs'|'sm'|'md'
}) {
  return (
    <span className={cn(
      'inline-flex items-center font-semibold rounded-md whitespace-nowrap',
      size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10.5px] px-2 py-0.5',
      BADGE[variant], className,
    )}>
      {children ?? TYPE_LABELS[variant] ?? variant}
    </span>
  )
}

// ── Button ─────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary'|'secondary'|'ghost'|'danger'|'outline'|'accent'
type BtnSize    = 'xs'|'sm'|'md'|'lg'

const BTN_V: Record<BtnVariant, string> = {
  primary:   'bg-zinc-900 text-white hover:bg-zinc-800 active:bg-black shadow-sm',
  accent:    'bg-[#5855D6] text-white hover:bg-[#4744C8] shadow-sm',
  secondary: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 active:bg-zinc-300',
  ghost:     'text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200',
  danger:    'bg-red-500 text-white hover:bg-red-600',
  outline:   'ring-1 ring-zinc-200 text-zinc-700 hover:bg-zinc-50 bg-white',
}
const BTN_S: Record<BtnSize, string> = {
  xs: 'px-2.5 py-1 text-2xs gap-1.5', sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',     lg: 'px-5 py-2.5 text-sm gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant; size?: BtnSize; loading?: boolean; icon?: ReactNode; iconRight?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant='primary', size='md', loading, icon, iconRight, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref} disabled={disabled||loading}
      className={cn(
        'inline-flex items-center font-semibold rounded-xl transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1',
        'disabled:opacity-40 disabled:cursor-not-allowed select-none',
        BTN_V[variant], BTN_S[size], className,
      )}
      {...props}
    >
      {loading
        ? <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin flex-shrink-0"/>
        : icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
      {iconRight && <span className="flex-shrink-0">{iconRight}</span>}
    </button>
  ),
)
Button.displayName = 'Button'

// ── Input ──────────────────────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode; suffix?: ReactNode; error?: string
}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, suffix, error, className, ...props }, ref) => (
    <div className="relative flex items-center">
      {icon && <span className="absolute left-3 text-zinc-400 flex-shrink-0 pointer-events-none">{icon}</span>}
      <input
        ref={ref}
        className={cn(
          'w-full text-sm bg-white text-zinc-900 placeholder:text-zinc-400',
          'border border-zinc-200 rounded-xl transition-all duration-150',
          'focus:outline-none focus:border-[#5855D6] focus:ring-2 focus:ring-[#EEEEFF]',
          error ? 'border-signal-red' : '',
          icon ? 'pl-9' : 'pl-4',
          suffix ? 'pr-10' : 'pr-4',
          'py-2',
          className,
        )}
        {...props}
      />
      {suffix && <span className="absolute right-3 text-zinc-400 flex-shrink-0 pointer-events-none">{suffix}</span>}
    </div>
  ),
)
Input.displayName = 'Input'

// ── ProgressBar ────────────────────────────────────────────────────────────────
export function ProgressBar({ value, size='sm', showLabel, className, color }: {
  value: number; size?: 'xs'|'sm'|'md'; showLabel?: boolean; className?: string; color?: string
}) {
  const pct = Math.min(100, Math.max(0, value))
  const h   = { xs:'h-0.5', sm:'h-1', md:'h-1.5' }[size]
  const bg  = color ?? (pct === 100 ? 'bg-signal-green' : 'bg-accent-500')
  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between mb-1.5 text-xs text-zinc-500">
          <span>Progress</span>
          <span className="font-semibold text-zinc-700">{pct}%</span>
        </div>
      )}
      <div className={cn('w-full rounded-full bg-zinc-200', h)}
        role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn('h-full rounded-full transition-all duration-700 ease-out', bg)}
          style={{ width:`${pct}%`, background: pct === 100 ? '#10B981' : '#5855D6' }}/>
      </div>
    </div>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────────
export function Card({ children, className, onClick, padded=true }: {
  children: ReactNode; className?: string; onClick?: () => void; padded?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl',
        'transition-all duration-150',
        onClick && 'cursor-pointer hover:shadow-card-hover hover:border-zinc-300',
        padded && 'p-4',
        className,
      )}>
      {children}
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon, trend }: {
  label: string; value: string | number; sub?: string; icon?: ReactNode; trend?: 'up'|'down'|'flat'
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-card">
      <div className="flex items-start justify-between mb-2">
        <p className="text-2xs font-bold uppercase tracking-[0.08em] text-zinc-400">{label}</p>
        {icon && <span className="text-zinc-300">{icon}</span>}
      </div>
      <p className="font-extrabold tracking-tight" style={{ fontSize:22, color:"var(--text-1)" }}>{value}</p>
      {sub && <p className="mt-0.5" style={{ fontSize:11.5, color:"var(--text-3)" }}>{sub}</p>}
    </div>
  )
}

// ── Spinner ────────────────────────────────────────────────────────────────────
export function Spinner({ size=16, className }: { size?: number; className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} style={{ width:size, height:size }}
      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      {icon && <div className="text-zinc-200 mb-4">{icon}</div>}
      <h3 className="text-sm font-semibold text-zinc-700 mb-1">{title}</h3>
      {description && <p className="text-xs text-zinc-400 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ── Typing dots ────────────────────────────────────────────────────────────────
export function TypingDots() {
  return (
    <div className="flex gap-1 items-center h-4">
      {[0,1,2].map(i => (
        <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"
          style={{ animationDelay:`${i*140}ms` }}/>
      ))}
    </div>
  )
}

// ── Kbd ────────────────────────────────────────────────────────────────────────
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono font-semibold
                    bg-ink-100 text-zinc-500 border border-zinc-200 border-b-2">
      {children}
    </kbd>
  )
}

// ── Divider ────────────────────────────────────────────────────────────────────
export function Divider({ label, className }: { label?: string; className?: string }) {
  if (!label) return <div className={cn('border-t border-zinc-100', className)}/>
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex-1 border-t border-zinc-100"/>
      <span className="text-2xs font-semibold uppercase tracking-widest text-zinc-300">{label}</span>
      <div className="flex-1 border-t border-zinc-100"/>
    </div>
  )
}
