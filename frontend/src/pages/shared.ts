// Shared helpers used across all page files
import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '../ui'

export function useFetch<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData]     = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    fn().then(d => { if (!cancelled) { setData(d); setLoading(false) } })
        .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, loading, error }
}

export function PageLoader() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden" style={{ border:'1px solid var(--border)' }}>
          <div className="bg-zinc-100" style={{ aspectRatio:'16/9' }}/>
          <div className="p-4 space-y-2.5">
            <div className="h-2 bg-zinc-100 rounded-full w-1/3"/>
            <div className="h-3.5 bg-zinc-100 rounded-full w-full"/>
            <div className="h-3.5 bg-zinc-100 rounded-full w-4/5"/>
            <div className="h-2 bg-zinc-100 rounded-full w-1/2 mt-3"/>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PageError({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
          <AlertCircle size={20} className="text-red-500"/>
        </div>
        <p className="text-sm font-semibold text-zinc-700">{msg}</p>
      </div>
    </div>
  )
}

export function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-zinc-900">{title}</h2>
      {action}
    </div>
  )
}
