import { NextRequest, NextResponse } from 'next/server'
import { eq, desc, lt, sql, inArray, ilike, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { checkRateLimit as pgCheckRateLimit } from '@/lib/rate-limit'
import {
  entries,
  entryContent,
  media,
  wallets,
  profiles,
  hashtags,
  badges,
} from '@/lib/schema'

// ---------------------------------------------------------------------------
// Rate limiting (distributed, PostgreSQL-backed)
async function checkRateLimit(ip: string): Promise<boolean> {
  const result = await pgCheckRateLimit(`search:${ip}`, { max: 60, windowMs: 60_000 })
  return result.allowed
}

// ---------------------------------------------------------------------------
// GET /api/search
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  if (!(await checkRateLimit(ip))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')?.trim() ?? ''
  const searchType = searchParams.get('type') ?? 'all'
  const cursorParam = searchParams.get('cursor')
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = Math.min(Math.max(rawLimit, 1), 50)

  if (!q) {
    return NextResponse.json({ error: 'q parameter is required' }, { status: 400 })
  }

  const validTypes = ['all', 'entries', 'profiles', 'hashtags']
  if (!validTypes.includes(searchType)) {
    return NextResponse.json(
      { error: 'type must be all, entries, profiles, or hashtags' },
      { status: 400 },
    )
  }

  const searchPattern = `%${q}%`

  try {
    let entryResults: ReturnType<typeof serializeEntry>[] = []
    let profileResults: ReturnType<typeof serializeProfile>[] = []
    let hashtagResults: { id: number; tag: string; postCount: number }[] = []
    let total = 0

    // -----------------------------------------------------------------------
    // Search entries
    // -----------------------------------------------------------------------
    if (searchType === 'all' || searchType === 'entries') {
      // Find content rows matching the search term
      const contentMatches = await db
        .select({ entryId: entryContent.entryId })
        .from(entryContent)
        .where(ilike(entryContent.text, searchPattern))

      if (contentMatches.length > 0) {
        const matchedEntryIds = contentMatches.map((c) => c.entryId)

        const cursorDate = cursorParam ? new Date(cursorParam) : null

        // Filter by cursor if provided
        let entryRows: (typeof entries.$inferSelect)[]

        if (cursorDate && !isNaN(cursorDate.getTime())) {
          entryRows = await db
            .select()
            .from(entries)
            .where(
              sql`${entries.id} = ANY(${sql.raw(`ARRAY[${matchedEntryIds.join(',')}]::int[]`)})
                AND ${entries.status} = 'ACTIVE'
                AND ${entries.createdAt} < ${cursorDate}`,
            )
            .orderBy(desc(entries.createdAt))
            .limit(limit + 1)
        } else {
          entryRows = await db
            .select()
            .from(entries)
            .where(
              sql`${entries.id} = ANY(${sql.raw(`ARRAY[${matchedEntryIds.join(',')}]::int[]`)})
                AND ${entries.status} = 'ACTIVE'`,
            )
            .orderBy(desc(entries.createdAt))
            .limit(limit + 1)
        }

        const hasMore = entryRows.length > limit
        if (hasMore) entryRows.pop()

        if (entryRows.length > 0) {
          const entryIds = entryRows.map((e) => e.id)
          const authorAddresses = [...new Set(entryRows.map((e) => e.authorAddress))]

          const [contentRows, mediaRows, walletRows, profileRows] = await Promise.all([
            db.select().from(entryContent).where(inArray(entryContent.entryId, entryIds)),
            db.select().from(media).where(inArray(media.entryId, entryIds)),
            db.select().from(wallets).where(inArray(wallets.address, authorAddresses)),
            db.select().from(profiles).where(inArray(profiles.walletAddress, authorAddresses)),
          ])

          const contentMap = new Map(contentRows.map((c) => [c.entryId, c]))
          const mediaMap = new Map<number, (typeof media.$inferSelect)[]>()
          for (const m of mediaRows) {
            const arr = mediaMap.get(m.entryId) ?? []
            arr.push(m)
            mediaMap.set(m.entryId, arr)
          }
          const walletMap = new Map(walletRows.map((w) => [w.address, w]))
          const profileMap = new Map(profileRows.map((p) => [p.walletAddress, p]))

          entryResults = entryRows.map((e) =>
            serializeEntry(
              e,
              contentMap.get(e.id) ?? null,
              mediaMap.get(e.id) ?? [],
              walletMap.get(e.authorAddress) ?? null,
              profileMap.get(e.authorAddress) ?? null,
            ),
          )
        }

        total += entryResults.length
      }
    }

    // -----------------------------------------------------------------------
    // Search profiles
    // -----------------------------------------------------------------------
    if (searchType === 'all' || searchType === 'profiles') {
      const profileRows = await db
        .select()
        .from(profiles)
        .where(or(ilike(profiles.displayName, searchPattern), ilike(profiles.walletAddress, searchPattern)))
        .limit(limit)

      // Also search wallets by address (handles cases with no profile)
      const walletMatches = await db
        .select()
        .from(wallets)
        .where(ilike(wallets.address, searchPattern))
        .limit(limit)

      // Merge: collect all addresses
      const profileAddresses = new Set(profileRows.map((p) => p.walletAddress))
      const allAddresses = [
        ...profileAddresses,
        ...walletMatches.map((w) => w.address).filter((a) => !profileAddresses.has(a)),
      ]

      if (allAddresses.length > 0) {
        const [walletRows, extraProfileRows, badgeRows] = await Promise.all([
          db.select().from(wallets).where(inArray(wallets.address, allAddresses)),
          db.select().from(profiles).where(inArray(profiles.walletAddress, allAddresses)),
          db.select().from(badges).where(inArray(badges.walletAddress, allAddresses)),
        ])

        const walletMap = new Map(walletRows.map((w) => [w.address, w]))
        const profileMap = new Map(extraProfileRows.map((p) => [p.walletAddress, p]))
        const badgeMap = new Map<string, (typeof badges.$inferSelect)[]>()
        for (const b of badgeRows) {
          const arr = badgeMap.get(b.walletAddress) ?? []
          arr.push(b)
          badgeMap.set(b.walletAddress, arr)
        }

        profileResults = allAddresses.slice(0, limit).map((addr) =>
          serializeProfile(
            walletMap.get(addr) ?? null,
            profileMap.get(addr) ?? null,
            badgeMap.get(addr) ?? [],
          ),
        ).filter((p): p is ReturnType<typeof serializeProfile> => p !== null)
      }

      total += profileResults.length
    }

    // -----------------------------------------------------------------------
    // Search hashtags
    // -----------------------------------------------------------------------
    if (searchType === 'all' || searchType === 'hashtags') {
      const hashtagRows = await db
        .select()
        .from(hashtags)
        .where(ilike(hashtags.tag, searchPattern))
        .orderBy(desc(hashtags.postCount))
        .limit(limit)

      hashtagResults = hashtagRows.map((h) => ({
        id: h.id,
        tag: h.tag,
        postCount: h.postCount,
      }))

      total += hashtagResults.length
    }

    return NextResponse.json({
      entries: entryResults,
      profiles: profileResults,
      hashtags: hashtagResults,
      total,
    })
  } catch (error) {
    console.error('[search GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

function serializeEntry(
  entry: typeof entries.$inferSelect,
  content: typeof entryContent.$inferSelect | null,
  mediaRows: (typeof media.$inferSelect)[],
  wallet: typeof wallets.$inferSelect | null,
  profile: typeof profiles.$inferSelect | null,
) {
  return {
    id: entry.id,
    chainEntryId: entry.chainEntryId,
    txHash: entry.txHash,
    authorAddress: entry.authorAddress,
    entryType: entry.entryType,
    parentId: entry.parentId,
    referenceId: entry.referenceId,
    contentRef: entry.contentRef,
    content: content
      ? { text: content.text, hashtags: content.hashtags, mentions: content.mentions }
      : null,
    createdAt: entry.createdAt.toISOString(),
    status: entry.status,
    pinned: entry.pinned,
    reactionCounts: {
      LIKE: entry.reactionLike,
      LOVE: entry.reactionLove,
      LAUGH: entry.reactionLaugh,
      WOW: entry.reactionWow,
      SAD: entry.reactionSad,
      ANGRY: entry.reactionAngry,
    },
    totalReactions: entry.totalReactions,
    commentCount: entry.commentCount,
    repostCount: entry.repostCount,
    media: mediaRows.map((m) => ({
      id: m.id,
      url: m.url,
      mimeType: m.mimeType,
      altText: m.altText,
    })),
    authorProfile: {
      walletAddress: entry.authorAddress,
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      isTrusted: wallet?.isTrusted ?? false,
    },
  }
}

function serializeProfile(
  wallet: typeof wallets.$inferSelect | null,
  profile: typeof profiles.$inferSelect | null,
  badgeRows: (typeof badges.$inferSelect)[],
) {
  if (!wallet) return null
  return {
    walletAddress: wallet.address,
    displayName: profile?.displayName ?? null,
    bio: profile?.bio ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    followerCount: profile?.followerCount ?? 0,
    followingCount: profile?.followingCount ?? 0,
    postCount: profile?.postCount ?? 0,
    isTrusted: wallet.isTrusted,
    isModerator: wallet.isModerator,
    isAdmin: wallet.isAdmin,
    badges: badgeRows.map((b) => ({ type: b.type, earnedAt: b.earnedAt.toISOString() })),
  }
}
