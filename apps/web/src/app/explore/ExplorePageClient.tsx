'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { TrendingUp, Hash, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Feed } from '@/components/feed/Feed'
import { PostCard } from '@/components/post/PostCard'
import { PostSkeleton } from '@/components/post/PostSkeleton'
import { cn } from '@/lib/utils'
import { Entry, HashtagResult } from '@onchain/shared'

async function fetchPinnedPosts(): Promise<Entry[]> {
  const res = await fetch('/api/feed?type=featured&limit=5', { credentials: 'include' })
  if (!res.ok) return []
  const data = await res.json() as { entries: Entry[] }
  return data.entries ?? []
}

async function fetchTrendingHashtags(): Promise<HashtagResult[]> {
  const res = await fetch('/api/search/trending-hashtags?limit=10', { credentials: 'include' })
  if (!res.ok) return []
  const data = await res.json() as HashtagResult[]
  return data
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <main className="flex-1 min-w-0 border-x border-border max-w-2xl mx-auto">
        {children}
      </main>
    </div>
  )
}

function TrendingHashtagsSidebar({ hashtags }: { hashtags: HashtagResult[] }) {
  if (!hashtags.length) return null

  return (
    <aside className="hidden xl:block w-72 shrink-0 pl-6 pt-4">
      <div className="sticky top-20 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-sm">
          <TrendingUp className="h-4 w-4 text-primary" />
          Trending topics
        </h2>
        <div className="space-y-1">
          {hashtags.map((ht) => (
            <Link
              key={ht.tag}
              href={`/hashtag/${ht.tag}`}
              className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-muted transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Hash className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium group-hover:text-primary transition-colors">
                  {ht.tag}
                </span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {ht.count.toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
        <Link
          href="/trending"
          className="mt-3 block text-xs text-primary hover:underline text-center"
        >
          See all trending →
        </Link>
      </div>
    </aside>
  )
}

function FeaturedSection() {
  const { data: featured, isLoading } = useQuery({
    queryKey: ['feed', 'featured'],
    queryFn: fetchPinnedPosts,
    staleTime: 5 * 60_000,
  })

  if (isLoading) {
    return (
      <div className="border-b border-border">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <span>📌</span> Featured
          </h2>
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <PostSkeleton key={i} compact />
        ))}
      </div>
    )
  }

  if (!featured?.length) return null

  return (
    <section className="border-b border-border">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <span>📌</span> Featured
        </h2>
      </div>
      {featured.map((entry) => (
        <PostCard key={entry.id} entry={entry} compact />
      ))}
    </section>
  )
}

export function ExplorePageClient() {
  const { data: trendingHashtags = [] } = useQuery({
    queryKey: ['trending-hashtags'],
    queryFn: fetchTrendingHashtags,
    staleTime: 2 * 60_000,
  })

  return (
    <div className="flex min-h-screen">
      {/* Main column */}
      <div className="flex-1 min-w-0 border-x border-border max-w-2xl mx-auto">
        <PageHeader title="Explore" />

        {/* Featured / pinned posts */}
        <FeaturedSection />

        {/* Mobile trending hashtags (inline) */}
        {trendingHashtags.length > 0 && (
          <div className="xl:hidden border-b border-border px-4 py-3">
            <h2 className="mb-2 flex items-center gap-2 font-semibold text-sm">
              <TrendingUp className="h-4 w-4 text-primary" />
              Trending
            </h2>
            <div className="flex flex-wrap gap-2">
              {trendingHashtags.slice(0, 8).map((ht) => (
                <Link
                  key={ht.tag}
                  href={`/hashtag/${ht.tag}`}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary transition-colors"
                >
                  #{ht.tag}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Main feed — latest all posts */}
        <Feed feedType="latest" hideTabs />
      </div>

      {/* Trending sidebar — only on xl screens */}
      <TrendingHashtagsSidebar hashtags={trendingHashtags} />
    </div>
  )
}
