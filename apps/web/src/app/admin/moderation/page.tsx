'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { EyeOff, RotateCcw, Trash2, Pin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { AdminShell } from '@/components/admin/AdminShell'

interface PendingEntry {
  id: number
  chainEntryId: number | null
  authorAddress: string
  entryType: string
  status: string
  pinned: boolean
  createdAt: string
  commentCount: number
  totalReactions: number
  content: { text: string } | null
}

interface ModerationResponse {
  entries: PendingEntry[]
  nextCursor: string | null
}

async function fetchQueue(status: string): Promise<ModerationResponse> {
  const params = new URLSearchParams({ status, limit: '30' })
  const res = await fetch(`/api/admin/moderation?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load moderation queue')
  return res.json() as Promise<ModerationResponse>
}

async function applyAction(entryId: number, action: string, reason?: string): Promise<void> {
  const res = await fetch(`/api/admin/moderation/${entryId}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reason }),
  })
  if (!res.ok) throw new Error('Failed to apply action')
}

export default function AdminModerationPage() {
  const [status, setStatus] = useState<'PENDING' | 'HIDDEN' | 'REJECTED' | 'ACTIVE'>('PENDING')
  const [reasonByEntry, setReasonByEntry] = useState<Record<number, string>>({})
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'moderation', status],
    queryFn: () => fetchQueue(status),
  })

  const runAction = async (entryId: number, action: string) => {
    try {
      await applyAction(entryId, action, reasonByEntry[entryId] || undefined)
      toast.success('Action applied.')
      await refetch()
    } catch {
      toast.error('Failed to apply action.')
    }
  }

  return (
    <AdminShell title="Moderation" actions={
      <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>Refresh</Button>
    }>
      <div className="mb-4 flex gap-2">
        {(['PENDING', 'HIDDEN', 'REJECTED'] as const).map((s) => (
          <Button key={s} variant={status === s ? 'default' : 'outline'} size="sm" onClick={() => setStatus(s)} className="rounded-full">
            {s}
          </Button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load queue.</p>}
      {data && data.entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No entries in this state.</p>
        </div>
      )}
      {data && data.entries.length > 0 && (
        <div className="space-y-3">
          {data.entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">#{entry.id}</span>
                    <Badge variant="secondary">{entry.entryType}</Badge>
                    <Badge variant="outline">{entry.status}</Badge>
                    {entry.pinned && <Badge variant="secondary">Pinned</Badge>}
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground line-clamp-3">
                    {entry.content?.text?.slice(0, 300) || '(no text)'}
                  </p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {entry.authorAddress.slice(0, 12)}… · {entry.commentCount} comments · {entry.totalReactions} reactions
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Input
                    value={reasonByEntry[entry.id] ?? ''}
                    onChange={(e) => setReasonByEntry({ ...reasonByEntry, [entry.id]: e.target.value })}
                    placeholder="Reason…"
                    className="w-40"
                  />
                  {status === 'PENDING' && (
                    <>
                      <Button size="sm" onClick={() => runAction(entry.id, 'approve')}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => runAction(entry.id, 'reject')}><Trash2 className="h-3 w-3" />Reject</Button>
                      <Button size="sm" variant="outline" onClick={() => runAction(entry.id, 'hide')}><EyeOff className="h-3 w-3" />Hide</Button>
                      <Button size="sm" variant="outline" onClick={() => runAction(entry.id, 'delete')}><Trash2 className="h-3 w-3" />Delete</Button>
                      <Button size="sm" variant="ghost" onClick={() => runAction(entry.id, 'pin')}><Pin className="h-3 w-3" />Pin</Button>
                    </>
                  )}
                  {status === 'HIDDEN' && (
                    <Button size="sm" onClick={() => runAction(entry.id, 'restore')}><RotateCcw className="h-3 w-3" />Restore</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
