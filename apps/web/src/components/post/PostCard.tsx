'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAccount, useWriteContract, useChainId } from 'wagmi'
import { toast } from 'sonner'
import {
  MoreHorizontal,
  MessageCircle,
  Bookmark,
  BookmarkCheck,
  Share2,
  Pin,
  Trash2,
  Flag,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, shortenAddress, formatRelativeTime, formatCount } from '@/lib/utils'
import {
  Entry,
  EntryType,
  EntryStatus,
  ReactionType,
  CONTRACT_ADDRESSES,
  ONCHAIN_SOCIAL_ABI,
  getTxUrl,
  ipfsToHttp,
} from '@onchain/shared'
import { ReactionButton } from './ReactionButton'
import { RepostButton } from './RepostButton'
import { DeletePostDialog } from './DeletePostDialog'
import { ReportDialog } from './ReportDialog'
import { QuoteDialog } from './QuoteDialog'
import { MessageSquareQuote } from 'lucide-react'

interface PostCardProps {
  entry: Entry
  showParent?: boolean
  compact?: boolean
  onClick?: () => void
}

function formatText(text: string): React.ReactNode[] {
  // Split on hashtags and @mentions, highlight them
  const parts = text.split(/(#[a-zA-Z][a-zA-Z0-9_]*|@0x[0-9a-fA-F]{40})/g)
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      return (
        <Link
          key={i}
          href={`/hashtag/${part.slice(1).toLowerCase()}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      )
    }
    if (part.startsWith('@')) {
      const addr = part.slice(1)
      return (
        <Link
          key={i}
          href={`/profile/${addr}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {shortenAddress(addr as `0x${string}`, 4)}
        </Link>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function MediaGrid({ media }: { media: Entry['media'] }) {
  if (!media.length) return null

  const imgs = media.slice(0, 4)
  const count = imgs.length

  return (
    <div
      className={cn(
        'mt-3 overflow-hidden rounded-xl border border-border',
        count === 1 && 'grid grid-cols-1',
        count === 2 && 'grid grid-cols-2 gap-0.5',
        (count === 3 || count === 4) && 'grid grid-cols-2 gap-0.5'
      )}
    >
      {imgs.map((m, i) => {
        const url = m.url.startsWith('ipfs://') ? ipfsToHttp(m.url) : m.url
        const isFirst = i === 0
        const isTall = count === 3 && isFirst

        return (
          <div
            key={m.id}
            className={cn(
              'relative bg-muted',
              count === 1 && 'aspect-[16/9]',
              count === 2 && 'aspect-square',
              count >= 3 && !isTall && 'aspect-square',
              isTall && 'row-span-2 aspect-auto'
            )}
            style={isTall ? { gridRow: '1 / span 2' } : undefined}
          >
            <Image
              src={url}
              alt={m.altText ?? `Media ${i + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 600px"
            />
          </div>
        )
      })}
    </div>
  )
}

function QuoteCard({ entry }: { entry: Entry }) {
  const displayName =
    entry.authorProfile?.displayName ?? shortenAddress(entry.author, 4)
  const text = entry.content?.text ?? ''

  return (
    <div className="mt-3 rounded-xl border border-border p-3 text-sm">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="font-medium text-foreground truncate">{displayName}</span>
        <span className="text-muted-foreground text-xs shrink-0">
          @{shortenAddress(entry.author, 4)}
        </span>
      </div>
      <p className="text-muted-foreground line-clamp-2 leading-relaxed">{text}</p>
    </div>
  )
}

export function PostCard({ entry, showParent, compact, onClick }: PostCardProps) {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()

  const [expanded, setExpanded] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [quoteOpen, setQuoteOpen] = useState(false)

  // Optimistic state
  const [localReaction, setLocalReaction] = useState<ReactionType | null>(entry.viewerReaction)
  const [localTotalReactions, setLocalTotalReactions] = useState(entry.totalReactions)
  const [localReposted, setLocalReposted] = useState(entry.viewerHasReposted)
  const [localRepostCount, setLocalRepostCount] = useState(entry.repostCount)
  const [localBookmarked, setLocalBookmarked] = useState(entry.viewerHasBookmarked)
  const [isBookmarkPending, setIsBookmarkPending] = useState(false)
  const [isTxPending, setIsTxPending] = useState(false)

  const contractAddress = CONTRACT_ADDRESSES[chainId]?.social

  const isOwnPost = address?.toLowerCase() === entry.author.toLowerCase()

  const handleOptimisticReaction = useCallback(
    (reaction: ReactionType | null, delta: number) => {
      setLocalReaction(reaction)
      setLocalTotalReactions((c) => Math.max(0, c + delta))
    },
    []
  )

  const handleOptimisticRepost = useCallback((reposted: boolean) => {
    setLocalReposted(reposted)
    setLocalRepostCount((c) => Math.max(0, c + (reposted ? 1 : -1)))
  }, [])

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isConnected) {
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
      if (!res.ok) throw new Error('Bookmark request failed')
    } catch {
      setLocalBookmarked(!next)
      toast.error('Failed to update bookmark.')
    } finally {
      setIsBookmarkPending(false)
    }
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = `${window.location.origin}/post/${entry.id}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard.')
    })
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if user clicked a button/link/interactive element
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="menu"]') ||
      target.closest('[data-radix-popper-content-wrapper]')
    ) {
      return
    }
    if (onClick) {
      onClick()
    } else {
      router.push(`/post/${entry.id}`)
    }
  }

  const isHidden = entry.status === EntryStatus.HIDDEN
  const isPending = entry.status === EntryStatus.PENDING
  const isDeleted = entry.status === EntryStatus.DELETED

  const displayName =
    entry.authorProfile?.displayName ?? shortenAddress(entry.author, 4)
  const avatarUrl = entry.authorProfile?.avatarUrl
    ? ipfsToHttp(entry.authorProfile.avatarUrl)
    : undefined
  const avatarFallback = displayName.slice(0, 2).toUpperCase()

  const text = entry.content?.text ?? ''
  const needsExpand = text.length > 280 && !compact
  const displayText = needsExpand && !expanded ? text.slice(0, 280) + '…' : text

  const txUrl = entry.txHash ? getTxUrl(entry.txHash, chainId) : null

  if (isDeleted) return null

  return (
    <>
      <article
        className={cn(
          'group relative border-b border-border px-4 py-4 cursor-pointer',
          'hover:bg-accent/30 transition-colors',
          compact && 'py-3',
          isHidden && 'opacity-60'
        )}
        onClick={handleCardClick}
      >
        {/* Repost attribution */}
        {entry.entryType === EntryType.QUOTE && entry.referencedEntry && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="text-sm">🔁</span>
            <span>
              {entry.authorProfile?.displayName ?? shortenAddress(entry.author, 4)} reposted
            </span>
          </div>
        )}

        {/* Pinned indicator */}
        {entry.pinned && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Pin className="h-3 w-3" />
            <span>Pinned post</span>
          </div>
        )}

        {/* Parent context */}
        {showParent && entry.parentEntry && (
          <div className="mb-3 rounded-lg border border-border p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {entry.parentEntry.authorProfile?.displayName ??
                shortenAddress(entry.parentEntry.author, 4)}
            </span>{' '}
            {entry.parentEntry.content?.text?.slice(0, 80) ?? ''}
            {(entry.parentEntry.content?.text?.length ?? 0) > 80 && '…'}
          </div>
        )}

        <div className="flex gap-3">
          {/* Avatar */}
          <Link
            href={`/profile/${entry.author}`}
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar className="h-10 w-10 ring-1 ring-border hover:ring-primary transition-all">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="text-xs font-medium bg-muted">
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
          </Link>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0 min-w-0">
                <Link
                  href={`/profile/${entry.author}`}
                  className="font-semibold text-sm text-foreground hover:underline truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  {displayName}
                </Link>
                <span className="text-xs text-muted-foreground truncate">
                  @{shortenAddress(entry.author, 4)}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatRelativeTime(entry.createdAt)}
                </span>
                {entry.txHash && (
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <a
                      href={txUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] font-mono text-onchain hover:underline shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      title="View transaction on-chain"
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-onchain" />
                      Onchain
                    </a>
                  </>
                )}
              </div>

              {/* Dropdown menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 rounded-full p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all"
                    aria-label="Post options"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {txUrl && (
                    <DropdownMenuItem asChild>
                      <a
                        href={txUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View on-chain
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                    Copy link
                  </DropdownMenuItem>
                  {!isOwnPost && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          setReportOpen(true)
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Flag className="h-4 w-4" />
                        Report
                      </DropdownMenuItem>
                    </>
                  )}
                  {isOwnPost && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteOpen(true)
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Status badges */}
            {isPending && (
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning dark:text-yellow-300">
                <Loader2 className="h-3 w-3 animate-spin" />
                Awaiting moderation
              </div>
            )}
            {isHidden && (
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Hidden by moderator
              </div>
            )}

            {/* Content */}
            {text && (
              <div className="mb-0.5">
                <p className="text-sm leading-relaxed text-foreground break-words">
                  {formatText(displayText)}
                </p>
                {needsExpand && (
                  <button
                    type="button"
                    className="mt-1 text-xs font-medium text-primary hover:underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpanded((v) => !v)
                    }}
                  >
                    {expanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}

            {/* Media grid */}
            {!compact && entry.media.length > 0 && (
              <div onClick={(e) => e.stopPropagation()}>
                <MediaGrid media={entry.media} />
              </div>
            )}

            {/* Quoted post */}
            {entry.entryType === EntryType.QUOTE && entry.referencedEntry && !compact && (
              <div onClick={(e) => e.stopPropagation()}>
                <QuoteCard entry={entry.referencedEntry} />
              </div>
            )}

            {/* Transaction pending overlay */}
            {isTxPending && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Broadcasting…
              </div>
            )}

            {/* Reaction / action bar */}
            {!compact && (
              <div
                className="mt-2 flex items-center gap-0 -ml-2"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Reactions */}
                <ReactionButton
                  entryId={entry.id}
                  totalReactions={localTotalReactions}
                  reactionCounts={entry.reactionCounts}
                  viewerReaction={localReaction}
                  onOptimisticUpdate={handleOptimisticReaction}
                />

                {/* Comments */}
                <Link
                  href={`/post/${entry.id}`}
                  className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${entry.commentCount} comments`}
                >
                  <MessageCircle className="h-4 w-4" />
                  {entry.commentCount > 0 && (
                    <span className="tabular-nums text-xs">{formatCount(entry.commentCount)}</span>
                  )}
                </Link>

                {/* Repost */}
                <RepostButton
                  entryId={entry.id}
                  repostCount={localRepostCount}
                  viewerHasReposted={localReposted}
                  onOptimisticUpdate={handleOptimisticRepost}
                />

                {/* Quote */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setQuoteOpen(true)
                  }}
                  aria-label="Quote post"
                  className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <MessageSquareQuote className="h-4 w-4" />
                </button>

                {/* Bookmark */}
                <button
                  type="button"
                  onClick={handleBookmark}
                  disabled={isBookmarkPending}
                  aria-label={localBookmarked ? 'Remove bookmark' : 'Bookmark post'}
                  aria-pressed={localBookmarked}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors',
                    'hover:bg-primary/10 hover:text-primary',
                    localBookmarked && 'text-primary',
                    !localBookmarked && 'text-muted-foreground',
                    isBookmarkPending && 'opacity-70 cursor-wait'
                  )}
                >
                  {localBookmarked ? (
                    <BookmarkCheck className="h-4 w-4 fill-current" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                </button>

                {/* Share */}
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share post"
                  className="ml-auto flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </article>

      <DeletePostDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entryId={entry.id}
        onDeleted={() => {
          // Parent feed will handle re-fetch; just close
        }}
      />

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} entryId={entry.id} />

      <QuoteDialog open={quoteOpen} onOpenChange={setQuoteOpen} entry={entry} />
    </>
  )
}
