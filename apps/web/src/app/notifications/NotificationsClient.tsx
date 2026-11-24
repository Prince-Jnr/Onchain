'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications'
import {
  Bell,
  MessageCircle,
  AtSign,
  Heart,
  UserPlus,
  RefreshCw,
  Repeat2,
  Quote,
  AlertCircle,
  CheckCheck,
  Megaphone,
} from 'lucide-react'
import {
  Notification,
  NotificationType,
  NOTIFICATIONS_PAGE_SIZE,
  shortenAddress,
  formatRelativeTime,
  ipfsToHttp,
} from '@onchain/shared'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type NotificationFilter = 'all' | 'replies' | 'mentions' | 'reactions' | 'follows'

const FILTER_TABS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'replies', label: 'Replies' },
  { value: 'mentions', label: 'Mentions' },
  { value: 'reactions', label: 'Reactions' },
  { value: 'follows', label: 'Follows' },
]

const FILTER_TO_TYPES: Record<NotificationFilter, NotificationType[]> = {
  all: [],
  replies: [NotificationType.REPLY, NotificationType.COMMENT],
  mentions: [NotificationType.MENTION],
  reactions: [NotificationType.REACTION],
  follows: [NotificationType.FOLLOW],
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case NotificationType.REPLY:
    case NotificationType.COMMENT:
      return <MessageCircle className="h-4 w-4 text-primary" />
    case NotificationType.MENTION:
      return <AtSign className="h-4 w-4 text-info" />
    case NotificationType.REACTION:
      return <Heart className="h-4 w-4 text-destructive" />
    case NotificationType.FOLLOW:
      return <UserPlus className="h-4 w-4 text-success" />
    case NotificationType.REPOST:
      return <Repeat2 className="h-4 w-4 text-success" />
    case NotificationType.QUOTE:
      return <Quote className="h-4 w-4 text-warning" />
    case NotificationType.MODERATION:
      return <AlertCircle className="h-4 w-4 text-warning" />
    case NotificationType.ADMIN_ANNOUNCEMENT:
      return <Megaphone className="h-4 w-4 text-primary" />
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />
  }
}

function getNotificationText(notification: Notification): string {
  const actor = notification.actor?.displayName ?? shortenAddress(notification.actor?.wallet ?? '0x0000', 4)

  switch (notification.type) {
    case NotificationType.REPLY:
      return `${actor} replied to your post`
    case NotificationType.COMMENT:
      return `${actor} commented on your post`
    case NotificationType.MENTION:
      return `${actor} mentioned you in a post`
    case NotificationType.REACTION:
      return `${actor} reacted to your post`
    case NotificationType.FOLLOW:
      return `${actor} followed you`
    case NotificationType.REPOST:
      return `${actor} reposted your post`
    case NotificationType.QUOTE:
      return `${actor} quoted your post`
    case NotificationType.MODERATION:
      return `A moderator took action on your post`
    case NotificationType.ADMIN_ANNOUNCEMENT:
      return `New announcement from ONCHAIN`
    default:
      return `New activity`
  }
}

interface NotificationsPage {
  notifications: Notification[]
  nextCursor: string | null
  unreadCount: number
}

