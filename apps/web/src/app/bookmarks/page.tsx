import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthenticatedSession } from '@/lib/session'
import { BookmarksClient } from './BookmarksClient'

export const metadata: Metadata = {
  title: 'Bookmarks',
  description: 'Your saved posts on ONCHAIN.',
}

export default async function BookmarksPage() {
  const session = await getAuthenticatedSession()
  if (!session) {
    redirect('/')
  }

  return <BookmarksClient />
}
