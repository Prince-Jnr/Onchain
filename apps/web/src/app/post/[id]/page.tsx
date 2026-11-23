import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PostDetailClient } from './PostDetailClient'
import { Entry } from '@onchain/shared'

interface PageProps {
  params: Promise<{ id: string }>
}

async function fetchEntry(id: string): Promise<Entry | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/entries/${id}`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return null
    const data = await res.json() as { entry: Entry }
    return data.entry ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const entry = await fetchEntry(id)

  const text = entry?.content?.text?.slice(0, 160) ?? 'View this post on ONCHAIN.'
  const authorName = entry?.authorProfile?.displayName ?? entry?.author?.slice(0, 10) ?? 'Unknown'

  return {
    title: `${authorName}: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`,
    description: text,
    openGraph: {
      title: `Post by ${authorName} on ONCHAIN`,
      description: text,
    },
  }
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params

  if (!/^\d+$/.test(id)) {
    notFound()
  }

  const entry = await fetchEntry(id)

  return <PostDetailClient entryId={Number(id)} initialEntry={entry} />
}
