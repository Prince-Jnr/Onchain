'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { AdminShell } from '@/components/admin/AdminShell'

async function fetchModerators(): Promise<{ moderators: { address: string; grantedAt: string; lastActiveAt: string }[] }> {
  const res = await fetch('/api/admin/moderators', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load moderators')
  return res.json()
}

export default function AdminModeratorsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin', 'moderators'], queryFn: fetchModerators })
  const [address, setAddress] = useState('')

  const mutate = useMutation({
    mutationFn: async ({ address, action }: { address: string; action: 'add' | 'remove' }) => {
      const res = await fetch('/api/admin/moderators', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, action }),
      })
      if (!res.ok) throw new Error('Failed to update moderators')
    },
    onSuccess: () => {
      toast.success('Moderator list updated.')
      setAddress('')
      void refetch()
      queryClient.invalidateQueries({ queryKey: ['admin', 'moderators'] })
    },
    onError: () => toast.error('Failed to update moderators.'),
  })

  return (
    <AdminShell title="Moderators">
      <div className="mb-4 flex gap-2">
        <Input
          placeholder="0x… wallet address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="max-w-sm"
        />
        <Button
          onClick={() => mutate.mutate({ address, action: 'add' })}
          disabled={mutate.isPending || !address.trim()}
          className="rounded-full"
        >
          Add moderator
        </Button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load moderators.</p>}
      {data && data.moderators.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
          <p className="mt-3 text-sm text-muted-foreground">No moderators yet.</p>
        </div>
      )}
      {data && (
        <div className="space-y-2">
          {data.moderators.map((m) => (
            <div key={m.address} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <div>
                <div className="text-sm font-mono">{m.address}</div>
                <div className="text-xs text-muted-foreground">
                  Granted {new Date(m.grantedAt).toLocaleString()} · Active {new Date(m.lastActiveAt).toLocaleString()}
                </div>
              </div>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => mutate.mutate({ address: m.address, action: 'remove' })}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
