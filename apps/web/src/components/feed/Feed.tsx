'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, AlertCircle, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PostCard } from '@/components/post/PostCard'
import { PostSkeletonList } from '@/components/post/PostSkeleton'
import { cn } from '@/lib/utils'
import { Entry, FeedType, FeedPage, FEED_PAGE_SIZE } from '@onchain/shared'

const TABS: { value: FeedType; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'following', label: 'Following' },
  { value: 'popular', label: 'Popular' },
  { value: 'trending', label: 'Trending' },
]

async function fetchFeedPage({
  type,
  cursor,
  limit,
}: {
  type: FeedType
  cursor: string | null
  limit: number
}): Promise<FeedPage> {
  const params = new URLSearchParams({ type, limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  const res = await fetch(`/api/feed?${params.toString()}`, { credentials: 'include' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Feed fetch failed (${res.status})`)
  }
  return res.json() as Promise<FeedPage>
}

async function fetchLatestCount(type: FeedType, sinceId: number): Promise<number> {
  try {
    const params = new URLSearchParams({ type, sinceId: String(sinceId) })
    const res = await fetch(`/api/feed/new-count?${params.toString()}`, { credentials: 'include' })
    if (!res.ok) return 0
    const data = (await res.json()) as { count: number }
    return data.count ?? 0
  } catch {
    return 0
  }
}

interface FeedProps {
  initialType?: FeedType
  className?: string
  /** Hide the tab switcher (useful when feed type is controlled externally) */
  hideTabs?: boolean
  /** Override feed type (used by explore/hashtag pages) */
  feedType?: FeedType
}

export function Feed({ initialType = 'latest', className, hideTabs, feedType }: FeedProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<FeedType>(feedType ?? initialType)
  const [newPostCounts, setNewPostCounts] = useState<Partial<Record<FeedType, number>>>({})
  const loaderRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const type = feedType ?? activeTab
  const newPostCount = newPostCounts[type] ?? 0

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed', type],
    queryFn: ({ pageParam }) =>
      fetchFeedPage({ type, cursor: pageParam as string | null, limit: FEED_PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  })

  const topEntryId = data?.pages[0]?.entries[0]?.id ?? null

  // Poll for new posts every 30s
  useEffect(() => {
    if (!topEntryId) return

    const poll = async () => {
      const count = await fetchLatestCount(type, topEntryId)
      if (count > 0) {
        setNewPostCounts((current) => ({ ...current, [type]: count }))
      }
    }

    pollingIntervalRef.current = setInterval(poll, 30_000)
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
    }
  }, [topEntryId, type])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = loaderRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '400px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const handleRefresh = useCallback(() => {
    setNewPostCounts((current) => ({ ...current, [type]: 0 }))
    queryClient.invalidateQueries({ queryKey: ['feed', type] })
    refetch()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [queryClient, refetch, type])

  const handleTabChange = (val: string) => {
    setActiveTab(val as FeedType)
  }

  const allEntries = data?.pages.flatMap((p) => p.entries) ?? []

  return (
    <div className={cn('relative', className)}>
      {/* Tab bar */}
      {!hideTabs && !feedType && (
        <div className="sticky top-14 z-20 border-b border-border bg-background/80 backdrop-blur-sm">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="h-10 w-full rounded-none border-0 bg-transparent p-0 justify-start overflow-x-auto">
              {TABS.map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={cn(
                    'relative h-10 rounded-none border-0 px-4 text-sm font-medium',
                    'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                    'data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground',
                    'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5',
                    'after:bg-primary after:scale-x-0 data-[state=active]:after:scale-x-100',
                    'after:transition-transform after:duration-200'
                  )}
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* New posts pill */}
      {newPostCount > 0 && (
        <div className="sticky top-24 z-20 flex justify-center px-4 mt-2">
          <button
            type="button"
            onClick={handleRefresh}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
              'bg-primary text-primary-foreground shadow-lg',
              'hover:bg-primary/90 transition-colors',
              'animate-in fade-in-0 slide-in-from-top-2 duration-200'
            )}
          >
            <ArrowUp className="h-4 w-4" />
            {newPostCount} new {newPostCount === 1 ? 'post' : 'posts'}
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && <PostSkeletonList count={5} />}

      {/* Error state */}
      {isError && (
        <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Failed to load feed</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && allEntries.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 px-4 text-center">
          <span className="text-4xl">✍️</span>
          <p className="font-medium text-foreground">Nothing here yet.</p>
          <p className="text-sm text-muted-foreground">Be the first to post.</p>
        </div>
      )}

      {/* Feed entries */}
      {!isLoading && !isError && allEntries.length > 0 && (
        <div>
          {allEntries.map((entry: Entry) => (
            <PostCard key={`${entry.id}-${entry.viewerReaction}`} entry={entry} />
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={loaderRef} className="h-1" />

      {/* Load-more skeleton */}
      {isFetchingNextPage && <PostSkeletonList count={3} />}

      {/* End of feed */}
      {!hasNextPage && allEntries.length > 0 && !isFetchingNextPage && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-sm text-muted-foreground">You&apos;ve reached the end.</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      )}
    </div>
  )
}
