'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Wallet, Bell } from 'lucide-react'

const TABS: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Profile', href: '/settings/profile', icon: User },
  { label: 'Wallet', href: '/settings/wallet', icon: Wallet },
  { label: 'Notifications', href: '/settings/notifications', icon: Bell },
]

export function SettingsNav() {
  const pathname = usePathname()
  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <nav className="mt-3 flex gap-1" aria-label="Settings tabs">
      {TABS.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            isActive(href)
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
