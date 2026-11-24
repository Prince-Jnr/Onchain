'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, AlertTriangle, CheckCircle, RotateCcw, Trash2, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { AdminShell } from '@/components/admin/AdminShell'

interface Report {
  id: number
  category: string
  status: 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED'
  reporterAddress: string
  reporterName: string | null
  targetEntryId: number | null
  targetWalletAddress: string | null
  targetEntryPreview: string | null
  notes: string | null
  createdAt: string
}

async function fetchReports(status: string): Promise<{ reports: Report[] }> {
  const params = new URLSearchParams({ status })
  const res = await fetch(`/api/admin/reports?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load reports')
  return res.json() as Promise<{ reports: Report[] }>
}

async function updateReport(id: number, action: 'resolve' | 'dismiss', notes?: string) {
  const res = await fetch(`/api/admin/reports/${id}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, notes }),
  })
  if (!res.ok) throw new Error('Failed to update report')
}

export default function AdminReportsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'PENDING' | 'RESOLVED' | 'DISMISSED'>('PENDING')
  const [notesByReport, setNotesByReport] = useState<Record<number, string>>({})
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'reports', activeTab],
    queryFn: () => fetchReports(activeTab),
  })

  const mutate = useMutation({
    mutationFn: ({ id, action, notes }: { id: number; action: 'resolve' | 'dismiss'; notes?: string }) =>
      updateReport(id, action, notes),
    onSuccess: () => {
      toast.success('Report updated.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
    },
    onError: () => toast.error('Failed to update report.'),
  })

  return (
    <AdminShell title="Reports" actions={
      <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })}>Refresh</Button>
    }>
      <div className="mb-4 flex gap-2">
        {(['PENDING', 'RESOLVED', 'DISMISSED'] as const).map((t) => (
          <Button key={t} variant={activeTab === t ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab(t)} className="rounded-full">{t}</Button>
        ))}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load reports.</p>}
      {data && data.reports.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Flag className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
          <p className="mt-3 text-sm text-muted-foreground">No reports in this state.</p>
        </div>
      )}
      {data && data.reports.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">#{r.id}</span>
                <BadgeShim status={r.status} />
                <span>{r.category}</span>
                <span>{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</span>
              </div>
              <div className="mt-1.5 text-sm text-foreground">
                <span className="font-medium">{r.reporterName ?? r.reporterAddress.slice(0, 10) + '…'}</span> reported
                {r.targetEntryPreview && (
                  <>
                    {' '}entry <span className="line-clamp-1 text-muted-foreground">{r.targetEntryPreview}</span>
                  </>
                )}
                {r.targetWalletAddress && <span className="text-muted-foreground"> wallet {r.targetWalletAddress.slice(0, 10)}…</span>}
              </div>
              <Textarea
                value={notesByReport[r.id] ?? ''}
                onChange={(e) => setNotesByReport({ ...notesByReport, [r.id]: e.target.value })}
                placeholder="Resolution notes (admin only)…"
                className="mt-2 h-16"
                disabled={mutate.isPending}
              />
              {r.notes && <p className="mt-2 text-xs text-muted-foreground italic">Note: {r.notes}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              {activeTab === 'PENDING' && (
                <>
                  <Button size="sm" onClick={() => mutate.mutate({ id: r.id, action: 'resolve', notes: notesByReport[r.id] })}>
                    <CheckCircle className="h-3 w-3" /> Resolve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => mutate.mutate({ id: r.id, action: 'dismiss', notes: notesByReport[r.id] })}>
                    <RotateCcw className="h-3 w-3" /> Dismiss
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </AdminShell>
  )
}

function BadgeShim({ status }: { status: Report['status'] }) {
  const { Badge } = require('@/components/ui/badge') as typeof import('@/components/ui/badge')
  return <Badge variant={status === 'PENDING' ? 'destructive' : 'secondary'}>{status}</Badge>
}
void AlertTriangle
void EyeOff
void Trash2
