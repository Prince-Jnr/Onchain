import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { entries } from '@/lib/schema'

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 120

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count += 1
  return true
}

// ---------------------------------------------------------------------------
// GET /api/feed/new-count
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = request.nextUrl
  const sinceParam = searchParams.get('since')

  if (!sinceParam) {
    return NextResponse.json({ error: 'since parameter is required' }, { status: 400 })
  }

  const sinceDate = new Date(sinceParam)
  if (isNaN(sinceDate.getTime())) {
    return NextResponse.json({ error: 'since must be a valid ISO timestamp' }, { status: 400 })
  }

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(entries)
      .where(
        and(
          eq(entries.status, 'ACTIVE'),
          gt(entries.createdAt, sinceDate),
        ),
      )

    return NextResponse.json({ count })
  } catch (error) {
    console.error('[feed/new-count] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
