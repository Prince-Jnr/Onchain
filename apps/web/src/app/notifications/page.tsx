import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthenticatedSession } from '@/lib/session'
import { NotificationsClient } from './NotificationsClient'

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Your notifications on ONCHAIN.',
}

export default async function NotificationsPage() {
  const session = await getAuthenticatedSession()
  if (!session) {
    redirect('/')
  }

  return <NotificationsClient />
}
