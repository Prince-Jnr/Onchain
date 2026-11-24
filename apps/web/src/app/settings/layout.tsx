import type { Metadata } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Wallet, Bell, ArrowLeft } from 'lucide-react'

const TABS: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Profile', href: '/settings/profile', icon: User },
  { label: 'Wallet', href: '/settings/wallet', icon: Wallet },
  { label: 'Notifications', href: '/settings/notifications', icon: Bell },
]

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your ONCHAIN settings.',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 min-w-0 border-x border-border max-w-2xl mx-auto">
        <div className="border-b border-border px-4 pt-6">
          <div className="flex items-center gap-2">
            <Link
              href="/feed"
              className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          </div>
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
        </div>
        {children}
      </main>
    </div>
  )
}
