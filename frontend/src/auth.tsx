import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { createClient, type SupabaseClient, type User, type AuthError } from '@supabase/supabase-js'



const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
console.log("URL:", import.meta.env.VITE_SUPABASE_URL)
console.log("KEY:", import.meta.env.VITE_SUPABASE_ANON_KEY)
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Onboarding helpers ────────────────────────────────────────────────────────
const ONBOARD_KEY = 'aihub_onboarding'
import type { OnboardingProfile } from './types'

export function getOnboardingProfile(): OnboardingProfile | null {
  if (typeof window === 'undefined') return null
  try { const r = localStorage.getItem(ONBOARD_KEY); return r ? JSON.parse(r) : null } catch { return null }
}
export function saveOnboardingProfile(p: OnboardingProfile) {
  try { localStorage.setItem(ONBOARD_KEY, JSON.stringify(p)) } catch {}
}
export function resetOnboarding() { try { localStorage.removeItem(ONBOARD_KEY) } catch {} }

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import {
  type User,
  type AuthError,
  type PostgrestError,
} from '@supabase/supabase-js'

import { supabase } from './supabase'

// ── Auth context ──────────────────────────────────────────────────────────────

interface AuthCtx {
  user: User | null

  profile: {
    full_name: string | null
    avatar_url: string | null
    role: string | null
  } | null

  loading: boolean

  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>

  signUp: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ error: AuthError | null }>

  signOut: () => Promise<void>

  resetPassword: (
    email: string
  ) => Promise<{ error: AuthError | null }>

  updateRole: (
    role: string
  ) => Promise<{ error: PostgrestError | null }>
}

const Ctx = createContext<AuthCtx>({
  user: null,
  profile: null,
  loading: true,

  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},

  resetPassword: async () => ({ error: null }),

  updateRole: async () => ({ error: null }),
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const [profile, setProfile] = useState<AuthCtx['profile']>(null)

  const [loading, setLoading] = useState(true)

  const loadProfile = async (u: User) => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, role')
      .eq('id', u.id)
      .single()

    setProfile(data ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null

      setUser(u)

      if (u) loadProfile(u)

      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null

      setUser(u)

      if (u) loadProfile(u)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    return { error }
  }

  const signUp = async (
    email: string,
    password: string,
    name?: string
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: name
        ? {
            data: {
              full_name: name,
            },
          }
        : undefined,
    })

    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/forgot-password`,
    })

    return { error }
  }

  const updateRole = async (role: string) => {
    if (!user) {
      return { error: null }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', user.id)

    if (!error) {
      setProfile(prev =>
        prev
          ? {
              ...prev,
              role,
            }
          : prev
      )
    }

    return { error }
  }

  return (
    <Ctx.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateRole,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  return useContext(Ctx)
}
// ── Progress hook ─────────────────────────────────────────────────────────────
const PROG_KEY = 'aihub_progress'

export function useProgress() {
  const { user } = useAuth()
  const [progressMap, setMap] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(PROG_KEY) ?? '{}') } catch { return {} }
  })

  const save = (m: Record<string, number>) => {
    setMap(m)
    try { localStorage.setItem(PROG_KEY, JSON.stringify(m)) } catch {}
  }

  const markComplete = useCallback(async (id: string, complete: boolean) => {
    const next = { ...progressMap, [id]: complete ? 100 : 0 }
    save(next)
    if (user) {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (token) {
        fetch('/api/progress', {
          method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
          body: JSON.stringify({ resource_id:id, completed:complete, percent:complete?100:0 }),
        }).catch(() => {})
      }
    }
  }, [user, progressMap])

  const updateProgress = useCallback((id: string, percent: number) => {
    save({ ...progressMap, [id]: percent })
  }, [progressMap])

  const getProgress   = useCallback((id: string) => progressMap[id] ?? 0, [progressMap])
  const isComplete    = useCallback((id: string) => (progressMap[id] ?? 0) === 100, [progressMap])

  return { progressMap, markComplete, updateProgress, getProgress, isComplete }
}

// ── Bookmarks hook ────────────────────────────────────────────────────────────
const BM_KEY = 'aihub_bookmarks'

export function useBookmarks() {
  const { user } = useAuth()
  const [bookmarkedIds, setIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(BM_KEY) ?? '[]') } catch { return [] }
  })

  const save = (ids: string[]) => {
    setIds(ids)
    try { localStorage.setItem(BM_KEY, JSON.stringify(ids)) } catch {}
  }

  const toggle = useCallback(async (id: string) => {
    const next = bookmarkedIds.includes(id)
      ? bookmarkedIds.filter(x => x !== id)
      : [...bookmarkedIds, id]
    save(next)
    if (user) {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (token) {
        fetch('/api/bookmarks', {
          method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
          body: JSON.stringify({ resource_id:id }),
        }).catch(() => {})
      }
    }
  }, [user, bookmarkedIds])

  const isBookmarked = useCallback((id: string) => bookmarkedIds.includes(id), [bookmarkedIds])

  return { bookmarkedIds, toggle, isBookmarked }
}
