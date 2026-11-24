import type { Metadata } from 'next'
import { HashtagPageClient } from './HashtagPageClient'

export const metadata: Metadata = {
  title: 'Hashtag',
  description: 'Posts tagged with a hashtag on ONCHAIN.',
}

export default async function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params
  return <HashtagPageClient tag={tag} />
}
