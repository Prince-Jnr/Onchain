'use client'

import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Users, MessageCircle, ShieldCheck } from 'lucide-react'
import { AdminShell, AdminStatCard } from '@/components/admin/AdminShell'

async function fetchStats(): Promise<Record<string, number>> {
  const res = await fetch('/api/admin/stats', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load stats')
  return res.json() as Promise<Record<string, number>>
}

export default function AdminAnalyticsPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin', 'analytics'], queryFn: fetchStats })

  const cards = [
    { label: 'Total users', key: 'totalUsers', icon: Users },
    { label: 'Posts', key: 'totalPosts', icon: MessageCircle },
    { label: 'Reactions', key: 'totalReactions', icon: TrendingUp },
    { label: 'Pending moderation', key: 'pendingModeration', icon: ShieldCheck },
    { label: 'Open reports', key: 'openReports', icon: TrendingUp },
    { label: 'Active users (24h)', key: 'activeUsers24h', icon: Users },
  ] as const

  return (
    <AdminShell title="Analytics" actions={null}>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load analytics.</p>}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map(({ label, key, icon }) => (
            <AdminStatCard key={key} label={label} value={(data[key] ?? 0).toLocaleString()} icon={icon} />
          ))}
        </div>
      )}
    </AdminShell>
  )
}
