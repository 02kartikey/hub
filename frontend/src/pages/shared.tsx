// Shared helpers used across all page files
import React, {
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '../ui'

export function useFetch<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)

    fn()
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message ?? 'Something went wrong')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error }
}

export function PageLoader() {
  return (
    <div className="grid grid-cols-1 gap-4 animate-pulse sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl bg-white"
          style={{ border: '1px solid var(--border)' }}
        >
          <div className="bg-zinc-100" style={{ aspectRatio: '16/9' }} />
          <div className="space-y-2.5 p-4">
            <div className="h-2 w-1/3 rounded-full bg-zinc-100" />
            <div className="h-3.5 w-full rounded-full bg-zinc-100" />
            <div className="h-3.5 w-4/5 rounded-full bg-zinc-100" />
            <div className="mt-3 h-2 w-1/2 rounded-full bg-zinc-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PageError({ msg }: { msg: string }) {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
          <AlertCircle size={20} className="text-red-500" />
        </div>
        <p className="text-sm font-semibold text-zinc-700">{msg}</p>
      </div>
    </div>
  )
}

export function SectionHeading({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-bold text-zinc-900">{title}</h2>
      {action}
    </div>
  )
}
export function PageHeader({
  eyebrow,
  eyebrowIcon,
  eyebrowColor,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string
  eyebrowIcon?: React.ReactNode
  eyebrowColor?: string
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <div
            className={cn(
              'mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest',
              eyebrowColor ??
                'border-zinc-200 bg-zinc-100 text-zinc-600',
            )}
          >
            {eyebrowIcon}
            {eyebrow}
          </div>
        )}

        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  )
}
