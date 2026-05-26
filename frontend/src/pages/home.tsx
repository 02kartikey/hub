import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronRight,
} from 'lucide-react'

import { cn } from '../ui'

import {
  OSHero,
  CapabilityModules,
  PersonalisedBanner,
  LearningPathStrip,
  ToolGuideStrip,
  ContentGrid,
  OnboardingModal,
} from '../components'

import { api } from '../api'

import type {
  Resource,
  LearningPath,
} from '../types'

import {
  useAuth,
  useProgress,
  getOnboardingProfile,
} from '../auth'

import {
  SectionHeading,
} from './shared'

// ══════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ══════════════════════════════════════════════════════════════════════════════

function StartHereBannerHome() {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-[#C0BFEF] p-6 mb-8"
      style={{
        background:
          'linear-gradient(135deg, #0A0A0B 0%, #1A1840 60%, #2D2880 100%)',
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, white 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
      />

      <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex-1">
          <p className="text-2xs font-bold text-white/40 uppercase tracking-widest mb-2">
            Start here
          </p>

          <h2 className="text-2xl font-extrabold text-white mb-3 leading-tight">
            Learn AI properly —
            <span className="text-[#8B85F4]"> not just how to use tools</span>
          </h2>

          <p className="text-sm text-white/60 leading-relaxed max-w-2xl">
            Explore AI concepts, prompting, hallucinations, safety,
            critical thinking, CBSE/IGCSE curriculum paths,
            and hands-on exercises designed for real understanding.
          </p>

          <div className="flex flex-wrap gap-3 mt-5">
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-zinc-100 transition-colors"
            >
              Explore resources
              <ArrowRight size={14} />
            </Link>

            <Link
              to="/curriculum"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 bg-white/10 text-white text-sm font-bold hover:bg-white/15 transition-colors"
            >
              View learning paths
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// Daily focus suggestion
function DailyFocus({
  progressMap,
  paths,
  resources,
}: {
  progressMap: Record<string, number>
  paths: LearningPath[]
  resources: Resource[]
}) {
  const incomplete = paths.find((p) =>
    p.resourceIds.some(
      (id) =>
        (progressMap[id] ?? 0) > 0 &&
        (progressMap[id] ?? 0) < 100
    )
  )

  if (!incomplete) return null

  const nextResourceId = incomplete.resourceIds.find(
    (id) => (progressMap[id] ?? 0) < 100
  )

  const nextRes = resources.find((r) => r.id === nextResourceId)

  if (!nextRes) return null

  const pct = Math.round(
    (incomplete.resourceIds.filter(
      (id) => (progressMap[id] ?? 0) === 100
    ).length /
      incomplete.resourceIds.length) *
      100
  )

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-8 border border-[#C0BFEF] p-5"
      style={{
        background:
          'linear-gradient(135deg, #0A0A0B 0%, #1A1840 60%, #2D2880 100%)',
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, white 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
      />

      <div className="relative flex flex-wrap items-center gap-5">
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-bold text-white/40 uppercase tracking-widest mb-1">
            Continue where you left off
          </p>

          <h3 className="text-base font-bold text-white mb-1 truncate">
            {incomplete.title}
          </h3>

          <p className="text-xs text-white/50 mb-3 truncate">
            Next: {nextRes.title}
          </p>

          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-[140px] h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8B85F4] rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>

            <span className="text-2xs text-white/40">
              {pct}% done
            </span>
          </div>
        </div>

        <Link
          to={`/content/${nextRes.id}`}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/15 text-white text-xs font-bold rounded-xl hover:bg-white/20 transition-colors"
        >
          Continue
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  )
}

// Progress stat bar
function ProgressStatBar({
  progressMap,
  paths,
}: {
  progressMap: Record<string, number>
  paths: LearningPath[]
}) {
  const started = Object.values(progressMap).filter(
    (v) => v > 0
  ).length

  const completed = Object.values(progressMap).filter(
    (v) => v === 100
  ).length

  const pathsDone = paths.filter(
    (p) =>
      p.resourceIds.length > 0 &&
      p.resourceIds.every(
        (id) => (progressMap[id] ?? 0) === 100
      )
  ).length

  if (started === 0) return null

  return (
    <div className="grid grid-cols-3 gap-3 mb-7">
      {[
        {
          val: started,
          label: 'Started',
          href: '/progress',
          color: 'text-[#5855D6]',
          bg: 'bg-[#EEEEFF]',
        },
        {
          val: completed,
          label: 'Completed',
          href: '/progress',
          color: 'text-emerald-700',
          bg: 'bg-emerald-50',
        },
        {
          val: pathsDone,
          label: 'Paths finished',
          href: '/curriculum',
          color: 'text-amber-700',
          bg: 'bg-amber-50',
        },
      ].map((s) => (
        <Link
          key={s.label}
          to={s.href}
          className="group flex items-center gap-3 bg-white border border-zinc-100 rounded-xl p-3.5 hover:border-zinc-200 hover:shadow-card transition-all"
        >
          <div
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-extrabold text-base',
              s.bg,
              s.color
            )}
          >
            {s.val}
          </div>

          <p className="text-xs text-zinc-500 group-hover:text-zinc-700 transition-colors font-medium">
            {s.label}
          </p>
        </Link>
      ))}
    </div>
  )
}

export function HomePage() {
  const [paths, setPaths] = useState<LearningPath[]>([])
  const [resources, setRes] = useState<Resource[]>([])
  const [tools, setTools] = useState<any[]>([])
  const [allResources, setAllR] = useState<Resource[]>([])

  const { profile } = useAuth()
  const { progressMap } = useProgress()

  const userName =
    profile?.full_name?.split(' ')[0] ?? null

  useEffect(() => {
    api.resources
      .list({ featured: true, limit: 12 })
      .then((r) => setRes(r.data))
      .catch(() => {})

    api.resources
      .list({ limit: 200 })
      .then((r) => setAllR(r.data))
      .catch(() => {})

    api.paths
      .list()
      .then((r) => setPaths(r.data))
      .catch(() => {})

    api.tools
      .list()
      .then((r) => setTools(r.data))
      .catch(() => {})
  }, [])

  const recommended = useMemo(() => {
    const onboard = getOnboardingProfile()
    const goals = onboard?.goals ?? []

    const untouched = allResources.filter(
      (r) => !progressMap[r.id]
    )

    if (goals.length === 0) {
      return untouched.slice(0, 6)
    }

    const scored = untouched.map((r) => ({
      r,
      score: (r.topics ?? []).filter((t) =>
        goals.some(
          (g) =>
            g.toLowerCase().includes(t.toLowerCase()) ||
            t.toLowerCase().includes(g.toLowerCase())
        )
      ).length,
    }))

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((s) => s.r)
  }, [allResources, progressMap])

  const hasProgress = Object.values(progressMap).some(
    (v) => v > 0
  )

  return (
    <div className="px-4 lg:px-8 py-6 max-w-6xl mx-auto">
      <OSHero name={userName ?? undefined} />

      <StartHereBannerHome />

      <ProgressStatBar
        progressMap={progressMap}
        paths={paths}
      />

      <DailyFocus
        progressMap={progressMap}
        paths={paths}
        resources={allResources}
      />

      <CapabilityModules />

      <PersonalisedBanner />

      {hasProgress && recommended.length > 0 && (
        <section className="mb-8">
          <SectionHeading
            title="Recommended for you"
            action={
              <Link
                to="/browse"
                className="text-xs text-[#5855D6] hover:text-[#4744C8] font-semibold flex items-center gap-1"
              >
                Browse all
                <ChevronRight size={12} />
              </Link>
            }
          />

          <ContentGrid resources={recommended} />
        </section>
      )}

      <LearningPathStrip
        paths={paths.filter((p) => !p.board).slice(0, 8)}
      />

      <ToolGuideStrip tools={tools} />

      {!hasProgress && (
        <section className="mb-8">
          <SectionHeading
            title="Featured resources"
            action={
              <Link
                to="/browse"
                className="text-xs text-[#5855D6] hover:text-[#4744C8] font-semibold flex items-center gap-1"
              >
                Browse all
                <ChevronRight size={12} />
              </Link>
            }
          />

          <ContentGrid resources={resources} />
        </section>
      )}

      <OnboardingModal />
    </div>
  )
}

// Alias for dashboard routing
export const DashboardPage = HomePage
