import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { reactions, reactionTypeEnum, wallets } from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'

function serializeReactionCounts(rows: { reactionType: string; count: number }[]) {
  const counts = {} as Record<string, number>
  for (const r of rows) {
    if (!reactionTypeEnum.enumValues.includes(r.reactionType as never)) continue
    counts[r.reactionType] = r.count
  }
  return counts
}

type ReactionRow = typeof reactions.$inferSelect

// GET /api/reactions?entryId=X — app-layer mirror of on-chain reaction state
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const { searchParams } = request.nextUrl
  const entryIdParam = searchParams.get('entryId')
  const entryId = entryIdParam ? parseInt(entryIdParam, 10) : null
  if (entryId === null || !Number.isSafeInteger(entryId) || entryId <= 0) {
    return NextResponse.json({ error: 'Valid entryId is required' }, { status: 400 })
  }

  const session = await getAuthenticatedSession()
  const [countRows, viewerRow] = await Promise.all([
    db
      .select({ reactionType: reactions.reactionType, count: sql<number>`COUNT(*)` })
      .from(reactions)
      .where(eq(reactions.entryId, entryId))
      .groupBy(reactions.reactionType),
    session
      ? db.select().from(reactions).where(and(eq(reactions.entryId, entryId), eq(reactions.walletAddress, session.walletAddress)))
      : (Promise.resolve([]) as Promise<ReactionRow[]>),
  ])

  const totalReactions = countRows.reduce((acc, r) => acc + Number(r.count), 0)
  const viewerReaction = viewerRow[0]?.reactionType ?? null

  return NextResponse.json({
    totalReactions,
    reactionCounts: serializeReactionCounts(countRows),
    viewerReaction,
  })
}

// POST /api/reactions — { entryId, reactionType } — app-layer mirror
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  let body: { entryId?: unknown; reactionType?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const entryId = body.entryId
  if (typeof entryId !== 'number' || !Number.isSafeInteger(entryId) || entryId <= 0) {
    return NextResponse.json({ error: 'Invalid entryId' }, { status: 400 })
  }
  const reactionType = body.reactionType
  if (typeof reactionType !== 'string' || !reactionTypeEnum.enumValues.includes(reactionType as never)) {
    return NextResponse.json({ error: 'Invalid reactionType' }, { status: 400 })
  }

  try {
    await db
      .insert(reactions)
      .values({ entryId, walletAddress: session.walletAddress, reactionType: reactionType as never })
      .onConflictDoUpdate({
        target: [reactions.entryId, reactions.walletAddress],
        set: { reactionType: reactionType as never },
      })
    await db.insert(wallets).values({ address: session.walletAddress }).onConflictDoNothing()
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && 'constraint' in err && /reactions_entry_wallet/.test(String(err.message))) {
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Failed to record reaction' }, { status: 500 })
  }
}

// DELETE /api/reactions — { entryId } — remove the viewer's reaction
export async function DELETE(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  let body: { entryId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const entryId = body.entryId
  if (typeof entryId !== 'number' || !Number.isSafeInteger(entryId) || entryId <= 0) {
    return NextResponse.json({ error: 'Invalid entryId' }, { status: 400 })
  }
  try {
    await db
      .delete(reactions)
      .where(and(eq(reactions.entryId, entryId), eq(reactions.walletAddress, session.walletAddress)))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to remove reaction' }, { status: 500 })
  }
}
