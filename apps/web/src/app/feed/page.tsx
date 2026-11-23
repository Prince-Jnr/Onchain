import type { Metadata } from 'next'
import { FeedPageClient } from './FeedPageClient'

export const metadata: Metadata = {
  title: 'Home',
  description: 'Your ONCHAIN social feed.',
}

export default function FeedPage() {
  return <FeedPageClient />
}
