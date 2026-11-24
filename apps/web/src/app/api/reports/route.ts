import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { entries, wallets, reports } from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'
import { checkRateLimit as pgCheckRateLimit } from '@/lib/rate-limit'

// ---------------------------------------------------------------------------
// Rate limiting (distributed, PostgreSQL-backed) — stricter for reports to prevent abuse
async function checkRateLimit(ip: string): Promise<boolean> {
  const result = await pgCheckRateLimit(`reports:${ip}`, { max: 10, windowMs: 60_000 })
  return result.allowed
}

// ---------------------------------------------------------------------------
// Valid report categories (matches schema enum)
// ---------------------------------------------------------------------------
const VALID_CATEGORIES = new Set([
  'SPAM',
  'HARASSMENT',
  'HATE_SPEECH',
  'MISINFORMATION',
  'ILLEGAL_CONTENT',
  'VIOLENT_CONTENT',
  'ADULT_CONTENT',
  'OTHER',
])

// ---------------------------------------------------------------------------
// POST /api/reports — Submit an off-chain report
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  if (!(await checkRateLimit(ip))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: {
    entryId?: unknown
    targetWallet?: unknown
    category?: unknown
    description?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate category
  if (typeof body.category !== 'string' || !VALID_CATEGORIES.has(body.category)) {
    return NextResponse.json(
      {
        error: `category must be one of: ${[...VALID_CATEGORIES].join(', ')}`,
      },
      { status: 400 },
    )
  }
  const category = body.category as typeof reports.$inferInsert['category']

  // At least one target must be provided
  if (body.entryId === undefined && body.targetWallet === undefined) {
    return NextResponse.json(
      { error: 'At least one of entryId or targetWallet is required' },
      { status: 400 },
    )
  }

  // Validate description
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      return NextResponse.json({ error: 'description must be a string' }, { status: 400 })
    }
    if (body.description.length > 2000) {
      return NextResponse.json(
        { error: 'description must not exceed 2000 characters' },
        { status: 400 },
      )
    }
  }

  // Validate entryId if provided
  let targetEntryId: number | null = null
  if (body.entryId !== undefined && body.entryId !== null) {
    const eid = Number(body.entryId)
    if (!Number.isInteger(eid) || eid <= 0) {
      return NextResponse.json({ error: 'entryId must be a positive integer' }, { status: 400 })
    }
    const [entryRow] = await db
      .select({ id: entries.id, status: entries.status })
      .from(entries)
      .where(eq(entries.id, eid))
      .limit(1)

    if (!entryRow || entryRow.status === 'DELETED') {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }
    targetEntryId = eid
  }

  // Validate targetWallet if provided
  let targetWalletAddress: string | null = null
  if (body.targetWallet !== undefined && body.targetWallet !== null) {
    if (typeof body.targetWallet !== 'string') {
      return NextResponse.json({ error: 'targetWallet must be a string' }, { status: 400 })
    }
    const normalized = body.targetWallet.toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
      return NextResponse.json({ error: 'targetWallet must be a valid Ethereum address' }, { status: 400 })
    }

    // Cannot report yourself
    if (normalized === session.walletAddress) {
      return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 })
    }

    const [walletRow] = await db
      .select({ address: wallets.address })
      .from(wallets)
      .where(eq(wallets.address, normalized))
      .limit(1)

    if (!walletRow) {
      return NextResponse.json({ error: 'Target wallet not found' }, { status: 404 })
    }

    targetWalletAddress = normalized
  }

  try {
    const [newReport] = await db
      .insert(reports)
      .values({
        reporterAddress: session.walletAddress,
        targetEntryId,
        targetWalletAddress,
        category,
        status: 'PENDING',
        notes: typeof body.description === 'string' ? body.description : null,
      })
      .returning({ id: reports.id })

    return NextResponse.json({ success: true, reportId: newReport.id }, { status: 201 })
  } catch (error) {
    console.error('[reports POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
