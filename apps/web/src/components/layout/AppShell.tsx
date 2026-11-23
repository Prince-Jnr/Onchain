'use client'

import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { RightSidebar } from './RightSidebar'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
  /** Rendered in the right sidebar slot on desktop. Defaults to <RightSidebar /> if omitted. */
  rightSidebar?: ReactNode | null
  /** Pass false to remove the right sidebar entirely */
  showRightSidebar?: boolean
  /** Unread notification count forwarded to Sidebar and MobileNav */
  unreadNotifications?: number
  className?: string
}

export function AppShell({
  children,
  rightSidebar,
  showRightSidebar = true,
  unreadNotifications = 0,
  className,
}: AppShellProps) {
  const rightSlot =
    rightSidebar !== undefined ? rightSidebar : <RightSidebar />

  return (
    <div className={cn('min-h-screen bg-background', className)}>
      {/*
        Desktop layout: three columns
          col-1: 280px left sidebar (hidden on mobile)
          col-2: 1fr main content
          col-3: 320px right sidebar (hidden on mobile, hidden if showRightSidebar=false)
      */}
      <div
        className={cn(
          'mx-auto max-w-screen-xl',
          showRightSidebar && rightSlot
            ? 'md:grid md:grid-cols-[280px_1fr_320px]'
            : 'md:grid md:grid-cols-[280px_1fr]'
        )}
      >
        {/* Left sidebar — desktop only */}
        <div className="hidden md:block md:sticky md:top-0 md:h-screen md:overflow-y-auto border-r border-border">
          <Sidebar unreadNotifications={unreadNotifications} />
        </div>

        {/* Main content */}
        <main className="min-h-screen pb-20 md:pb-0 border-r border-border">
          {children}
        </main>

        {/* Right sidebar — desktop only, optional */}
        {showRightSidebar && rightSlot && (
          <div className="hidden md:block md:sticky md:top-0 md:h-screen md:overflow-y-auto">
            {rightSlot}
          </div>
        )}
      </div>

      {/* Mobile bottom nav */}
      <MobileNav unreadNotifications={unreadNotifications} />
    </div>
  )
}
