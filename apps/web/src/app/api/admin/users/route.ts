import { NextRequest, NextResponse } from 'next/server'
import { and, eq, desc, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { wallets } from '@/lib/schema'
import { requireAdminSession, parsePositiveInt, isValidWallet } from '@/lib/admin'

type WalletRow = typeof wallets.$inferSelect

function serializeWallet(row: WalletRow) {
  return {
    address: row.address,
    chainId: row.chainId,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    restriction: row.restriction,
    isTrusted: row.isTrusted,
    isModerator: row.isModerator,
    isAdmin: row.isAdmin,
  }
}

// GET /api/admin/users?limit=&search=&role=admin|moderator|trusted|restricted
export async function GET(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const limit = parsePositiveInt(searchParams.get('limit'))
  const search = (searchParams.get('search') ?? '').trim().toLowerCase()
  const role = searchParams.get('role')

  try {
    const conditions = []
    if (role === 'admin') conditions.push(eq(wallets.isAdmin, true))
    if (role === 'moderator') conditions.push(eq(wallets.isModerator, true))
    if (role === 'trusted') conditions.push(eq(wallets.isTrusted, true))
    if (role === 'restricted') conditions.push(eq(wallets.restriction, 'RESTRICTED'))
    if (role === 'banned') conditions.push(eq(wallets.restriction, 'BANNED'))

    if (search) {
      conditions.push(like(wallets.address, `${search}%`))
    }

    const rows = await db
      .select()
      .from(wallets)
      .where(and(...conditions))
      .orderBy(desc(wallets.lastSeenAt))
      .limit(limit)

    return NextResponse.json({ users: rows.map(serializeWallet) })
  } catch {
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}
