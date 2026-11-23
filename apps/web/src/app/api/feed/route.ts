import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc, lt, gt, sql, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  entries,
  entryContent,
  media,
  reactions,
  reposts,
  bookmarks,
  follows,
  wallets,
  profiles,
} from '@/lib/schema'
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
// Helpers
// ---------------------------------------------------------------------------

type EntryRow = typeof entries.$inferSelect
type ContentRow = typeof entryContent.$inferSelect
type MediaRow = typeof media.$inferSelect
type WalletRow = typeof wallets.$inferSelect
type ProfileRow = typeof profiles.$inferSelect

function serializeEntry(
  entry: EntryRow,
  content: ContentRow | null,
  mediaRows: MediaRow[],
  wallet: WalletRow | null,
  profile: ProfileRow | null,
  viewerReaction?: string | null,
  viewerHasReposted?: boolean,
  viewerHasBookmarked?: boolean,
) {
  return {
    id: entry.id,
    txHash: entry.txHash,
    authorAddress: entry.authorAddress,
    entryType: entry.entryType,
    parentId: entry.parentId,
    referenceId: entry.referenceId,
    contentRef: entry.contentRef,
    content: content
      ? {
          text: content.text,
          hashtags: content.hashtags,
          mentions: content.mentions,
          metadata: content.metadata,
        }
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
      ipfsCid: m.ipfsCid,
      mimeType: m.mimeType,
      width: m.width,
      height: m.height,
      altText: m.altText,
    })),
    authorProfile: {
      walletAddress: entry.authorAddress,
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      isTrusted: wallet?.isTrusted ?? false,
      isModerator: wallet?.isModerator ?? false,
      isAdmin: wallet?.isAdmin ?? false,
    },
    ...(viewerReaction !== undefined && {
      viewerReaction: viewerReaction ?? null,
      viewerHasReposted: viewerHasReposted ?? false,
      viewerHasBookmarked: viewerHasBookmarked ?? false,
    }),
  }
}