async function fetchNotifications(
  filter: NotificationFilter,
  cursor: string | null
): Promise<NotificationsPage> {
  const params = new URLSearchParams({ limit: String(NOTIFICATIONS_PAGE_SIZE) })
  if (cursor) params.set('cursor', cursor)
  if (filter !== 'all') {
    const types = FILTER_TO_TYPES[filter]
    types.forEach((t) => params.append('type', t))
  }
  const res = await fetch(`/api/notifications?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load notifications')
  return res.json() as Promise<NotificationsPage>
}

async function markAllRead(): Promise<void> {
  const res = await fetch('/api/notifications/read-all', {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to mark notifications as read')
}

async function markOneRead(id: string): Promise<void> {
  await fetch(`/api/notifications/${id}/read`, {
    method: 'POST',
    credentials: 'include',
  })
}

function NotificationSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-4 border-b border-border">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification
  onRead: (id: string) => void
}) {
  const actorAvatarUrl = notification.actor?.avatarUrl
    ? ipfsToHttp(notification.actor.avatarUrl)
    : undefined
  const actorName = notification.actor?.displayName ?? shortenAddress(notification.actor?.wallet ?? '0x0000', 4)
  const previewText = notification.targetEntry?.content?.text?.slice(0, 100)

  const href = notification.targetEntry
    ? `/post/${notification.targetEntry.id}`
    : notification.actor
    ? `/profile/${notification.actor.wallet}`
    : '#'

  return (
    <Link
      href={href}
      className={cn(
        'flex gap-3 px-4 py-4 border-b border-border transition-colors',
        'hover:bg-accent/40',
        !notification.read && 'bg-primary/5'
      )}
      onClick={() => {
        if (!notification.read) onRead(notification.id)
      }}
    >
      {/* Unread indicator */}
      <div className="relative shrink-0">
        {notification.actor ? (
          <Avatar className="h-10 w-10 ring-1 ring-border">
            <AvatarFallback className="text-xs font-medium bg-muted">
              {actorName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
            {actorAvatarUrl && <AvatarFallback>{actorName.slice(0, 2)}</AvatarFallback>}
          </Avatar>
        ) : (
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            {getNotificationIcon(notification.type)}
          </div>
        )}
        {!notification.read && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Icon + text */}
        <div className="flex items-start gap-2 mb-1">
          <span className="mt-0.5 shrink-0">{getNotificationIcon(notification.type)}</span>
          <p className="text-sm text-foreground leading-snug">
            {getNotificationText(notification)}
          </p>
        </div>

        {/* Content preview */}
        {previewText && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-1 pl-6">
            &quot;{previewText}{(notification.targetEntry?.content?.text?.length ?? 0) > 100 ? '…' : ''}&quot;
          </p>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground pl-6">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
    </Link>
  )
}

export function NotificationsClient() {
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all')
  const [localUnread, setLocalUnread] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()
  useRealtimeNotifications()

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
    queryKey: ['notifications', activeFilter],
    queryFn: ({ pageParam }) => fetchNotifications(activeFilter, pageParam as string | null),
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

  // Track which notifications are locally marked as read
  const handleMarkOneRead = useCallback((id: string) => {
    setLocalUnread((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    markOneRead(id).catch(() => {})
  }, [])

  const handleMarkAllRead = async () => {
    try {
      await markAllRead()
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('All notifications marked as read.')
    } catch {
      toast.error('Failed to mark all as read.')
    }
  }

  const allNotifications = data?.pages.flatMap((p) => p.notifications) ?? []
  const totalUnread = data?.pages[0]?.unreadCount ?? 0

  const emptyMessages: Record<NotificationFilter, string> = {
    all: "You're all caught up.",
    replies: 'No replies yet.',
    mentions: 'No mentions yet.',
    reactions: 'No reactions yet.',
    follows: 'No new followers yet.',
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        action={
          totalUnread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-primary hover:text-primary text-xs font-medium gap-1.5"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {/* Filter tabs */}
      <div className="sticky top-14 z-20 border-b border-border bg-background/80 backdrop-blur-sm">
        <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as NotificationFilter)}>
          <TabsList className="h-10 w-full rounded-none border-0 bg-transparent p-0 justify-start overflow-x-auto">
            {FILTER_TABS.map(({ value, label }) => (
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

      {/* Loading */}
      {isLoading && (
        <>
          {Array.from({ length: 6 }).map((_, i) => (
            <NotificationSkeleton key={i} />
          ))}
        </>
      )}

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Failed to load notifications</p>
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
      {!isLoading && !isError && allNotifications.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 px-4 text-center">
          <Bell className="h-12 w-12 text-muted-foreground" />
          <p className="font-medium text-foreground">{emptyMessages[activeFilter]}</p>
          <p className="text-sm text-muted-foreground">
            New notifications will appear here when others interact with you.
          </p>
        </div>
      )}

      {/* Notifications list */}
      {!isLoading && !isError && allNotifications.length > 0 && (
        <div>
          {allNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={{
                ...notification,
                read: notification.read || localUnread.has(notification.id),
              }}
              onRead={handleMarkOneRead}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={setSentinel} className="h-1" />

      {isFetchingNextPage && (
        <>
          {Array.from({ length: 3 }).map((_, i) => (
            <NotificationSkeleton key={`loading-more-${i}`} />
          ))}
        </>
      )}

      {!hasNextPage && allNotifications.length > 0 && !isFetchingNextPage && (
        <p className="py-10 text-center text-sm text-muted-foreground">All caught up.</p>
      )}
    </div>
  )
}
