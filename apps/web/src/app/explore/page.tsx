import type { Metadata } from 'next'
import { ExplorePageClient } from './ExplorePageClient'

export const metadata: Metadata = {
  title: 'Explore',
  description: 'Discover posts, trending topics, and people on ONCHAIN.',
}

export default function ExplorePage() {
  return <ExplorePageClient />
}
