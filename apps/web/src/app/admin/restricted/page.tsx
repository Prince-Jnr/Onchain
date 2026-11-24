'use client'

import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'

interface RestrictedWallet {
  address: string
  restriction: 'RESTRICTED' | 'BANNED'
  since: string
}

async function fetchRestricted(): Promise<{ restricted: RestrictedWallet[] }> {
  const res = await fetch('/api/admin/restricted', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load restricted wallets')
  return res.json()
}

export default function AdminRestrictedPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin', 'restricted'], queryFn: fetchRestricted })

  return (
    <AdminShell title="Restricted wallets">
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load restricted wallets.</p>}
      {data && data.restricted.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
          <p className="mt-3 text-sm text-muted-foreground">No restricted or banned wallets.</p>
        </div>
      )}
      {data && data.restricted.map((w) => (
        <div key={w.address} className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm">{w.address}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${w.restriction === 'BANNED' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning dark:text-yellow-300'}`}>
              {w.restriction}
            </span>
            <span className="text-xs text-muted-foreground">since {new Date(w.since).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </AdminShell>
  )
}
