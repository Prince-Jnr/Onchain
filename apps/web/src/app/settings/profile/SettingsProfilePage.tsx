'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { User, Save, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'

export function SettingsProfilePage() {
  const { address } = useAccount()
  const { isAuthenticated } = useAuth()
  const { data: profile } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      if (!address) return null
      const res = await fetch(`/api/profiles/${address}`, { credentials: 'include' })
      if (!res.ok) return null
      return (await res.json()) as Record<string, string | null>
    },
    enabled: !!address && isAuthenticated,
  })

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [website, setWebsite] = useState(profile?.website ?? '')
  const [twitter, setTwitter] = useState(profile?.twitterHandle ?? '')
  const [github, setGithub] = useState(profile?.githubHandle ?? '')

  const handleSave = async () => {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        website: website.trim() || null,
        twitterHandle: twitter.trim() || null,
        githubHandle: github.trim() || null,
      }),
    })
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({})) as { error?: string }).error ?? 'Save failed')
      return
    }
    toast.success('Profile saved.')
  }

  return (
    <div className="space-y-6 px-4 py-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <User className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Edit profile</h3>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              className="mt-1.5"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={address ? address.slice(0, 8) : 'Display name'}
            />
          </div>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              className="mt-1.5"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people about yourself"
              maxLength={160}
            />
            <p className="mt-1 text-xs text-muted-foreground">{bio.length}/160</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                className="mt-1.5"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div>
              <Label htmlFor="twitter">Twitter / X handle</Label>
              <Input
                id="twitter"
                className="mt-1.5"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="@handle"
              />
            </div>
            <div>
              <Label htmlFor="github">GitHub handle</Label>
              <Input
                id="github"
                className="mt-1.5"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="@handle"
              />
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button size="sm" className="rounded-full" onClick={handleSave} disabled={!isAuthenticated}>
            <Save className="h-4 w-4" />
            Save changes
          </Button>
          {!isAuthenticated && (
            <p className="text-xs text-muted-foreground">Sign in to edit your profile.</p>
          )}
        </div>
      </div>
    </div>
  )
}
