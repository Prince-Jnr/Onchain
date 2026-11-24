import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { wallets } from '@/lib/schema'
import { requireAdminSession, isValidWallet } from '@/lib/admin'

// GET /api/admin/trusted — wallets with isTrusted=true
export async function GET() {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  try {
    const rows = await db.select().from(wallets).where(eq(wallets.isTrusted, true))
    return NextResponse.json({ trusted: rows.map((r) => r.address) })
  } catch {
    return NextResponse.json({ error: 'Failed to load trusted wallets' }, { status: 500 })
  }
}

// POST /api/admin/trusted — { address, action: 'add'|'remove' }
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
    await db
      .update(wallets)
      .set({ isTrusted: action === 'add' ? true : false, lastSeenAt: new Date() })
      .where(eq(wallets.address, normalized))
    const [updated] = await db.select().from(wallets).where(eq(wallets.address, normalized)).limit(1)
    return NextResponse.json({ ok: true, address: normalized, isTrusted: updated?.isTrusted })
  } catch {
    return NextResponse.json({ error: 'Failed to update trusted wallets' }, { status: 500 })
  }
}
