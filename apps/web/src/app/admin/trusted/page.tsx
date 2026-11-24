'use client'

import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'

async function fetchTrusted(): Promise<{ trusted: string[] }> {
  const res = await fetch('/api/admin/trusted', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load trusted wallets')
  return res.json()
}

export default function AdminTrustedPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin', 'trusted'], queryFn: fetchTrusted })

  return (
    <AdminShell title="Trusted wallets">
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load trusted wallets.</p>}
      {data && data.trusted.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
          <p className="mt-3 text-sm text-muted-foreground">No trusted wallets yet.</p>
        </div>
      )}
      {data && data.trusted.length > 0 && (
        <div className="space-y-2">
          {data.trusted.map((addr) => (
            <div key={addr} className="rounded-xl border border-border bg-card px-4 py-3 font-mono text-sm">
              {addr}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
