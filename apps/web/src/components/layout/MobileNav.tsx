'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Compass, PenSquare, Bell, User } from 'lucide-react'
import { useAccount } from 'wagmi'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  unreadNotifications?: number
}

export function MobileNav({ unreadNotifications = 0 }: MobileNavProps) {
  const pathname = usePathname()
  const { address } = useAccount()
  const [composeOpen, setComposeOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const profileHref = address ? `/profile/${address}` : '/profile'

  const isActive = (href: string) => {
    if (href === '/feed') return pathname === '/feed' || pathname === '/'
    return pathname.startsWith(href)
  }

  type TabItem = {
    label: string
    href: string
    icon: React.ComponentType<{ className?: string }>
    badge?: boolean
  }

  const TAB_ITEMS: TabItem[] = [
    { label: 'Home', href: '/feed', icon: Home },
    { label: 'Explore', href: '/explore', icon: Compass },
    { label: 'Notifications', href: '/notifications', icon: Bell, badge: true },
    { label: 'Profile', href: profileHref, icon: User },
  ]

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="flex h-16 items-center justify-around px-2">
          {/* First two tabs */}
          {TAB_ITEMS.slice(0, 2).map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors',
                isActive(href) ? 'text-primary' : 'text-muted-foreground'
              )}
              aria-label={label}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          ))}

          {/* Compose button — center, prominent */}
          <button
            onClick={() => setComposeOpen(true)}
            aria-label="Compose post"
            className="flex flex-1 flex-col items-center justify-center"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95">
              <PenSquare className="h-5 w-5" />
            </span>
          </button>

          {/* Last two tabs */}
          {TAB_ITEMS.slice(2).map(({ label, href, icon: Icon, badge }) => {
            const count = badge ? unreadNotifications : 0
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors',
                  isActive(href) ? 'text-primary' : 'text-muted-foreground'
                )}
                aria-label={label}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground leading-none">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Compose dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <Textarea
              placeholder="What are you leaving behind?"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              maxLength={280}
              autoFocus
              className="resize-none text-base"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {draft.length}/280
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraft('')
                    setComposeOpen(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={draft.trim().length === 0}
                  onClick={() => {
                    // Submission is handled by the full post-creation flow;
                    // this draft state is passed via URL or context.
                    // For now, navigate to /feed with the draft pre-filled.
                    window.location.href = `/feed?draft=${encodeURIComponent(draft)}`
                  }}
                >
                  Post
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
