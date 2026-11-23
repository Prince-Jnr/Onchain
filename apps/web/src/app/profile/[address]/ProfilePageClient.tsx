'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount, useChainId } from 'wagmi'
import {
  Globe,
  AtSign,
  GitBranch,
  ExternalLink,
  Copy,
  Check,
  ArrowLeft,
  MessageCircle,
  Users,
  FileText,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PostCard } from '@/components/post/PostCard'
import { PostSkeletonList } from '@/components/post/PostSkeleton'
import { FollowButton } from '@/components/profile/FollowButton'
import {
  Profile,
  Entry,
  FeedPage,
  PROFILE_FEED_PAGE_SIZE,
  getAddressUrl,
  shortenAddress,
  formatRelativeTime,
  ipfsToHttp,
} from '@onchain/shared'
import { cn } from '@/lib/utils'
import { formatCount } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

type ProfileTab = 'posts' | 'replies' | 'reposts' | 'quotes' | 'likes'

const TABS: { value: ProfileTab; label: string }[] = [
  { value: 'posts', label: 'Posts' },
  { value: 'replies', label: 'Replies' },
  { value: 'reposts', label: 'Reposts' },
  { value: 'quotes', label: 'Quotes' },
  { value: 'likes', label: 'Likes' },
]

const BADGE_LABELS: Record<string, string> = {
  EARLY_CONTRIBUTOR: 'Early Contributor',
  FOUNDING_MEMBER: 'Founding Member',
  ACTIVE_PARTICIPANT: 'Active Participant',
  TRUSTED_CONTRIBUTOR: 'Trusted Contributor',
  VERIFIED_MODERATOR: 'Verified Moderator',
  CREATOR: 'Creator',
  COMMUNITY_MEMBER: 'Community Member',
}

const BADGE_ICONS: Record<string, string> = {
  EARLY_CONTRIBUTOR: '⚡',
  FOUNDING_MEMBER: '🏛',
  ACTIVE_PARTICIPANT: '🔥',
  TRUSTED_CONTRIBUTOR: '✅',
  VERIFIED_MODERATOR: '🛡',
  CREATOR: '✍',
  COMMUNITY_MEMBER: '🤝',
}

