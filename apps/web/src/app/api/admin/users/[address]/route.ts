import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { wallets, profiles } from '@/lib/schema'
import { requireAdminSession, isValidWallet } from '@/lib/admin'

// GET /api/admin/users/[address] — wallet lookup + activity
export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

  const { address } = await params
  if (!isValidWallet(address)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
  }
  const normalized = address.toLowerCase()

  const [row] = await db.select().from(wallets).where(eq(wallets.address, normalized)).limit(1)
  if (!row) {
    return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
  }
  const [profile] = await db.select().from(profiles).where(eq(profiles.walletAddress, normalized)).limit(1)

  return NextResponse.json({
    address: row.address,
    restriction: row.restriction,
    isTrusted: row.isTrusted,
    isModerator: row.isModerator,
    isAdmin: row.isAdmin,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    profile: {
      displayName: profile?.displayName ?? null,
      bio: profile?.bio ?? null,
    },
  })
}

// POST /api/admin/users/[address] — { restriction: 'NONE'|'RESTRICTED'|'BANNED' }
export async function POST(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

  const { address } = await params
  if (!isValidWallet(address)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
  }
  const normalized = address.toLowerCase()

  let body: { restriction?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const restriction = body.restriction
  if (restriction !== 'NONE' && restriction !== 'RESTRICTED' && restriction !== 'BANNED') {
    return NextResponse.json({ error: 'Invalid restriction value' }, { status: 400 })
  }

  try {
    await db
      .update(wallets)
      .set({ restriction })
      .where(eq(wallets.address, normalized))

    const [updated] = await db.select().from(wallets).where(eq(wallets.address, normalized)).limit(1)
    return NextResponse.json({
      address: updated?.address,
      restriction: updated?.restriction,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to update user restriction' }, { status: 500 })
  }
}
