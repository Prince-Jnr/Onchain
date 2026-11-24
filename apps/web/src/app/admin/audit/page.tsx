'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'

interface AuditRow {
  id: number
  actorAddress: string
  actorName: string | null
  action: string
  targetEntryId: number | null
  targetWalletAddress: string | null
  reason: string | null
  txHash: string | null
  createdAt: string
}

async function fetchAudit(actor: string, limit: number): Promise<{ audit: AuditRow[] }> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (actor) params.set('actor', actor)
  const res = await fetch(`/api/admin/audit?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load audit log')
  return res.json() as Promise<{ audit: AuditRow[] }>
}

export default function AdminAuditPage() {
  const queryClient = useQueryClient()
  const [actor, setActor] = useState('')
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin', 'audit', actor], queryFn: () => fetchAudit(actor, 50) })

  const mutate = useMutation({
    mutationFn: async (next: string) => {
      setActor(next)
    },
    onSuccess: () => {
      void refetch()
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] })
    },
  })

  return (
    <AdminShell title="Audit log" actions={
      <button onClick={() => void refetch()} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        Refresh
      </button>
    }>
      <div className="mb-4 text-xs text-muted-foreground">
        Moderation actions recorded on-chain and in the application layer.
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load audit log.</p>}
      {data && data.audit.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
          <p className="mt-3 text-sm text-muted-foreground">No audit entries yet.</p>
        </div>
      )}
      {data && data.audit.map((a) => (
        <div key={a.id} className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-muted-foreground">#{a.id}</span>
            <span className="font-medium">{a.actorName ?? a.actorAddress.slice(0, 10) + '…'}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{a.action}</span>
            {a.targetEntryId !== null && <span className="text-muted-foreground">entry #{a.targetEntryId}</span>}
            {a.targetWalletAddress && <span className="text-muted-foreground">wallet {a.targetWalletAddress.slice(0, 10)}…</span>}
            <span className="text-muted-foreground ml-auto">{new Date(a.createdAt).toLocaleString()}</span>
          </div>
          {a.reason && <div className="mt-1 text-xs text-muted-foreground">{a.reason}</div>}
          {a.txHash && <div className="mt-1 text-xs text-primary">{a.txHash.slice(0, 18)}…</div>}
        </div>
      ))}
      <div className="mt-4 flex gap-2">
        {mutate.isPending ? <p className="text-xs text-muted-foreground">Loading filter…</p> : null}
      </div>
    </AdminShell>
  )
}
