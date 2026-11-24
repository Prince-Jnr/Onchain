import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { PostCard } from '@/components/post/PostCard'
import { PostComposer } from '@/components/post/PostComposer'
import { Skeleton } from '@/components/ui/skeleton'
import { Entry, FeedPage, FEED_PAGE_SIZE, formatCount } from '@onchain/shared'

async function fetchHashtagPage({
  tag,
  cursor,
  limit,
}: {
  tag: string
  cursor: string | null
  limit: number
}): Promise<FeedPage> {
  const params = new URLSearchParams({ type: 'hashtag', tag, limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  const res = await fetch(`/api/feed?${params.toString()}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch hashtag feed')
  return res.json() as Promise<FeedPage>
}

async function fetchHashtagInfo(tag: string): Promise<{ count: number } | null> {
  const res = await fetch(`/api/hashtags?tag=${encodeURIComponent(tag)}`, { credentials: 'include' })
  if (!res.ok) return null
  return (await res.json()) as { count: number }
}

export function HashtagPageClient({ tag }: { tag: string }) {
  const router = useRouter()

  const infoQuery = useQuery({
    queryKey: ['hashtag-info', tag],
    queryFn: () => fetchHashtagInfo(tag),
    staleTime: 30_000,
  })

  const { data, fetchNextPage, hasNextPage, isLoading, isError } = useInfiniteQuery({
    queryKey: ['feed', 'hashtag', tag],
    queryFn: ({ pageParam }) => fetchHashtagPage({ tag, cursor: pageParam as string | null, limit: FEED_PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const entries: Entry[] = data?.pages.flatMap((p) => p.entries) ?? []

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 min-w-0 border-x border-border max-w-2xl mx-auto">
        <PageHeader
          title={`#${tag}`}
          action={
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full gap-1.5"
              onClick={() => router.push('/')}
            >
              <Hash className="h-4 w-4" />
              Tags
            </Button>
          }
        />

        {infoQuery.data && (
          <div className="px-4 pb-3">
            <p className="text-sm text-muted-foreground">
              {formatCount(infoQuery.data.count)} post{infoQuery.data.count !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        <div className="border-b border-border px-4 py-4">
          <PostComposer placeholder={`Post a #${tag}`} />
        </div>

        <div className="px-2">
          {isLoading ? (
            <div className="space-y-0">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-none border-b border-border" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">Could not load posts for #{tag}.</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-6 text-center">
              <Hash className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
              <p className="mt-3 text-sm text-muted-foreground">No posts yet with #{tag}.</p>
            </div>
          ) : (
            entries.map((e) => <PostCard key={e.id} entry={e} />)
          )}

          {hasNextPage && (
            <div className="p-4">
              <Button variant="outline" className="rounded-full" onClick={() => fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
