import { NextRequest, NextResponse } from 'next/server'
import { eq, and, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { wallets } from '@/lib/schema'
import { requireAdminSession, parsePositiveInt, isValidWallet } from '@/lib/admin'

// GET /api/admin/restricted — wallets with restriction != NONE
export async function GET(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  try {
    const limit = parsePositiveInt(request.nextUrl.searchParams.get('limit'))
    const rows = await db
      .select()
      .from(wallets)
      .where(and(ne(wallets.restriction, 'NONE')))
      .limit(limit)
    return NextResponse.json({
      restricted: rows.map((r) => ({ address: r.address, restriction: r.restriction, since: r.firstSeenAt.toISOString() })),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load restricted wallets' }, { status: 500 })
  }
}

// POST /api/admin/restricted — { address, action: 'restrict'|'unrestrict' }
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
  const action = (typeof body.action === 'string' ? body.action : 'restrict') as 'restrict' | 'unrestrict'
  if (typeof rawAddress !== 'string' || !isValidWallet(rawAddress)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
  }
  const normalized = rawAddress.toLowerCase()

  try {
    await db
      .update(wallets)
      .set({ restriction: action === 'restrict' ? 'RESTRICTED' : 'NONE', lastSeenAt: new Date() })
      .where(eq(wallets.address, normalized))
    const [updated] = await db.select().from(wallets).where(eq(wallets.address, normalized)).limit(1)
    return NextResponse.json({ ok: true, address: normalized, restriction: updated?.restriction })
  } catch {
    return NextResponse.json({ error: 'Failed to update restrictions' }, { status: 500 })
  }
}
