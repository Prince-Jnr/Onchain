'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { AdminShell } from '@/components/admin/AdminShell'

interface UserDetail {
  address: string
  restriction: 'NONE' | 'RESTRICTED' | 'BANNED'
  isTrusted: boolean
  isModerator: boolean
  isAdmin: boolean
  firstSeenAt: string
  lastSeenAt: string
  profile: { displayName: string | null; bio: string | null } | null
}

async function fetchUser(address: string): Promise<UserDetail> {
  const res = await fetch(`/api/admin/users/${address}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load user')
  return res.json() as Promise<UserDetail>
}

export default function AdminUserDetailPage() {
  const params = useParams<{ address: string }>()
  const address = params?.address?.toLowerCase() ?? ''
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'users', address],
    queryFn: () => fetchUser(address),
  })

  const [restriction, setRestriction] = useState<'NONE' | 'RESTRICTED' | 'BANNED'>('NONE')

  const mutate = useMutation({
    mutationFn: async (next: 'NONE' | 'RESTRICTED' | 'BANNED') => {
      const res = await fetch(`/api/admin/users/${address}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restriction: next }),
      })
      if (!res.ok) throw new Error('Failed to update restriction')
    },
    onSuccess: () => {
      toast.success('Restriction updated.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', address] })
    },
    onError: () => toast.error('Failed to update restriction.'),
  })

  if (isLoading) return <AdminShell title="User" actions={null}><p className="text-sm text-muted-foreground">Loading…</p></AdminShell>
  if (isError || !data) {
    return <AdminShell title="User"><p className="text-sm text-destructive">User not found.</p></AdminShell>
  }

  return (
    <AdminShell title={data.profile?.displayName ?? data.address.slice(0, 12) + '…'}>
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <span className="font-mono text-xs text-muted-foreground">{data.address}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Restriction: {data.restriction}
            </span>
            {data.isAdmin && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Admin</span>}
            {data.isModerator && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Moderator</span>}
          </div>
          {data.profile && (
            <div className="mt-3 text-sm text-muted-foreground">
              {data.profile.displayName && <p className="text-foreground">{data.profile.displayName}</p>}
              {data.profile.bio && <p className="mt-1">{data.profile.bio}</p>}
            </div>
          )}
          <div className="mt-4 text-xs text-muted-foreground">
            First seen: {new Date(data.firstSeenAt).toLocaleString()} · Last seen: {new Date(data.lastSeenAt).toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Restriction</h3>
          <div className="flex flex-wrap gap-2">
            {(['NONE', 'RESTRICTED', 'BANNED'] as const).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={restriction === r ? 'default' : r === 'NONE' && !restriction ? 'default' : 'outline'}
                onClick={() => mutate.mutate(r)}
                disabled={mutate.isPending}
              >
                {r}
              </Button>
            ))}
          </div>
          {data.restriction !== 'NONE' && (
            <div className="mt-2 flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{data.restriction === 'BANNED' ? 'This wallet is banned from posting.' : 'This wallet is restricted from posting.'}</span>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
