import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { entries, moderationLogs } from '@/lib/schema'
import { requireAdminSession } from '@/lib/admin'

const ACTIONS = ['approve', 'reject', 'hide', 'restore', 'pin', 'unpin', 'delete'] as const
type Action = (typeof ACTIONS)[number]

const ACTION_TO_LOG = {
  approve: 'APPROVE',
  reject: 'REJECT',
  hide: 'HIDE',
  restore: 'RESTORE',
  delete: 'DELETE',
  pin: 'PIN',
  unpin: 'UNPIN',
} as const satisfies Record<Action, 'APPROVE' | 'REJECT' | 'HIDE' | 'RESTORE' | 'DELETE' | 'PIN' | 'UNPIN'>

const NEXT_STATUS: Record<Action, 'ACTIVE' | 'HIDDEN' | 'REJECTED' | 'DELETED' | null> = {
  approve: 'ACTIVE',
  reject: 'REJECTED',
  hide: 'HIDDEN',
  restore: 'ACTIVE',
  pin: null, // handled separately
  unpin: null,
  delete: 'DELETED',
}

// POST /api/admin/moderation/[id] — { action: 'approve'|'reject'|'hide'|'restore'|'delete', reason? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

  const { id: idParam } = await params
  const entryId = parseInt(idParam, 10)
  if (!Number.isSafeInteger(entryId) || entryId <= 0) {
    return NextResponse.json({ error: 'Invalid entry ID' }, { status: 400 })
  }

  let body: { action?: unknown; reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as Action
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : null

  try {
    const [entry] = await db.select().from(entries).where(eq(entries.id, entryId)).limit(1)
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    const nextStatus = NEXT_STATUS[action]
    if (nextStatus) {
      const update: Record<string, unknown> = { status: nextStatus, updatedAt: new Date() }
      await db.update(entries).set(update).where(eq(entries.id, entryId))
      await db.insert(moderationLogs).values({
        actorAddress: session.walletAddress,
        action: ACTION_TO_LOG[action],
        targetEntryId: entryId,
        reason,
      })
    } else if (action === 'pin') {
      await db.update(entries).set({ pinned: true, updatedAt: new Date() }).where(eq(entries.id, entryId))
      await db.insert(moderationLogs).values({ actorAddress: session.walletAddress, action: 'PIN', targetEntryId: entryId })
    } else if (action === 'unpin') {
      await db.update(entries).set({ pinned: false, updatedAt: new Date() }).where(eq(entries.id, entryId))
      await db.insert(moderationLogs).values({ actorAddress: session.walletAddress, action: 'UNPIN', targetEntryId: entryId })
    }

    const [updated] = await db.select().from(entries).where(eq(entries.id, entryId)).limit(1)
    return NextResponse.json({ entry: updated, ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to apply moderation action' }, { status: 500 })
  }
}
