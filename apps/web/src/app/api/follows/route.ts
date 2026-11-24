import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { follows, wallets } from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'
import { isValidAddress } from '@onchain/shared'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireSession() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  return session
}

function parseTargetAddress(body: unknown): string | NextResponse {
  if (!body || typeof body !== 'object' || !('targetAddress' in body)) {
    return NextResponse.json({ error: 'targetAddress is required' }, { status: 400 })
  }
  const target = (body as { targetAddress: unknown }).targetAddress
  if (typeof target !== 'string' || !isValidAddress(target)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
  }
  return target.toLowerCase() as string
}

export * from '../../../lib/follow-status'

// ---------------------------------------------------------------------------
// POST /api/follows — follow an address (app-layer record; on-chain via wallet)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const session = await requireSession()
  if (session instanceof NextResponse) return session

  const target = parseTargetAddress(await request.json().catch(() => null))
  if (target instanceof NextResponse) return target

  try {
    const now = new Date()
    await db.insert(follows).values({
      followerAddress: session.walletAddress,
      followedAddress: target,
      active: true,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [follows.followerAddress, follows.followedAddress],
      set: { active: true, updatedAt: now },
    })
    // Ensure wallet rows exist
    await db.insert(wallets).values({ address: session.walletAddress }).onConflictDoNothing()
    await db.insert(wallets).values({ address: target }).onConflictDoNothing()
    return NextResponse.json({ ok: true, followed: true, targetAddress: target })
  } catch {
    return NextResponse.json({ error: 'Failed to follow user' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/follows — unfollow an address
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const session = await requireSession()
  if (session instanceof NextResponse) return session

  const target = parseTargetAddress(await request.json().catch(() => null))
  if (target instanceof NextResponse) return target

  try {
    await db
      .update(follows)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(eq(follows.followerAddress, session.walletAddress), eq(follows.followedAddress, target))
      )
    return NextResponse.json({ ok: true, followed: false, targetAddress: target })
  } catch {
    return NextResponse.json({ error: 'Failed to unfollow user' }, { status: 500 })
  }
}
