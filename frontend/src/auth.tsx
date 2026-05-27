import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { createClient, type SupabaseClient, type User, type AuthError } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const API_BASE     = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

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

// ── Auth context ──────────────────────────────────────────────────────────────
type Profile = { full_name: string | null; avatar_url: string | null; role: string | null }

interface AuthCtx {
  user:    User | null
  profile: Profile | null
  loading: boolean
  signIn:         (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp:         (email: string, password: string, name?: string, role?: string) => Promise<{ error: AuthError | null }>
  signOut:        () => Promise<void>
  resetPassword:  (email: string) => Promise<{ error: AuthError | null }>
  updateRole:     (role: string)  => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  user: null, profile: null, loading: true,
  signIn:         async () => ({ error: null }),
  signUp:         async () => ({ error: null }),
  signOut:        async () => {},
  resetPassword:  async () => ({ error: null }),
  updateRole:     async () => ({ error: null }),
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (u: User) => {
    const meta = u.user_metadata ?? {}
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, role')
        .eq('id', u.id)
        .single()
      if (error) throw error
      // If DB row exists but role is null, fall back to user_metadata
      setProfile({
        full_name:  data?.full_name  ?? meta.full_name  ?? null,
        avatar_url: data?.avatar_url ?? meta.avatar_url ?? null,
        role:       data?.role       ?? meta.role        ?? 'student',
      })
    } catch {
      // Profiles table may not exist yet — fall back to user metadata
      setProfile({
        full_name:  meta.full_name  ?? null,
        avatar_url: meta.avatar_url ?? null,
        role:       meta.role       ?? 'student',
      })
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) loadProfile(u)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) loadProfile(u)
      else { setProfile(null) }
    })
    return () => subscription.unsubscribe()
  }, [loadProfile])

  // ── Realtime: reflect profile/role changes made directly in Supabase ─────────
  // Without this, a role change in the Supabase dashboard only shows after
  // the next token refresh (~1 hour) or a full sign-out/sign-in.
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`profile-realtime:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          // DB row changed — update local state immediately, no refetch needed
          const row = payload.new as { full_name?: string | null; avatar_url?: string | null; role?: string | null }
          setProfile(prev => ({
            full_name:  row.full_name  ?? prev?.full_name  ?? null,
            avatar_url: row.avatar_url ?? prev?.avatar_url ?? null,
            role:       row.role       ?? prev?.role       ?? 'student',
          }))
        }
      )
      .subscribe()

    // ── Focus fallback: re-fetch profile when user switches back to the tab ──
    // Catches cases where Realtime isn't enabled or the WS dropped.
    const onFocus = () => loadProfile(user)
    window.addEventListener('focus', onFocus)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
    }
  }, [user?.id, loadProfile])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email: string, password: string, name?: string, role = 'student') => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name ?? '', role } },
    })
    return { error }
  }

  const signOut = async () => { await supabase.auth.signOut() }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    return { error }
  }

  const refreshProfile = async () => {
    if (user) await loadProfile(user)
  }

  const updateRole = async (role: string) => {
    if (!user) return { error: new Error('Not signed in') }

    // 1. Always update user_metadata first — this is the reliable fallback
    //    that loadProfile reads when the profiles table is unavailable.
    const { error: metaErr } = await supabase.auth.updateUser({ data: { role } })

    // 2. Also try to persist to profiles table (best-effort)
    const { error: dbErr } = await supabase
      .from('profiles')
      .upsert({ id: user.id, role }, { onConflict: 'id' })

    // 3. Update local state immediately so the UI reflects the change
    setProfile(prev => prev ? { ...prev, role } : { full_name: null, avatar_url: null, role })

    // Surface the first real error (metadata update is more critical)
    return { error: metaErr ?? dbErr ?? null }
  }

  return (
    <Ctx.Provider value={{ user, profile, loading, signIn, signUp, signOut, resetPassword, updateRole, refreshProfile }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() { return useContext(Ctx) }

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
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (token) {
          fetch(`${API_BASE}/api/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ resource_id: id, completed: complete, percent: complete ? 100 : 0 }),
          }).catch(() => {})
        }
      } catch {}
    }
  }, [user, progressMap])

  const updateProgress = useCallback((id: string, percent: number) => {
    save({ ...progressMap, [id]: percent })
  }, [progressMap])

  const getProgress = useCallback((id: string) => progressMap[id] ?? 0,  [progressMap])
  const isComplete  = useCallback((id: string) => (progressMap[id] ?? 0) === 100, [progressMap])

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
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (token) {
          fetch(`${API_BASE}/api/bookmarks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ resource_id: id }),
          }).catch(() => {})
        }
      } catch {}
    }
  }, [user, bookmarkedIds])

  const isBookmarked = useCallback((id: string) => bookmarkedIds.includes(id), [bookmarkedIds])

  return { bookmarkedIds, toggle, isBookmarked }
}
