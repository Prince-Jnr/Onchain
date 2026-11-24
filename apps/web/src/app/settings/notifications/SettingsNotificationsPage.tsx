'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const TYPE_LABELS: Record<string, string> = {
  REPLY: 'Replies to my posts',
  COMMENT: 'Comments on my posts',
  MENTION: 'Mentions of my wallet',
  REPOST: 'Reposts of my posts',
  QUOTE: 'Quotes of my posts',
  REACTION: 'Reactions to my posts',
  FOLLOW: 'New followers',
  MODERATION: 'Moderation actions',
  ADMIN_ANNOUNCEMENT: 'Admin announcements',
}
const TYPE_NAMES = Object.keys(TYPE_LABELS)

async function fetchPrefs(): Promise<Record<string, boolean>> {
  const res = await fetch('/api/notifications/preferences', { credentials: 'include' })
  if (!res.ok) return {}
  return (await res.json()) as Record<string, boolean>
}

async function savePrefs(prefs: Record<string, boolean>) {
  const res = await fetch('/api/notifications/preferences', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences: prefs }),
  })
  return res
}

export function SettingsNotificationsPage() {
  const queryClient = useQueryClient()
  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: fetchPrefs,
  })

  const updateMutation = useMutation({
    mutationFn: (next: Record<string, boolean>) => savePrefs(next),
    onSuccess: () => {
      queryClient.setQueryData(['notifications', 'preferences'], nextRef.current)
      toast.success('Preferences saved.')
    },
    onError: () => toast.error('Could not save preferences.'),
  })

  const nextRef = { current: {} as Record<string, boolean> }
  const allTypes = TYPE_NAMES

  const handleToggle = async (type: string, checked: boolean) => {
    const next = { ...(prefs ?? {}), [type]: checked }
    nextRef.current = next
    updateMutation.mutate(next)
  }

  const handleReset = async () => {
    updateMutation.mutate({})
  }

  if (isLoading) {
    return (
      <div className="space-y-6 px-4 py-6">
        <div className="flex items-center gap-2.5">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">Notifications</h2>
        </div>
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 py-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Bell className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Notifications</h2>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold">Notification types</span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={handleReset}
            disabled={updateMutation.isPending}
          >
            Reset to defaults
          </Button>
        </div>
        <div className="space-y-3">
          {allTypes.map((type) => (
            <div key={type} className="flex items-center justify-between rounded-lg px-1 py-2">
              <Label htmlFor={`pref-${type}`} className="flex-1 cursor-pointer text-sm">
                {TYPE_LABELS[type] ?? type}
              </Label>
              <Switch
                id={`pref-${type}`}
                checked={prefs?.[type] ?? true}
                onCheckedChange={(checked) => handleToggle(type, checked)}
                disabled={updateMutation.isPending}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

