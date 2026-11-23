'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FollowButton } from './FollowButton'
import { cn, shortenAddress, ipfsToHttp } from '@/lib/utils'
import { Profile } from '@onchain/shared'
import { useAccount } from 'wagmi'

interface ProfileCardProps {
  profile: Profile
  isFollowing?: boolean
  compact?: boolean
  className?: string
}

export function ProfileCard({ profile, isFollowing = false, compact = false, className }: ProfileCardProps) {
  const { address } = useAccount()
  const isOwnProfile = address?.toLowerCase() === profile.wallet.toLowerCase()

  const displayName = profile.displayName ?? shortenAddress(profile.wallet, 4)
  const avatarUrl = profile.avatarUrl ? ipfsToHttp(profile.avatarUrl) : undefined
  const avatarFallback = displayName.slice(0, 2).toUpperCase()

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl p-3',
        'border border-border bg-card hover:bg-accent/40 transition-colors',
        className
      )}
    >
      <Link href={`/profile/${profile.wallet}`} className="shrink-0">
        <Avatar className={cn('ring-1 ring-border hover:ring-primary transition-all', compact ? 'h-9 w-9' : 'h-11 w-11')}>
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="text-xs font-medium bg-muted">
            {avatarFallback}
          </AvatarFallback>
        </Avatar>
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/profile/${profile.wallet}`}
              className="block font-semibold text-sm text-foreground hover:underline truncate"
            >
              {displayName}
            </Link>
            <span className="text-xs text-muted-foreground font-mono">
              @{shortenAddress(profile.wallet, 4)}
            </span>
          </div>

          {!isOwnProfile && (
            <FollowButton
              targetAddress={profile.wallet}
              initialIsFollowing={isFollowing}
              size="sm"
              className="shrink-0"
            />
          )}
        </div>

        {!compact && profile.bio && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {profile.bio}
          </p>
        )}

        {!compact && (
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground font-semibold">{profile.followerCount}</strong> followers
            </span>
            <span>
              <strong className="text-foreground font-semibold">{profile.postCount}</strong> posts
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
