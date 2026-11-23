'use client'

import { useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Bookmark, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { PostCard } from '@/components/post/PostCard'
import { PostSkeletonList } from '@/components/post/PostSkeleton'
import { Entry, FEED_PAGE_SIZE } from '@onchain/shared'

interface BookmarksPage {
  entries: Entry[]
  nextCursor: string | null
}

async function fetchBookmarks(cursor: string | null): Promise<BookmarksPage> {
  const params = new URLSearchParams({ limit: String(FEED_PAGE_SIZE) })
  if (cursor) params.set('cursor', cursor)
  const res = await fetch(`/api/entries/bookmarks?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load bookmarks')
  return res.json() as Promise<BookmarksPage>
}

export function BookmarksClient() {
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
    queryKey: ['bookmarks'],
    queryFn: ({ pageParam }) => fetchBookmarks(pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  })

  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: '400px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinel, fetchNextPage, hasNextPage, isFetchingNextPage])

  const allEntries = data?.pages.flatMap((p) => p.entries) ?? []

  return (
    <div>
      <PageHeader title="Bookmarks" />

      {/* Loading */}
      {isLoading && <PostSkeletonList count={5} />}

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Failed to load bookmarks</p>
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

      {/* Empty */}
      {!isLoading && !isError && allEntries.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-20 px-4 text-center">
          <Bookmark className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-semibold text-lg">No bookmarks yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Your bookmarks are private and stored off-chain. Save posts by tapping the bookmark icon.
            </p>
          </div>
          <Button asChild variant="default">
            <a href="/feed">Browse posts</a>
          </Button>
        </div>
      )}

      {/* Bookmarks */}
      {!isLoading && !isError && allEntries.length > 0 && (
        <div>
          <p className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
            Bookmarks are private and stored off-chain.
          </p>
          {allEntries.map((entry: Entry) => (
            <PostCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      <div ref={setSentinel} className="h-1" />
      {isFetchingNextPage && <PostSkeletonList count={2} />}

      {!hasNextPage && allEntries.length > 0 && !isFetchingNextPage && (
        <p className="py-10 text-center text-sm text-muted-foreground">All bookmarks loaded.</p>
      )}
    </div>
  )
}