// ---------------------------------------------------------------------------
// GET /api/feed
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
  const feedType = searchParams.get('type') ?? 'latest'
  const cursorParam = searchParams.get('cursor')
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = Math.min(Math.max(rawLimit, 1), 50)

  const session = await getAuthenticatedSession()
  const viewerAddress = session?.walletAddress ?? null

  try {
    // Build base conditions
    const baseConditions = [eq(entries.status, 'ACTIVE')]

    if (cursorParam) {
      const cursorDate = new Date(cursorParam)
      if (!isNaN(cursorDate.getTime())) {
        baseConditions.push(lt(entries.createdAt, cursorDate))
      }
    }

    let entryRows: EntryRow[] = []

    if (feedType === 'following') {
      if (!viewerAddress) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      // Get followed addresses
      const followedRows = await db
        .select({ followedAddress: follows.followedAddress })
        .from(follows)
        .where(and(eq(follows.followerAddress, viewerAddress), eq(follows.active, true)))

      const followedAddresses = followedRows.map((r) => r.followedAddress)

      if (followedAddresses.length === 0) {
        return NextResponse.json({ entries: [], nextCursor: null, total: 0 })
      }

      entryRows = await db
        .select()
        .from(entries)
        .where(and(...baseConditions, inArray(entries.authorAddress, followedAddresses)))
        .orderBy(desc(entries.createdAt))
        .limit(limit + 1)
    } else if (feedType === 'popular') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const popularConditions = [...baseConditions, gt(entries.createdAt, sevenDaysAgo)]

      entryRows = await db
        .select()
        .from(entries)
        .where(and(...popularConditions))
        .orderBy(desc(sql`${entries.totalReactions} + ${entries.repostCount}`))
        .limit(limit + 1)
    } else if (feedType === 'trending') {
      // Last 24h, ranked by reactions + reposts
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const trendingConditions = [...baseConditions, gt(entries.createdAt, oneDayAgo)]

      entryRows = await db
        .select()
        .from(entries)
        .where(and(...trendingConditions))
        .orderBy(desc(sql`${entries.totalReactions} + ${entries.repostCount}`))
        .limit(limit + 1)
    } else if (feedType === 'featured') {
      entryRows = await db
        .select()
        .from(entries)
        .where(and(...baseConditions, eq(entries.pinned, true)))
        .orderBy(desc(entries.createdAt))
        .limit(limit + 1)
    } else {
      // 'latest' (default)
      entryRows = await db
        .select()
        .from(entries)
        .where(and(...baseConditions))
        .orderBy(desc(entries.createdAt))
        .limit(limit + 1)
    }

    // Determine if there's a next page
    const hasMore = entryRows.length > limit
    if (hasMore) entryRows.pop()

    if (entryRows.length === 0) {
      return NextResponse.json({ entries: [], nextCursor: null, total: 0 })
    }

    const entryIds = entryRows.map((e) => e.id)
    const authorAddresses = [...new Set(entryRows.map((e) => e.authorAddress))]

    // Batch fetch related data
    const [contentRows, mediaRows, walletRows, profileRows] = await Promise.all([
      db.select().from(entryContent).where(inArray(entryContent.entryId, entryIds)),
      db.select().from(media).where(inArray(media.entryId, entryIds)),
      db.select().from(wallets).where(inArray(wallets.address, authorAddresses)),
      db.select().from(profiles).where(inArray(profiles.walletAddress, authorAddresses)),
    ])

    // Viewer-specific data
    let viewerReactionRows: (typeof reactions.$inferSelect)[] = []
    let viewerRepostRows: (typeof reposts.$inferSelect)[] = []
    let viewerBookmarkRows: (typeof bookmarks.$inferSelect)[] = []

    if (viewerAddress) {
      ;[viewerReactionRows, viewerRepostRows, viewerBookmarkRows] = await Promise.all([
        db
          .select()
          .from(reactions)
          .where(
            and(
              inArray(reactions.entryId, entryIds),
              eq(reactions.walletAddress, viewerAddress),
            ),
          ),
        db
          .select()
          .from(reposts)
          .where(
            and(
              inArray(reposts.entryId, entryIds),
              eq(reposts.walletAddress, viewerAddress),
              eq(reposts.active, true),
            ),
          ),
        db
          .select()
          .from(bookmarks)
          .where(
            and(
              inArray(bookmarks.entryId, entryIds),
              eq(bookmarks.walletAddress, viewerAddress),
            ),
          ),
      ])
    }

    // Build lookup maps
    const contentMap = new Map(contentRows.map((c) => [c.entryId, c]))
    const mediaMap = new Map<number, MediaRow[]>()
    for (const m of mediaRows) {
      const arr = mediaMap.get(m.entryId) ?? []
      arr.push(m)
      mediaMap.set(m.entryId, arr)
    }
    const walletMap = new Map(walletRows.map((w) => [w.address, w]))
    const profileMap = new Map(profileRows.map((p) => [p.walletAddress, p]))
    const viewerReactionMap = new Map(viewerReactionRows.map((r) => [r.entryId, r.reactionType]))
    const viewerRepostSet = new Set(viewerRepostRows.map((r) => r.entryId))
    const viewerBookmarkSet = new Set(viewerBookmarkRows.map((r) => r.entryId))

    const serialized = entryRows.map((e) =>
      serializeEntry(
        e,
        contentMap.get(e.id) ?? null,
        mediaMap.get(e.id) ?? [],
        walletMap.get(e.authorAddress) ?? null,
        profileMap.get(e.authorAddress) ?? null,
        viewerAddress !== null ? (viewerReactionMap.get(e.id) ?? null) : undefined,
        viewerAddress !== null ? viewerRepostSet.has(e.id) : undefined,
        viewerAddress !== null ? viewerBookmarkSet.has(e.id) : undefined,
      ),
    )

    const nextCursor = hasMore ? entryRows[entryRows.length - 1].createdAt.toISOString() : null

    // Count total matching entries (without cursor filter for accurate total)
    const totalConditions = [eq(entries.status, 'ACTIVE')]
    if (feedType === 'featured') totalConditions.push(eq(entries.pinned, true))

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(entries)
      .where(and(...totalConditions))

    return NextResponse.json({ entries: serialized, nextCursor, total })
  } catch (error) {
    console.error('[feed] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
