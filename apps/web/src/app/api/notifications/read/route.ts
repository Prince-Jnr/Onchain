import { NextRequest, NextResponse } from 'next/server'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notifications } from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'

// ---------------------------------------------------------------------------
// POST /api/notifications/read — Mark notifications as read
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: { ids?: unknown; all?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    if (body.all === true) {
      // Mark all unread notifications for this user as read
      await db
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.recipientAddress, session.walletAddress),
            eq(notifications.read, false),
          ),
        )

      return NextResponse.json({ success: true })
    }

    if (Array.isArray(body.ids)) {
      const ids = body.ids.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)

      if (ids.length === 0) {
        return NextResponse.json({ error: 'ids must be a non-empty array of positive integers' }, { status: 400 })
      }

      if (ids.length > 100) {
        return NextResponse.json({ error: 'Cannot mark more than 100 notifications at once' }, { status: 400 })
      }

      // Only update notifications belonging to this user (security: ignore others' IDs)
      await db
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.recipientAddress, session.walletAddress),
            inArray(notifications.id, ids),
          ),
        )

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Body must include either { ids: number[] } or { all: true }' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[notifications/read POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
