'use client'

import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, Flag, Users, Settings, TrendingUp, Eye, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { AdminShell, AdminStatCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

interface Stats {
  totalUsers: number
  totalPosts: number
  totalComments: number
  totalReactions: number
  totalReposts: number
  pendingModeration: number
  openReports: number
  activeUsers24h: number
  indexerStatus: 'healthy' | 'degraded' | 'down'
  lastIndexedBlock: number
}

async function fetchStats(): Promise<Stats> {
  const res = await fetch('/api/admin/stats', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load stats')
  return res.json()
}

export default function AdminDashboard() {
  const { isAuthenticated, address } = useAuth()
  const { data: stats, isLoading, isError } = useQuery({ queryKey: ['admin', 'stats'], queryFn: fetchStats })

  if (!isAuthenticated || !address) {
    return (
      <AdminShell title="Dashboard">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border p-8 text-center">
          <ShieldCheck className="h-10 w-10 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            Admin access required. Connect your wallet and sign in.
          </p>
          <Button asChild className="rounded-full">
            <Link href="/feed">Connect wallet</Link>
          </Button>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell title="Dashboard">
      {isLoading && <p className="text-sm text-muted-foreground">Loading stats…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load stats.</p>}
      {stats && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <AdminStatCard label="Total users" value={stats.totalUsers.toLocaleString()} icon={Users} />
            <AdminStatCard label="Active 24h" value={stats.activeUsers24h.toLocaleString()} icon={Users} />
            <AdminStatCard label="Total posts" value={stats.totalPosts.toLocaleString()} icon={TrendingUp} />
            <AdminStatCard label="Reactions" value={stats.totalReactions.toLocaleString()} icon={Flag} />
            <AdminStatCard label="Pending moderation" value={stats.pendingModeration.toLocaleString()} icon={Eye} />
            <AdminStatCard label="Open reports" value={stats.openReports.toLocaleString()} icon={Flag} />
            <AdminStatCard
              label="Indexer"
              value={stats.indexerStatus}
              icon={AlertTriangle}
              hint={stats.lastIndexedBlock ? `Last block #${stats.lastIndexedBlock}` : 'Not running'}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/admin/moderation" className="col-span-1 rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
              <p className="text-sm font-semibold">Moderation queue</p>
              <p className="mt-1 text-xs text-muted-foreground">Review pending content</p>
            </Link>
            <Link href="/admin/reports" className="col-span-1 rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
              <p className="text-sm font-semibold">Reports</p>
              <p className="mt-1 text-xs text-muted-foreground">Review, resolve, dismiss</p>
            </Link>
            <Link href="/admin/users" className="col-span-1 rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
              <p className="text-sm font-semibold">Users</p>
              <p className="mt-1 text-xs text-muted-foreground">Manage wallets &amp; roles</p>
            </Link>
            <Link href="/admin/settings" className="col-span-1 rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
              <p className="text-sm font-semibold">Settings</p>
              <p className="mt-1 text-xs text-muted-foreground">Platform configuration</p>
            </Link>
          </div>
        </>
      )}
    </AdminShell>
  )
}