async function fetchProfile(address: string): Promise<Profile> {
  const res = await fetch(`/api/profiles/${address}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`Profile not found (${res.status})`)
  const data = await res.json() as { profile: Profile }
  return data.profile
}

async function fetchFollowStatus(address: string): Promise<{ isFollowing: boolean }> {
  const res = await fetch(`/api/follows/${address}/status`, { credentials: 'include' })
  if (!res.ok) return { isFollowing: false }
  return res.json() as Promise<{ isFollowing: boolean }>
}

async function fetchProfileFeed(
  address: string,
  tab: ProfileTab,
  cursor: string | null
): Promise<FeedPage> {
  const params = new URLSearchParams({
    type: tab,
    limit: String(PROFILE_FEED_PAGE_SIZE),
  })
  if (cursor) params.set('cursor', cursor)
  const res = await fetch(`/api/profiles/${address}/feed?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load posts')
  return res.json() as Promise<FeedPage>
}

function BannerSkeleton() {
  return <div className="h-48 w-full bg-gradient-to-br from-primary/20 to-primary/5 animate-pulse" />
}

function ProfileSkeleton() {
  return (
    <div>
      <BannerSkeleton />
      <div className="relative px-4 pb-4">
        <div className="-mt-10 mb-4 flex items-end justify-between">
          <Skeleton className="h-20 w-20 rounded-full ring-4 ring-background" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
        <Skeleton className="h-5 w-40 mb-1" />
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-3/4 mb-4" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  )
}

interface ProfileHeaderProps {
  profile: Profile
  isFollowing: boolean
  onFollowChange: (val: boolean) => void
}

function ProfileHeader({ profile, isFollowing, onFollowChange }: ProfileHeaderProps) {
  const { address: connectedAddress } = useAccount()
  const chainId = useChainId()
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const isOwnProfile = connectedAddress?.toLowerCase() === profile.wallet.toLowerCase()
  const explorerUrl = getAddressUrl(profile.wallet, chainId)
  const avatarUrl = profile.avatarUrl ? ipfsToHttp(profile.avatarUrl) : undefined
  const bannerUrl = profile.bannerUrl ? ipfsToHttp(profile.bannerUrl) : undefined
  const displayName = profile.displayName ?? shortenAddress(profile.wallet, 4)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(profile.wallet)
    setCopied(true)
    toast.success('Address copied.')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      {/* Back button */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm truncate">{displayName}</h1>
            <p className="text-xs text-muted-foreground">{formatCount(profile.postCount)} posts</p>
          </div>
        </div>
      </div>

      {/* Banner */}
      <div className="relative h-48 w-full overflow-hidden">
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt="Profile banner"
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/30 via-primary/10 to-background" />
        )}
      </div>

      {/* Avatar + action row */}
      <div className="relative px-4">
        <div className="-mt-10 mb-4 flex items-end justify-between gap-3">
          <div className="relative">
            <Avatar className="h-20 w-20 ring-4 ring-background shadow-lg">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="text-xl font-bold bg-muted">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {profile.badges.some((b) => b.type === 'VERIFIED_MODERATOR') && (
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs shadow">
                🛡
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isOwnProfile ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full font-semibold"
                asChild
              >
                <Link href="/settings/profile">Edit Profile</Link>
              </Button>
            ) : (
              <FollowButton
                targetAddress={profile.wallet}
                initialIsFollowing={isFollowing}
                onFollowChange={onFollowChange}
              />
            )}
          </div>
        </div>

        {/* Identity */}
        <div className="mb-3">
          <h2 className="text-xl font-bold text-foreground leading-tight">{displayName}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-muted-foreground font-mono">
              @{shortenAddress(profile.wallet, 4)}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Copy wallet address"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="View on block explorer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mb-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {profile.bio}
          </p>
        )}

        {/* Links */}
        {(profile.website || profile.twitterHandle || profile.githubHandle || profile.registeredAt) && (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {profile.website && (
              <a
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <Globe className="h-3.5 w-3.5" />
                <span className="truncate max-w-[180px]">
                  {profile.website.replace(/^https?:\/\//, '')}
                </span>
              </a>
            )}
            {profile.twitterHandle && (
              <a
                href={`https://twitter.com/${profile.twitterHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-[#1DA1F2] transition-colors"
              >
                <AtSign className="h-3.5 w-3.5" />
                @{profile.twitterHandle}
              </a>
            )}
            {profile.githubHandle && (
              <a
                href={`https://github.com/${profile.githubHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <GitBranch className="h-3.5 w-3.5" />
                {profile.githubHandle}
              </a>
            )}
            {profile.registeredAt && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Joined {formatRelativeTime(profile.registeredAt)}
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="mb-3 flex items-center gap-5 text-sm">
          <Link
            href={`/profile/${profile.wallet}/following`}
            className="flex items-center gap-1.5 hover:underline text-foreground"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            <strong className="font-semibold">{formatCount(profile.followingCount)}</strong>
            <span className="text-muted-foreground">Following</span>
          </Link>
          <Link
            href={`/profile/${profile.wallet}/followers`}
            className="flex items-center gap-1.5 hover:underline text-foreground"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            <strong className="font-semibold">{formatCount(profile.followerCount)}</strong>
            <span className="text-muted-foreground">Followers</span>
          </Link>
          <div className="flex items-center gap-1.5 text-foreground">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <strong className="font-semibold">{formatCount(profile.postCount)}</strong>
            <span className="text-muted-foreground">Posts</span>
          </div>
        </div>

        {/* Badges */}
        {profile.badges.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {profile.badges.map((badge) => (
              <Badge
                key={badge.id}
                variant="secondary"
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                title={`${BADGE_LABELS[badge.type] ?? badge.type} — earned ${formatRelativeTime(badge.earnedAt)}`}
              >
                <span className="mr-1">{BADGE_ICONS[badge.type] ?? '🏅'}</span>
                {BADGE_LABELS[badge.type] ?? badge.type}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface ProfileFeedProps {
  address: string
  tab: ProfileTab
}

function ProfileFeed({ address, tab }: ProfileFeedProps) {
  const loaderRef = useState<HTMLDivElement | null>(null)

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
    queryKey: ['profile-feed', address, tab],
    queryFn: ({ pageParam }) => fetchProfileFeed(address, tab, pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 60_000,
  })

  // Infinite scroll
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '400px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinel, fetchNextPage, hasNextPage, isFetchingNextPage])

  const allEntries = data?.pages.flatMap((p) => p.entries) ?? []

  if (isLoading) return <PostSkeletonList count={5} />

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Failed to load posts</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Something went wrong.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!allEntries.length) {
    const emptyMessages: Record<ProfileTab, string> = {
      posts: "No posts yet. Be the first to know when they post.",
      replies: 'No replies yet.',
      reposts: 'No reposts yet.',
      quotes: 'No quotes yet.',
      likes: 'No liked posts yet.',
    }
    return (
      <div className="flex flex-col items-center gap-3 py-20 px-4 text-center">
        <span className="text-4xl">{tab === 'likes' ? '❤' : '✍'}</span>
        <p className="font-medium text-foreground">{emptyMessages[tab]}</p>
      </div>
    )
  }

  return (
    <div>
      {allEntries.map((entry: Entry) => (
        <PostCard key={entry.id} entry={entry} />
      ))}
      <div ref={setSentinel} className="h-1" />
      {isFetchingNextPage && <PostSkeletonList count={3} />}
      {!hasNextPage && allEntries.length > 0 && !isFetchingNextPage && (
        <p className="py-10 text-center text-sm text-muted-foreground">End of posts.</p>
      )}
    </div>
  )
}

interface ProfilePageClientProps {
  address: string
  initialProfile: Profile | null
}

export function ProfilePageClient({ address, initialProfile }: ProfilePageClientProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts')
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
  } = useQuery({
    queryKey: ['profile', address],
    queryFn: () => fetchProfile(address),
    initialData: initialProfile ?? undefined,
    staleTime: 60_000,
  })

  const { data: followStatus } = useQuery({
    queryKey: ['follow-status', address],
    queryFn: () => fetchFollowStatus(address),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  const isFollowing = followStatus?.isFollowing ?? false
  const handleFollowChange = (next: boolean) => {
    queryClient.setQueryData(['follow-status', address], { isFollowing: next })
  }

  if (profileLoading) return <ProfileSkeleton />

  if (profileError || !profile) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 px-4 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <div>
          <p className="font-semibold text-lg">Profile not found</p>
          <p className="text-sm text-muted-foreground mt-1">
            This wallet address hasn&apos;t registered a profile yet.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <ProfileHeader
        profile={profile}
        isFollowing={isFollowing}
        onFollowChange={handleFollowChange}
      />

      {/* Tabs */}
      <div className="sticky top-14 z-20 border-b border-border bg-background/80 backdrop-blur-sm">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProfileTab)}>
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

      {/* Feed */}
      <ProfileFeed address={address} tab={activeTab} />
    </div>
  )
}
