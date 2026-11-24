import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc, lt, sql, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  notifications,
  wallets,
  profiles,
  entries,
  entryContent,
} from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'
import { checkRateLimit as pgCheckRateLimit } from '@/lib/rate-limit'

// ---------------------------------------------------------------------------
// Rate limiting (distributed, PostgreSQL-backed)
async function checkRateLimit(ip: string): Promise<boolean> {
  const result = await pgCheckRateLimit(`notifications:${ip}`, { max: 120, windowMs: 60_000 })
  return result.allowed
}

// ---------------------------------------------------------------------------
// GET /api/notifications
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  if (!(await checkRateLimit(ip))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = request.nextUrl
  const cursorParam = searchParams.get('cursor')
  const rawLimit = parseInt(searchParams.get('limit') ?? '30', 10)
  const limit = Math.min(Math.max(rawLimit, 1), 100)
  const unreadOnly = searchParams.get('unreadOnly') === 'true'

  try {
    const conditions = [eq(notifications.recipientAddress, session.walletAddress)]

    if (unreadOnly) {
      conditions.push(eq(notifications.read, false))
    }

    if (cursorParam) {
      const cursorDate = new Date(cursorParam)
      if (!isNaN(cursorDate.getTime())) {
        conditions.push(lt(notifications.createdAt, cursorDate))
      }
    }

    const notifRows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit + 1)

    const hasMore = notifRows.length > limit
    if (hasMore) notifRows.pop()

    // Gather actor addresses and entry IDs
    const actorAddresses = [...new Set(
      notifRows
        .map((n) => n.actorAddress)
        .filter((a): a is string => a !== null),
    )]
    const entryIds = [...new Set(
      notifRows
        .map((n) => n.targetEntryId)
        .filter((id): id is number => id !== null),
    )]

    // Batch fetch actors and entries
    const [actorWallets, actorProfiles, entryRows, contentRows] = await Promise.all([
      actorAddresses.length > 0
        ? db.select().from(wallets).where(inArray(wallets.address, actorAddresses))
        : Promise.resolve([]),
      actorAddresses.length > 0
        ? db.select().from(profiles).where(inArray(profiles.walletAddress, actorAddresses))
        : Promise.resolve([]),
      entryIds.length > 0
        ? db.select().from(entries).where(inArray(entries.id, entryIds))
        : Promise.resolve([]),
      entryIds.length > 0
        ? db.select().from(entryContent).where(inArray(entryContent.entryId, entryIds))
        : Promise.resolve([]),
    ])

    // Build maps
    const walletMap = new Map(actorWallets.map((w) => [w.address, w]))
    const profileMap = new Map(actorProfiles.map((p) => [p.walletAddress, p]))
    const entryMap = new Map(entryRows.map((e) => [e.id, e]))
    const contentMap = new Map(contentRows.map((c) => [c.entryId, c]))

    // Get unread count (regardless of cursor)
    const [{ unreadCount }] = await db
      .select({ unreadCount: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientAddress, session.walletAddress),
          eq(notifications.read, false),
        ),
      )

    const serialized = notifRows.map((n) => {
      const actorWallet = n.actorAddress ? walletMap.get(n.actorAddress) : null
      const actorProfile = n.actorAddress ? profileMap.get(n.actorAddress) : null
      const targetEntry = n.targetEntryId ? entryMap.get(n.targetEntryId) : null
      const targetContent = n.targetEntryId ? contentMap.get(n.targetEntryId) : null

      return {
        id: n.id,
        type: n.type,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
        actorProfile: n.actorAddress
          ? {
              walletAddress: n.actorAddress,
              displayName: actorProfile?.displayName ?? null,
              avatarUrl: actorProfile?.avatarUrl ?? null,
              isTrusted: actorWallet?.isTrusted ?? false,
            }
          : null,
        targetEntry: targetEntry
          ? {
              id: targetEntry.id,
              entryType: targetEntry.entryType,
              authorAddress: targetEntry.authorAddress,
              createdAt: targetEntry.createdAt.toISOString(),
              status: targetEntry.status,
              content: targetContent
                ? { text: targetContent.text }
                : null,
            }
          : null,
      }
    })

    const nextCursor = hasMore
      ? notifRows[notifRows.length - 1].createdAt.toISOString()
      : null

    return NextResponse.json({
      notifications: serialized,
      nextCursor,
      unreadCount,
    })
  } catch (error) {
    console.error('[notifications GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
