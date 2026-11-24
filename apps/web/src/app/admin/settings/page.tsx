'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { AdminShell } from '@/components/admin/AdminShell'

interface SettingRow {
  key: string
  value: string
  updatedAt: string
  updatedByAddress: string | null
}

async function fetchSettings(): Promise<{ settings: SettingRow[] }> {
  const res = await fetch('/api/admin/settings', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load settings')
  return res.json() as Promise<{ settings: SettingRow[] }>
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin', 'settings'], queryFn: fetchSettings })

  const [edits, setEdits] = useState<Record<string, string>>({})

  const mutate = useMutation({
    mutationFn: async (entries: { key: string; value: string }[]) => {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: entries }),
      })
      if (!res.ok) throw new Error('Failed to save settings')
    },
    onSuccess: () => {
      toast.success('Settings saved.')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
    },
    onError: () => toast.error('Failed to save settings.'),
  })

  const handleSaveAll = () => {
    const entries = Object.entries(edits).map(([key, value]) => ({ key, value }))
    if (entries.length > 0) mutate.mutate(entries)
  }

  return (
    <AdminShell title="Settings" actions={
      <Button onClick={handleSaveAll} disabled={mutate.isPending}>
        Save changes
      </Button>
    }>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load settings.</p>}
      {data && data.settings.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Settings className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
          <p className="mt-3 text-sm text-muted-foreground">No settings recorded yet.</p>
        </div>
      )}
      {data && data.settings.map((s) => (
        <div key={s.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <span className="w-36 text-sm font-medium text-muted-foreground">{s.key}</span>
          <Input
            value={edits[s.key] ?? s.value}
            onChange={(e) => setEdits({ ...edits, [s.key]: e.target.value })}
            className="w-64"
            placeholder={s.value}
          />
          {edits[s.key] !== undefined && (
            <Button size="sm" onClick={handleSaveAll} disabled={mutate.isPending}>
              Save
            </Button>
          )}
        </div>
      ))}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <PenLine className="h-3 w-3" /> Application configuration (moderation mode, etc.) is stored as platform settings.
      </div>
    </AdminShell>
  )
}
