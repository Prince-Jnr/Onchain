'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount, useChainId } from 'wagmi'
import {
  ArrowLeft,
  MessageCircle,
  Bookmark,
  BookmarkCheck,
  Share2,
  ExternalLink,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { PostCard } from '@/components/post/PostCard'
import { PostSkeletonList } from '@/components/post/PostSkeleton'
import { PostComposer } from '@/components/post/PostComposer'
import { ReactionButton } from '@/components/post/ReactionButton'
import { RepostButton } from '@/components/post/RepostButton'
import {
  Entry,
  EntryType,
  FeedPage,
  FEED_PAGE_SIZE,
  getTxUrl,
  shortenAddress,
  formatRelativeTime,
  formatCount,
  ipfsToHttp,
  ReactionType,
} from '@onchain/shared'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

async function fetchEntry(id: number): Promise<Entry> {
  const res = await fetch(`/api/entries/${id}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`Entry not found (${res.status})`)
  const data = await res.json() as { entry: Entry }
  return data.entry
}

async function fetchReplies(entryId: number, cursor: string | null): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: String(FEED_PAGE_SIZE) })
  if (cursor) params.set('cursor', cursor)
  const res = await fetch(`/api/entries/${entryId}/replies?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load replies')
  return res.json() as Promise<FeedPage>
}

async function fetchQuotes(entryId: number): Promise<Entry[]> {
  const res = await fetch(`/api/entries/${entryId}/quotes?limit=10`, { credentials: 'include' })
  if (!res.ok) return []
  const data = await res.json() as { entries: Entry[] }
  return data.entries ?? []
}

function formatFullDateTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatText(text: string): React.ReactNode[] {
  const parts = text.split(/(#[a-zA-Z][a-zA-Z0-9_]*|@0x[0-9a-fA-F]{40})/g)
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      return (
        <Link key={i} href={`/hashtag/${part.slice(1).toLowerCase()}`} className="text-primary hover:underline">
          {part}
        </Link>
      )
    }
    if (part.startsWith('@')) {
      const addr = part.slice(1)
      return (
        <Link key={i} href={`/profile/${addr}`} className="text-primary hover:underline">
          @{shortenAddress(addr as `0x${string}`, 4)}
        </Link>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function FullPostView({ entry }: { entry: Entry }) {
  const { address: connectedAddress } = useAccount()
  const chainId = useChainId()
  const [localReaction, setLocalReaction] = useState<ReactionType | null>(entry.viewerReaction)
  const [localTotalReactions, setLocalTotalReactions] = useState(entry.totalReactions)
  const [localReposted, setLocalReposted] = useState(entry.viewerHasReposted)
  const [localRepostCount, setLocalRepostCount] = useState(entry.repostCount)
  const [localBookmarked, setLocalBookmarked] = useState(entry.viewerHasBookmarked)
  const [isBookmarkPending, setIsBookmarkPending] = useState(false)

  const displayName = entry.authorProfile?.displayName ?? shortenAddress(entry.author, 4)
  const avatarUrl = entry.authorProfile?.avatarUrl ? ipfsToHttp(entry.authorProfile.avatarUrl) : undefined
  const txUrl = entry.txHash ? getTxUrl(entry.txHash, chainId) : null

  const handleBookmark = async () => {
    if (!connectedAddress) {
      toast.error('Connect your wallet to bookmark posts.')
      return
    }
    if (isBookmarkPending) return
    const next = !localBookmarked
    setLocalBookmarked(next)
    setIsBookmarkPending(true)
    try {
      const res = await fetch(`/api/entries/${entry.id}/bookmark`, {
        method: next ? 'POST' : 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
    } catch {
      setLocalBookmarked(!next)
      toast.error('Failed to update bookmark.')
    } finally {
      setIsBookmarkPending(false)
    }
  }

  const handleShare = () => {
    const url = `${window.location.origin}/post/${entry.id}`
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied.'))
  }

  return (
    <article className="px-4 py-4 border-b border-border">
      {/* Author */}
      <div className="flex items-start gap-3 mb-4">
        <Link href={`/profile/${entry.author}`} className="shrink-0">
          <Avatar className="h-12 w-12 ring-1 ring-border hover:ring-primary transition-all">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="text-sm font-medium bg-muted">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${entry.author}`} className="block font-semibold text-foreground hover:underline">
            {displayName}
          </Link>
          <span className="text-sm text-muted-foreground font-mono">
            @{shortenAddress(entry.author, 4)}
          </span>
        </div>
      </div>

      {/* Full content */}
      {entry.content?.text && (
        <p className="text-xl leading-relaxed text-foreground whitespace-pre-wrap mb-4 break-words">
          {formatText(entry.content.text)}
        </p>
      )}

      {/* Media */}
      {entry.media.length > 0 && (
        <div className={cn(
          'mb-4 overflow-hidden rounded-xl border border-border',
          entry.media.length === 1 ? 'grid grid-cols-1' : 'grid grid-cols-2 gap-0.5'
        )}>
          {entry.media.slice(0, 4).map((m, i) => {
            const url = m.url.startsWith('ipfs://') ? ipfsToHttp(m.url) : m.url
            return (
              <div key={m.id} className="relative aspect-video bg-muted">
                <Image src={url} alt={m.altText ?? `Media ${i + 1}`} fill className="object-cover" sizes="600px" />
              </div>
            )
          })}
        </div>
      )}

      {/* Quoted post */}
      {entry.entryType === EntryType.QUOTE && entry.referencedEntry && (
        <div className="mb-4 rounded-xl border border-border p-4">
          <Link href={`/profile/${entry.referencedEntry.author}`} className="flex items-center gap-2 mb-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-muted">
                {(entry.referencedEntry.authorProfile?.displayName ?? entry.referencedEntry.author).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hover:underline">
              {entry.referencedEntry.authorProfile?.displayName ?? shortenAddress(entry.referencedEntry.author, 4)}
            </span>
          </Link>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {entry.referencedEntry.content?.text ?? ''}
          </p>
        </div>
      )}

      {/* Timestamp + on-chain link */}
      <div className="flex items-center gap-3 mb-4 text-sm text-muted-foreground border-b border-border pb-4">
        <time dateTime={new Date(entry.createdAt).toISOString()}>
          {formatFullDateTime(entry.createdAt)}
        </time>
        {txUrl && (
          <>
            <span>·</span>
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-onchain hover:underline font-medium"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-onchain" />
              Onchain
              <ExternalLink className="h-3 w-3" />
            </a>
          </>
        )}
      </div>

      {/* Counts */}
      <div className="flex items-center gap-5 mb-4 text-sm border-b border-border pb-4">
        <span>
          <strong className="font-semibold text-foreground">{formatCount(localRepostCount)}</strong>
          <span className="text-muted-foreground ml-1">Reposts</span>
        </span>
        <span>
          <strong className="font-semibold text-foreground">{formatCount(entry.commentCount)}</strong>
          <span className="text-muted-foreground ml-1">Replies</span>
        </span>
        <span>
          <strong className="font-semibold text-foreground">{formatCount(localTotalReactions)}</strong>
          <span className="text-muted-foreground ml-1">Reactions</span>
        </span>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-0 -ml-2">
        <ReactionButton
          entryId={entry.id}
          totalReactions={localTotalReactions}
          reactionCounts={entry.reactionCounts}
          viewerReaction={localReaction}
          onOptimisticUpdate={(reaction, delta) => {
            setLocalReaction(reaction)
            setLocalTotalReactions((c) => Math.max(0, c + delta))
          }}
        />
        <RepostButton
          entryId={entry.id}
          repostCount={localRepostCount}
          viewerHasReposted={localReposted}
          onOptimisticUpdate={(reposted) => {
            setLocalReposted(reposted)
            setLocalRepostCount((c) => Math.max(0, c + (reposted ? 1 : -1)))
          }}
        />
        <button
          type="button"
          onClick={handleBookmark}
          disabled={isBookmarkPending}
          aria-label={localBookmarked ? 'Remove bookmark' : 'Bookmark'}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors',
            'hover:bg-primary/10 hover:text-primary',
            localBookmarked ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {localBookmarked ? <BookmarkCheck className="h-5 w-5 fill-current" /> : <Bookmark className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="ml-auto flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>
    </article>
  )
}

function RepliesSection({ entryId, onReplySuccess }: { entryId: number; onReplySuccess: () => void }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['replies', entryId],
    queryFn: ({ pageParam }) => fetchReplies(entryId, pageParam as string | null),
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

  const allReplies = data?.pages.flatMap((p) => p.entries) ?? []

  if (isLoading) return <PostSkeletonList count={3} />

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Failed to load replies.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
      </div>
    )
  }

  if (!allReplies.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <MessageCircle className="h-10 w-10 text-muted-foreground" />
        <p className="font-medium">No replies yet.</p>
        <p className="text-sm text-muted-foreground">Be the first to reply.</p>
      </div>
    )
  }

  return (
    <div>
      {allReplies.map((entry: Entry) => (
        <PostCard key={entry.id} entry={entry} />
      ))}
      <div ref={setSentinel} className="h-1" />
      {isFetchingNextPage && <PostSkeletonList count={2} />}
    </div>
  )
}

interface PostDetailClientProps {
  entryId: number
  initialEntry: Entry | null
}

export function PostDetailClient({ entryId, initialEntry }: PostDetailClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: entry, isLoading, isError } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => fetchEntry(entryId),
    initialData: initialEntry ?? undefined,
    staleTime: 30_000,
  })

  const { data: quotes } = useQuery({
    queryKey: ['quotes', entryId],
    queryFn: () => fetchQuotes(entryId),
    staleTime: 60_000,
    enabled: !!entry,
  })

  const handleReplySuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['replies', entryId] })
    queryClient.invalidateQueries({ queryKey: ['entry', entryId] })
  }

  if (isLoading) {
    return (
      <div>
        <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex h-14 items-center gap-3 px-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-6 w-4/5" />
        </div>
      </div>
    )
  }

  if (isError || !entry) {
    return (
      <div>
        <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex h-14 items-center gap-3 px-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-semibold text-sm">Post</h1>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 py-20 px-4 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-semibold text-lg">Post not found</p>
            <p className="text-sm text-muted-foreground mt-1">This post may have been deleted or doesn&apos;t exist.</p>
          </div>
          <Button variant="outline" onClick={() => router.back()}>Go back</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold text-sm">Post</h1>
        </div>
      </div>

      {/* Parent thread context */}
      {entry.parentEntry && (
        <div className="border-b border-border">
          <PostCard entry={entry.parentEntry} compact />
          <div className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground">
            <div className="ml-5 h-4 w-px bg-border" />
            <span>Replying to this post</span>
          </div>
        </div>
      )}

      {/* Full post */}
      <FullPostView entry={entry} />

      {/* Reply composer */}
      <div className="border-b border-border">
        <PostComposer
          replyTo={entry}
          onSuccess={handleReplySuccess}
          placeholder={`Reply to ${entry.authorProfile?.displayName ?? shortenAddress(entry.author, 4)}…`}
        />
      </div>

      {/* Replies section */}
      <div>
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            Replies
            {entry.commentCount > 0 && (
              <span className="text-muted-foreground font-normal">({formatCount(entry.commentCount)})</span>
            )}
          </h2>
        </div>
        <RepliesSection entryId={entryId} onReplySuccess={handleReplySuccess} />
      </div>

      {/* Quotes section */}
      {quotes && quotes.length > 0 && (
        <div className="border-t border-border">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">Quotes ({formatCount(quotes.length)})</h2>
          </div>
          {quotes.map((q) => (
            <PostCard key={q.id} entry={q} />
          ))}
        </div>
      )}
    </div>
  )
}
