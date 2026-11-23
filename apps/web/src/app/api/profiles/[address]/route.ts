import { NextRequest, NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { wallets, profiles, badges } from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'

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
// GET /api/profiles/[address]
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
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

  const { address: rawAddress } = await params
  const address = rawAddress.toLowerCase()

  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
  }

  try {
    const [walletRow] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.address, address))
      .limit(1)

    if (!walletRow) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    const [profileRow] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.walletAddress, address))
      .limit(1)

    const badgeRows = await db
      .select()
      .from(badges)
      .where(eq(badges.walletAddress, address))

    return NextResponse.json({
      walletAddress: walletRow.address,
      displayName: profileRow?.displayName ?? null,
      bio: profileRow?.bio ?? null,
      avatarUrl: profileRow?.avatarUrl ?? null,
      bannerUrl: profileRow?.bannerUrl ?? null,
      website: profileRow?.website ?? null,
      twitterHandle: profileRow?.twitterHandle ?? null,
      githubHandle: profileRow?.githubHandle ?? null,
      metadataRef: profileRow?.metadataRef ?? null,
      registeredAt: profileRow?.registeredAt?.toISOString() ?? null,
      updatedAt: profileRow?.updatedAt?.toISOString() ?? null,
      isActive: profileRow?.isActive ?? true,
      followerCount: profileRow?.followerCount ?? 0,
      followingCount: profileRow?.followingCount ?? 0,
      postCount: profileRow?.postCount ?? 0,
      restriction: walletRow.restriction,
      isTrusted: walletRow.isTrusted,
      isModerator: walletRow.isModerator,
      isAdmin: walletRow.isAdmin,
      badges: badgeRows.map((b) => ({ type: b.type, earnedAt: b.earnedAt.toISOString() })),
    })
  } catch (error) {
    console.error('[profiles/[address] GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/profiles/[address] — Update own profile
// ---------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { address: rawAddress } = await params
  const address = rawAddress.toLowerCase()

  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
  }

  if (session.walletAddress !== address) {
    return NextResponse.json({ error: 'Forbidden: cannot update another user\'s profile' }, { status: 403 })
  }

  let body: {
    displayName?: unknown
    bio?: unknown
    avatarUrl?: unknown
    bannerUrl?: unknown
    website?: unknown
    twitterHandle?: unknown
    githubHandle?: unknown
    metadataRef?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Field validation
  const errors: string[] = []

  if (body.displayName !== undefined) {
    if (typeof body.displayName !== 'string') errors.push('displayName must be a string')
    else if (body.displayName.length > 50) errors.push('displayName must not exceed 50 characters')
  }
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string') errors.push('bio must be a string')
    else if (body.bio.length > 500) errors.push('bio must not exceed 500 characters')
  }
  if (body.avatarUrl !== undefined && body.avatarUrl !== null) {
    if (typeof body.avatarUrl !== 'string') errors.push('avatarUrl must be a string')
    else if (body.avatarUrl.length > 2048) errors.push('avatarUrl must not exceed 2048 characters')
  }
  if (body.bannerUrl !== undefined && body.bannerUrl !== null) {
    if (typeof body.bannerUrl !== 'string') errors.push('bannerUrl must be a string')
    else if (body.bannerUrl.length > 2048) errors.push('bannerUrl must not exceed 2048 characters')
  }
  if (body.website !== undefined && body.website !== null) {
    if (typeof body.website !== 'string') errors.push('website must be a string')
    else if (body.website.length > 512) errors.push('website must not exceed 512 characters')
  }
  if (body.twitterHandle !== undefined && body.twitterHandle !== null) {
    if (typeof body.twitterHandle !== 'string') errors.push('twitterHandle must be a string')
    else if (body.twitterHandle.length > 50) errors.push('twitterHandle must not exceed 50 characters')
  }
  if (body.githubHandle !== undefined && body.githubHandle !== null) {
    if (typeof body.githubHandle !== 'string') errors.push('githubHandle must be a string')
    else if (body.githubHandle.length > 50) errors.push('githubHandle must not exceed 50 characters')
  }
  if (body.metadataRef !== undefined && body.metadataRef !== null) {
    if (typeof body.metadataRef !== 'string') errors.push('metadataRef must be a string')
    else if (body.metadataRef.length > 512) errors.push('metadataRef must not exceed 512 characters')
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  // Build update payload (only include provided fields)
  type ProfileUpdate = {
    walletAddress: string
    updatedAt: Date
    displayName?: string | null
    bio?: string | null
    avatarUrl?: string | null
    bannerUrl?: string | null
    website?: string | null
    twitterHandle?: string | null
    githubHandle?: string | null
    metadataRef?: string | null
  }

  const updateValues: ProfileUpdate = {
    walletAddress: address,
    updatedAt: new Date(),
  }

  if (body.displayName !== undefined) updateValues.displayName = body.displayName as string | null
  if (body.bio !== undefined) updateValues.bio = body.bio as string | null
  if (body.avatarUrl !== undefined) updateValues.avatarUrl = body.avatarUrl as string | null
  if (body.bannerUrl !== undefined) updateValues.bannerUrl = body.bannerUrl as string | null
  if (body.website !== undefined) updateValues.website = body.website as string | null
  if (body.twitterHandle !== undefined) updateValues.twitterHandle = body.twitterHandle as string | null
  if (body.githubHandle !== undefined) updateValues.githubHandle = body.githubHandle as string | null
  if (body.metadataRef !== undefined) updateValues.metadataRef = body.metadataRef as string | null

  try {
    // Ensure wallet exists
    const [walletRow] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.address, address))
      .limit(1)

    if (!walletRow) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    // Upsert profile
    const [updatedProfile] = await db
      .insert(profiles)
      .values(updateValues)
      .onConflictDoUpdate({
        target: profiles.walletAddress,
        set: { ...updateValues },
      })
      .returning()

    const badgeRows = await db
      .select()
      .from(badges)
      .where(eq(badges.walletAddress, address))

    return NextResponse.json({
      walletAddress: walletRow.address,
      displayName: updatedProfile.displayName ?? null,
      bio: updatedProfile.bio ?? null,
      avatarUrl: updatedProfile.avatarUrl ?? null,
      bannerUrl: updatedProfile.bannerUrl ?? null,
      website: updatedProfile.website ?? null,
      twitterHandle: updatedProfile.twitterHandle ?? null,
      githubHandle: updatedProfile.githubHandle ?? null,
      metadataRef: updatedProfile.metadataRef ?? null,
      registeredAt: updatedProfile.registeredAt?.toISOString() ?? null,
      updatedAt: updatedProfile.updatedAt.toISOString(),
      isActive: updatedProfile.isActive,
      followerCount: updatedProfile.followerCount,
      followingCount: updatedProfile.followingCount,
      postCount: updatedProfile.postCount,
      restriction: walletRow.restriction,
      isTrusted: walletRow.isTrusted,
      isModerator: walletRow.isModerator,
      isAdmin: walletRow.isAdmin,
      badges: badgeRows.map((b) => ({ type: b.type, earnedAt: b.earnedAt.toISOString() })),
    })
  } catch (error) {
    console.error('[profiles/[address] PATCH] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
