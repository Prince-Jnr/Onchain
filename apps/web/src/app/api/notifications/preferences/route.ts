import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notificationPreferences, notificationTypeEnum } from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'
import { NotificationType } from '@onchain/shared'
import { getNotificationPreferences } from '@/lib/notification-preferences'

const ALL_TYPES = notificationTypeEnum.enumValues

async function requireSession() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  return session
}

// ---------------------------------------------------------------------------
// GET /api/notifications/preferences
// ---------------------------------------------------------------------------
export async function GET(): Promise<Response> {
  const session = await requireSession()
  if (session instanceof NextResponse) return session
  return NextResponse.json(await getNotificationPreferences())
}

// ---------------------------------------------------------------------------
// PATCH /api/notifications/preferences — { preferences: { [type]: boolean } }
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest): Promise<Response> {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const session = await requireSession()
  if (session instanceof NextResponse) return session

  let body: { preferences?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const prefs = body.preferences
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
    return NextResponse.json({ error: 'preferences must be an object' }, { status: 400 })
  }

  const updates = Object.entries(prefs as Record<string, unknown>)
    .filter(([type, enabled]) => ALL_TYPES.includes(type as NotificationType) && typeof enabled === 'boolean')

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No valid notification types provided' }, { status: 400 })
  }

  try {
    for (const [type, enabled] of updates) {
      await db
        .insert(notificationPreferences)
        .values({
          walletAddress: session.walletAddress,
          type: type as NotificationType,
          enabled: enabled as boolean,
        })
        .onConflictDoUpdate({
          target: [notificationPreferences.walletAddress, notificationPreferences.type],
          set: { enabled: enabled as boolean, updatedAt: new Date() },
        })
    }
    return NextResponse.json(await getNotificationPreferences())
  } catch {
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
