import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { reposts, wallets } from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'

type RepostRow = typeof reposts.$inferSelect

function serializeReposts(rows: RepostRow[]) {
  return rows.map((r) => ({
    id: r.id,
    entryId: r.entryId,
    walletAddress: r.walletAddress,
    txHash: r.txHash,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

// GET /api/reposts?entryId=X&walletAddress=Y
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

  try {
    const walletAddress = searchParams.get('walletAddress')
    const conditions = [eq(reposts.entryId, entryId), eq(reposts.active, true)]
    if (walletAddress) conditions.push(eq(reposts.walletAddress, walletAddress.toLowerCase()))
    const rows = await db.select().from(reposts).where(and(...conditions))
    return NextResponse.json({ reposts: serializeReposts(rows) })
  } catch {
    return NextResponse.json({ error: 'Failed to load reposts' }, { status: 500 })
  }
}

// POST /api/reposts — { entryId, txHash? }
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: { entryId?: unknown; txHash?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const entryId = body.entryId
  if (typeof entryId !== 'number' || !Number.isSafeInteger(entryId) || entryId <= 0) {
    return NextResponse.json({ error: 'Invalid entryId' }, { status: 400 })
  }
  const txHash = typeof body.txHash === 'string' && body.txHash ? body.txHash : null

  try {
    const now = new Date()
    const [row] = await db
      .insert(reposts)
      .values({
        entryId,
        walletAddress: session.walletAddress,
        txHash,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [reposts.entryId, reposts.walletAddress],
        set: { active: true, updatedAt: now },
      })
      .returning()
    await db.insert(wallets).values({ address: session.walletAddress }).onConflictDoNothing()
    return NextResponse.json({ repost: serializeReposts([row])[0] })
  } catch (err) {
    if (err instanceof Error && /reposts_entry_wallet/.test(String(err.message))) {
      return NextResponse.json({ error: 'Already reposted' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to record repost' }, { status: 500 })
  }
}

// DELETE /api/reposts — { entryId }
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
    const [row] = await db
      .update(reposts)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(reposts.entryId, entryId), eq(reposts.walletAddress, session.walletAddress)))
      .returning()
    return NextResponse.json({ repost: row ? serializeReposts([row])[0] : null })
  } catch {
    return NextResponse.json({ error: 'Failed to remove repost' }, { status: 500 })
  }
}
