'use client'

import Link from 'next/link'
import { useAccount, useChainId } from 'wagmi'
import { Hash } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { NetworkBadge } from '@/components/wallet/NetworkBadge'
import { shortenAddress, formatCount } from '@/lib/utils'
import { cn } from '@/lib/utils'

// Static placeholder data — real data will come from API hooks once
// the feed/follow features are wired up.
const SUGGESTED_PROFILES = [
  { address: '0x1234567890123456789012345678901234567890', displayName: null, postCount: 42 },
  { address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', displayName: null, postCount: 17 },
  { address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', displayName: null, postCount: 91 },
]

const TRENDING_HASHTAGS = [
  { tag: 'base', count: 1240 },
  { tag: 'web3', count: 876 },
  { tag: 'defi', count: 643 },
  { tag: 'nft', count: 521 },
  { tag: 'onchain', count: 408 },
]

interface RightSidebarProps {
  className?: string
}

export function RightSidebar({ className }: RightSidebarProps) {
  const { isConnected } = useAccount()
  const chainId = useChainId()

  return (
    <aside
      className={cn(
        'flex h-full flex-col gap-6 py-6 px-4 overflow-y-auto',
        className
      )}
    >
      {/* Who to follow */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Who to follow
        </h2>
        <div className="space-y-3">
          {SUGGESTED_PROFILES.map(({ address, postCount }) => (
            <div key={address} className="flex items-center gap-3">
              <Avatar size="sm">
                <AvatarFallback className="text-xs">
                  {address.slice(2, 4).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col min-w-0">
                <Link
                  href={`/profile/${address}`}
                  className="font-mono text-xs font-medium truncate hover:text-primary transition-colors"
                >
                  {shortenAddress(address)}
                </Link>
                <span className="text-[10px] text-muted-foreground">
                  {formatCount(postCount)} posts
                </span>
              </div>
              <Button size="sm" variant="outline" className="h-7 px-3 text-xs shrink-0">
                Follow
              </Button>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Trending hashtags */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Trending
        </h2>
        <div className="space-y-1">
          {TRENDING_HASHTAGS.map(({ tag, count }, i) => (
            <Link
              key={tag}
              href={`/hashtag/${tag}`}
              className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent transition-colors group"
            >
              <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
              <Hash className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              <div className="flex flex-1 flex-col min-w-0">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {tag}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatCount(count)} posts
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Separator />

      {/* Network status */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Network
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-zinc-400'
            )}
          />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        {isConnected && (
          <div className="mt-2">
            <NetworkBadge />
          </div>
        )}
      </section>

      {/* Footer links */}
      <div className="mt-auto pt-4">
        <Separator className="mb-4" />
        <nav className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Footer">
          {[
            { label: 'About', href: '/about' },
            { label: 'Terms', href: '/terms' },
            { label: 'Privacy', href: '/privacy' },
            { label: 'Guidelines', href: '/guidelines' },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
        <p className="mt-2 text-[10px] text-muted-foreground">
          © {new Date().getFullYear()} ONCHAIN
        </p>
      </div>
    </aside>
  )
}
