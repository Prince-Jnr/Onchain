'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AdminShell } from '@/components/admin/AdminShell'

async function fetchUsers(role: string, limit: number): Promise<{ users: AdminUser[] }> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (role) params.set('role', role)
  const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load users')
  return res.json() as Promise<{ users: AdminUser[] }>
}

export interface AdminUser {
  address: string
  restriction: 'NONE' | 'RESTRICTED' | 'BANNED'
  isTrusted: boolean
  isModerator: boolean
  isAdmin: boolean
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => fetchUsers('', 20),
  })

  const visible = (data?.users ?? []).filter((u) =>
    u.address.toLowerCase().startsWith(search.trim().toLowerCase())
  )

  return (
    <AdminShell title="Users" actions={
      <Button asChild variant="outline" size="sm"><a href="/admin/users/restricted">View restricted</a></Button>
    }>
      <div className="mb-4">
        <Input
          placeholder="Search wallet (0x…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load users.</p>}
      {data && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Wallet</th>
                <th className="px-4 py-3">Restriction</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                    No wallets found
                  </td>
                </tr>
              )}
              {visible.map((u) => (
                <tr key={u.address} className="border-b border-border last:border-b-0 hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    <a href={`/admin/users/${u.address}`} className="text-primary hover:underline">
                      {u.address.slice(0, 10)}…{u.address.slice(-6)}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    {u.restriction !== 'NONE' && <Badge variant="destructive">{u.restriction}</Badge>}
                    {u.restriction === 'NONE' && <span className="text-muted-foreground">None</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.isAdmin && <Badge variant="secondary">Admin</Badge>}
                    {u.isModerator && <Badge variant="secondary">Moderator</Badge>}
                    {u.isTrusted && <Badge variant="outline">Trusted</Badge>}
                    {!u.isAdmin && !u.isModerator && !u.isTrusted && <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm" className="rounded-full">
                      <a href={`/admin/users/${u.address}`}>View</a>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
        <ShieldCheck className="h-3 w-3" /> Shows wallets by last activity.
      </p>
    </AdminShell>
  )
}
