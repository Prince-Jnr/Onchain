import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Trending',
  description: 'Trending posts and conversations on ONCHAIN.',
}

export default async function TrendingPage() {
  const { TrendingPageClient } = await import('./TrendingPageClient')
  return <TrendingPageClient />
}
