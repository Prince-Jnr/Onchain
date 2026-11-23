import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight, Link2, Users, ShieldCheck } from 'lucide-react'
import { HeroSection } from '@/components/home/HeroSection'
import { FeedPreview } from '@/components/home/FeedPreview'
import { StatsSection } from '@/components/home/StatsSection'
import { CTAButtonsClient } from '@/components/home/CTAButtonsClient'

// Fetch recent posts for the feed preview (server-side, cached 60s)
async function getRecentPosts() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/feed?limit=5`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.entries ?? data.posts ?? []) as Array<{
      id: string
      content: string
      authorAddress: string
      createdAt: string
      reactionCount?: number
      replyCount?: number
    }>
  } catch {
    return []
  }
}

// Fetch platform stats (cached 5 min)
async function getStats() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/stats`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return res.json() as Promise<{
      totalPosts: number
      totalUsers: number
      totalTransactions: number
    }>
  } catch {
    return null
  }
}

const FEATURES = [
  {
    icon: Link2,
    title: 'On-chain ownership',
    description:
      'Every post is recorded on Base. No company owns your content — the chain does. It stays there as long as the network runs.',
  },
  {
    icon: Users,
    title: 'Community interactions',
    description:
      "React, reply, follow, and repost. All interactions are verifiable on-chain, so reputation can\u2019t be faked or erased.",
  },
  {
    icon: ShieldCheck,
    title: 'Transparent moderation',
    description:
      'Moderation actions are logged publicly. Anyone can see what was hidden, by whom, and why — no silent erasure.',
  },
]

export default async function HomePage() {
  const [posts, stats] = await Promise.all([getRecentPosts(), getStats()])

  return (
    <div className="flex flex-col">
      {/* Hero — client island for wallet-aware CTA */}
      <HeroSection />

      {/* Live feed preview */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Recent posts
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                What people are leaving behind right now.
              </p>
            </div>
            <Link
              href="/feed"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-4"
            >
              See all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <Suspense fallback={<FeedPreviewSkeleton />}>
            <FeedPreview posts={posts} />
          </Suspense>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
          <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            How it works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex flex-col gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background">
                  <Icon className="h-[18px] w-[18px] text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <Suspense fallback={null}>
            <StatsSection stats={stats} />
          </Suspense>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Ready to leave something behind?
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Connect your wallet and your words go on-chain, permanently.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <CTAButtonsClient />
          </div>
        </div>
      </section>
    </div>
  )
}

function FeedPreviewSkeleton() {
  return (
    <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse px-5 py-4 flex gap-3">
          <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-28 rounded bg-muted" />
            <div className="h-3.5 w-full rounded bg-muted" />
            <div className="h-3.5 w-4/5 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}
