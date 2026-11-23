'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount } from 'wagmi'
import {
  Home,
  Compass,
  TrendingUp,
  Bell,
  Bookmark,
  User,
  Settings,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { WalletButton } from '@/components/wallet/WalletButton'
import { cn, shortenAddress } from '@/lib/utils'

const NAV_ITEMS: Array<{
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: boolean
}> = [
  { label: 'Home', href: '/feed', icon: Home },
  { label: 'Explore', href: '/explore', icon: Compass },
  { label: 'Trending', href: '/trending', icon: TrendingUp },
  { label: 'Notifications', href: '/notifications', icon: Bell, badge: true },
  { label: 'Bookmarks', href: '/bookmarks', icon: Bookmark },
  { label: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarProps {
  unreadNotifications?: number
}

export function Sidebar({ unreadNotifications = 0 }: SidebarProps) {
  const pathname = usePathname()
  const { address, isConnected } = useAccount()

  const profileHref = address ? `/profile/${address}` : '/profile'

  const isActive = (href: string) => {
    if (href === '/feed') return pathname === '/feed' || pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex h-full flex-col px-4 py-6">
      {/* Logo */}
      <Link
        href="/"
        className="mb-8 flex flex-col gap-0.5 group"
      >
        <span className="text-xl font-black tracking-tight text-foreground group-hover:text-primary transition-colors">
          ONCHAIN
        </span>
        <span className="text-[11px] text-muted-foreground leading-none font-medium tracking-wide uppercase">
          Leave something behind.
        </span>
      </Link>

      {/* Main navigation */}
      <nav className="flex-1 space-y-0.5" aria-label="Main navigation">
        {NAV_ITEMS.map(({ label, href, icon: Icon, badge }) => {
          const active = isActive(href)
          const count = badge ? unreadNotifications : 0

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <span className="relative">
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform group-hover:scale-105',
                    active ? 'text-primary' : 'text-current'
                  )}
                />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground leading-none">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </span>
              <span>{label}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}

        {/* Profile — depends on wallet address */}
        <Link
          href={profileHref}
          className={cn(
            'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname.startsWith('/profile')
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <User
            className={cn(
              'h-5 w-5 transition-transform group-hover:scale-105',
              pathname.startsWith('/profile') ? 'text-primary' : 'text-current'
            )}
          />
          <span>Profile</span>
          {pathname.startsWith('/profile') && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </Link>
      </nav>

      {/* Bottom: wallet identity + connect */}
      <div className="mt-6 space-y-3 border-t border-border pt-5">
        {isConnected && address ? (
          <div className="flex items-center gap-2.5">
            <Avatar size="sm">
              <AvatarFallback className="text-xs">
                {address.slice(2, 4).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="font-mono text-xs font-medium text-foreground truncate">
                {shortenAddress(address)}
              </span>
              <span className="text-[10px] text-muted-foreground">Connected</span>
            </div>
          </div>
        ) : null}
        <WalletButton className="w-full justify-start" />
      </div>
    </aside>
  )
}
