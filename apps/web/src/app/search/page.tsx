import type { Metadata } from 'next'
import { SearchClient } from './SearchClient'

interface PageProps {
  searchParams: Promise<{ q?: string; tab?: string }>
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams
  return {
    title: q ? `Search: ${q}` : 'Search',
    description: q ? `Search results for "${q}" on ONCHAIN.` : 'Search for people, posts, and hashtags on ONCHAIN.',
  }
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q = '', tab = 'all' } = await searchParams
  return <SearchClient initialQuery={q} initialTab={tab as 'all' | 'people' | 'posts' | 'hashtags'} />
}
