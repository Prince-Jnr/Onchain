import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { wallets } from '@/lib/schema'
import { requireAdminSession, isValidWallet } from '@/lib/admin'

// GET /api/admin/moderators — wallets with isModerator=true
export async function GET() {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  try {
    const rows = await db.select().from(wallets).where(eq(wallets.isModerator, true))
    return NextResponse.json({
      moderators: rows.map((r) => ({
        address: r.address,
        grantedAt: r.firstSeenAt.toISOString(),
        lastActiveAt: r.lastSeenAt.toISOString(),
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load moderators' }, { status: 500 })
  }
}

// POST /api/admin/moderators — { address, action: 'add'|'remove' }
export async function POST(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

  let body: { address?: unknown; action?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawAddress = body.address
  const action = (typeof body.action === 'string' ? body.action : 'add') as 'add' | 'remove'

  if (typeof rawAddress !== 'string' || !isValidWallet(rawAddress)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
  }
  const normalized = rawAddress.toLowerCase()

  try {
    if (action === 'add') {
      await db
        .update(wallets)
        .set({ isModerator: true, lastSeenAt: new Date() })
        .where(eq(wallets.address, normalized))
    } else {
      await db
        .update(wallets)
        .set({ isModerator: false, lastSeenAt: new Date() })
        .where(eq(wallets.address, normalized))
    }
    const [updated] = await db.select().from(wallets).where(eq(wallets.address, normalized)).limit(1)
    return NextResponse.json({ ok: true, address: normalized, isModerator: updated?.isModerator })
  } catch {
    return NextResponse.json({ error: 'Failed to update moderators' }, { status: 500 })
  }
}
