'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ShieldCheck, Flag, Users, Settings, TrendingUp, Eye } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const ADMIN_NAV = [
  { label: 'Dashboard', href: '/admin', icon: ShieldCheck },
  { label: 'Moderation', href: '/admin/moderation', icon: Eye },
  { label: 'Reports', href: '/admin/reports', icon: Flag },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Moderators', href: '/admin/moderators', icon: ShieldCheck },
  { label: 'Trusted', href: '/admin/trusted', icon: ShieldCheck },
  { label: 'Restricted', href: '/admin/restricted', icon: Users },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
  { label: 'Analytics', href: '/admin/analytics', icon: TrendingUp },
  { label: 'Audit', href: '/admin/audit', icon: ShieldCheck },
]

export function AdminShell({ children, title, actions }: {
  children: React.ReactNode
  title: string
  actions?: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  void router

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl border-x border-border px-4">
      <aside className="hidden w-56 shrink-0 border-r border-border pt-8 sm:block">
        <nav className="flex flex-col gap-0.5">
          {ADMIN_NAV.map(({ label, href, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className={cn('h-4 w-4', active && 'text-primary')} />
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 pt-8 pb-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  )
}

export function AdminStatCard({ label, value, hint, icon: Icon }: {
  label: string
  value: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-lg font-bold">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
    </div>
  )
}
