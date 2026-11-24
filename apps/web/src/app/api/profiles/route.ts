import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { profiles, wallets } from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'

const profileValidation = (body: Record<string, unknown>) => {
  const errors: string[] = []
  if (body.displayName !== undefined) {
    if (typeof body.displayName !== 'string') errors.push('displayName must be a string')
    else if (body.displayName.length > 50) errors.push('displayName must not exceed 50 characters')
    else if (body.displayName.trim().length > 0 && body.displayName.trim().length !== body.displayName.length)
      errors.push('displayName must not have leading/trailing whitespace')
  }
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string') errors.push('bio must be a string')
    else if (body.bio.length > 500) errors.push('bio must not exceed 500 characters')
  }
  if (body.website !== undefined && body.website !== null) {
    if (typeof body.website !== 'string') errors.push('website must be a string')
    else if (body.website.length > 500) errors.push('website must not exceed 500 characters')
    else if (body.website.length > 0 && !/^https?:\/\//i.test(body.website)) errors.push('website must be an http(s) URL')
  }
  for (const field of ['twitterHandle', 'githubHandle'] as const) {
    const value = body[field]
    if (value === undefined || value === null) continue
    if (typeof value !== 'string') {
      errors.push(`${field} must be a string`)
    } else {
      const cleaned = value.replace(/^@/, '').toLowerCase()
      if (cleaned.length > 0 && (/^[a-z0-9_]{1,30}$/.test(cleaned) === false || cleaned.includes('..'))) {
        errors.push(`${field} is not a valid handle`)
      }
    }
  }
  if (body.avatarUrl !== undefined && body.avatarUrl !== null) {
    if (typeof body.avatarUrl !== 'string') errors.push('avatarUrl must be a string')
    else if (body.avatarUrl.length > 2048) errors.push('avatarUrl is too long')
  }
  if (body.bannerUrl !== undefined && body.bannerUrl !== null) {
    if (typeof body.bannerUrl !== 'string') errors.push('bannerUrl must be a string')
    else if (body.bannerUrl.length > 2048) errors.push('bannerUrl is too long')
  }
  return errors
}

// ---------------------------------------------------------------------------
// POST /api/profiles — update the authenticated user's profile
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors = profileValidation(body)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(', ') }, { status: 400 })
  }

  const address = session.walletAddress.toLowerCase() as string
  const update: {
    displayName?: string | null
    bio?: string | null
    website?: string | null
    twitterHandle?: string | null
    githubHandle?: string | null
    avatarUrl?: string | null
    bannerUrl?: string | null
    updatedAt: Date
  } = { updatedAt: new Date() }
  for (const field of ['displayName', 'bio', 'website', 'twitterHandle', 'githubHandle', 'avatarUrl', 'bannerUrl'] as const) {
    if (body[field] !== undefined) update[field] = (body[field] as string | null) ?? null
  }

  try {
    const [row] = await db
      .update(profiles)
      .set(update)
      .where(eq(profiles.walletAddress, address))
      .returning()
    await db.insert(wallets).values({ address }).onConflictDoNothing()
    if (!row) {
      await db.insert(profiles).values({ walletAddress: address, ...update })
      const [created] = await db.select().from(profiles).where(eq(profiles.walletAddress, address))
      return NextResponse.json(created ? serializeProfile(created) : { ok: true })
    }
    return NextResponse.json(serializeProfile(row))
  } catch {
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}

function serializeProfile(row: typeof profiles.$inferSelect) {
  return {
    wallet: row.walletAddress,
    displayName: row.displayName ?? null,
    bio: row.bio ?? null,
    avatarUrl: row.avatarUrl ?? null,
    bannerUrl: row.bannerUrl ?? null,
    website: row.website ?? null,
    twitterHandle: row.twitterHandle ?? null,
    githubHandle: row.githubHandle ?? null,
    metadataRef: row.metadataRef ?? null,
    registeredAt: row.registeredAt,
    updatedAt: row.updatedAt.toISOString(),
    isActive: row.isActive,
    followerCount: row.followerCount,
    followingCount: row.followingCount,
    postCount: row.postCount,
    badges: [],
  }
}

// GET /api/profiles/me — used by settings/profile
export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const address = session.walletAddress.toLowerCase() as string
  const [row] = await db.select().from(profiles).where(eq(profiles.walletAddress, address))
  return NextResponse.json(row ? serializeProfile(row) : null)
}
