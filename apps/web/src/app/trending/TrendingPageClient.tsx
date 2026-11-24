'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, Hash, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { Feed } from '@/components/feed/Feed'
import { Skeleton } from '@/components/ui/skeleton'
import { HashtagResult } from '@onchain/shared'
import Link from 'next/link'

async function fetchHashtags(): Promise<HashtagResult[]> {
  const res = await fetch('/api/hashtags?sort=trending&limit=12', { credentials: 'include' })
  if (!res.ok) return []
  return (await res.json()) as HashtagResult[]
}

function HashtagList() {
  const queryClient = useQueryClient()
  const { data: hashtags, isLoading } = useQuery<HashtagResult[]>({
    queryKey: ['trending-hashtags'],
    queryFn: fetchHashtags,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="mt-4 space-y-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (!hashtags || hashtags.length === 0) return null

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Trending hashtags</h2>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-6 w-6 p-0"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['trending-hashtags'] })}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {hashtags.map((h) => (
          <Link key={h.tag} href={`/hashtag/${h.tag}`}>
            <Button variant="outline" size="sm" className="rounded-full text-xs gap-1">
              #{h.tag}
              {h.count > 0 && <span className="text-muted-foreground">{h.count}</span>}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function TrendingPageClient() {
  return (
    <div className="flex min-h-screen">
      <main className="flex-1 min-w-0 border-x border-border max-w-2xl mx-auto">
        <PageHeader
          title="Trending"
          action={
            <Link href="/explore">
              <Button variant="ghost" size="sm" className="rounded-full gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Explore
              </Button>
            </Link>
          }
        />
        <Feed initialType="trending" />
        <HashtagList />
      </main>
    </div>
  )
}
