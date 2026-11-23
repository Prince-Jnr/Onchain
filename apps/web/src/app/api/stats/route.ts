import { NextRequest, NextResponse } from 'next/server'
import { eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { wallets, entries } from '@/lib/schema'

// Next.js route segment config: cache for 5 minutes
export const revalidate = 300

// ---------------------------------------------------------------------------
// GET /api/stats — Public platform statistics
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const [
      [{ totalUsers }],
      [{ totalPosts }],
      [{ totalTransactions }],
    ] = await Promise.all([
      db
        .select({ totalUsers: sql<number>`count(*)::int` })
        .from(wallets),
      db
        .select({ totalPosts: sql<number>`count(*)::int` })
        .from(entries)
        .where(eq(entries.status, 'ACTIVE')),
      db
        .select({ totalTransactions: sql<number>`count(*)::int` })
        .from(entries)
        .where(isNotNull(entries.txHash)),
    ])

    return NextResponse.json({ totalUsers, totalPosts, totalTransactions })
  } catch (error) {
    console.error('[stats GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
