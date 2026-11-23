import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProfilePageClient } from './ProfilePageClient'
import { Profile } from '@onchain/shared'

interface PageProps {
  params: Promise<{ address: string }>
}

async function fetchProfile(address: string): Promise<Profile | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/profiles/${address}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    const data = await res.json() as { profile: Profile }
    return data.profile ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { address } = await params
  const profile = await fetchProfile(address)

  const displayName = profile?.displayName ?? address.slice(0, 10) + '…'
  const bio = profile?.bio ?? 'View this profile on ONCHAIN.'

  return {
    title: `${displayName} (@${address.slice(0, 6)}…${address.slice(-4)})`,
    description: bio,
    openGraph: {
      title: `${displayName} on ONCHAIN`,
      description: bio,
      images: profile?.avatarUrl ? [profile.avatarUrl] : [],
    },
  }
}

export default async function ProfilePage({ params }: PageProps) {
  const { address } = await params

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    notFound()
  }

  const profile = await fetchProfile(address)

  return <ProfilePageClient address={address} initialProfile={profile} />
}
