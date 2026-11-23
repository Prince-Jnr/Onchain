import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc, lt, sql, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  entries,
  entryContent,
  media,
  wallets,
  profiles,
  pendingEntries,
} from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'
import { createEntryContentDocument, getEntryContentReference } from '@onchain/shared'

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 60

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
      ? {
          text: content.text,
          hashtags: content.hashtags,
          mentions: content.mentions,
          metadata: content.metadata,
        }
      : null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
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
  }
}

// ---------------------------------------------------------------------------
// POST /api/entries — Create a new entry
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
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: { text?: unknown; mediaUrls?: unknown; media?: unknown; entryType?: unknown; parentId?: unknown; referenceId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 500) {
    return NextResponse.json({ error: 'text must contain 1–500 characters' }, { status: 400 })
  }
  const mediaUrls = Array.isArray(body.mediaUrls) && body.mediaUrls.every((url) => typeof url === 'string')
    ? body.mediaUrls as string[]
    : []
  if (mediaUrls.length > 4 || mediaUrls.some((url) => url.length > 2048)) {
    return NextResponse.json({ error: 'Invalid media URLs' }, { status: 400 })
  }
  const mediaItems = Array.isArray(body.media) ? body.media as { url?: unknown; ipfsCid?: unknown; mimeType?: unknown; sizeBytes?: unknown }[] : []
  const allowedMediaTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  if (mediaItems.length !== mediaUrls.length || mediaItems.some((item, index) =>
    item.url !== mediaUrls[index] || typeof item.ipfsCid !== 'string' || !/^bafy[a-z2-7]{20,}$/.test(item.ipfsCid) ||
    item.url !== `https://gateway.pinata.cloud/ipfs/${item.ipfsCid}` ||
    typeof item.mimeType !== 'string' || !allowedMediaTypes.has(item.mimeType) ||
    typeof item.sizeBytes !== 'number' || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || item.sizeBytes > 10 * 1024 * 1024
  )) {
    return NextResponse.json({ error: 'Media metadata does not match the pinned content URLs' }, { status: 400 })
  }
  if (new Set(mediaItems.map((item) => item.ipfsCid)).size !== mediaItems.length) {
    return NextResponse.json({ error: 'Duplicate image content references are not allowed' }, { status: 400 })
  }
  const entryTypes = ['POST', 'COMMENT', 'QUOTE'] as const
  if (!entryTypes.includes(body.entryType as (typeof entryTypes)[number])) {
    return NextResponse.json({ error: 'Invalid entry type' }, { status: 400 })
  }
  const entryType = body.entryType as (typeof entryTypes)[number]
  const parentChainId = body.parentId == null ? 0 : Number(body.parentId)
  const referenceChainId = body.referenceId == null ? 0 : Number(body.referenceId)
  if (!Number.isSafeInteger(parentChainId) || !Number.isSafeInteger(referenceChainId) || parentChainId < 0 || referenceChainId < 0) {
    return NextResponse.json({ error: 'Invalid entry reference' }, { status: 400 })
  }
  if ((entryType === 'POST' && (parentChainId !== 0 || referenceChainId !== 0)) ||
      (entryType === 'COMMENT' && (parentChainId === 0 || referenceChainId !== 0)) ||
      (entryType === 'QUOTE' && (parentChainId !== 0 || referenceChainId === 0))) {
    return NextResponse.json({ error: 'Entry type and references do not match' }, { status: 400 })
  }
  const document = createEntryContentDocument(body.text, mediaUrls)
  const contentRef = getEntryContentReference(document)
  const now = new Date()
  try {
    await db.delete(pendingEntries).where(and(eq(pendingEntries.authorAddress, session.walletAddress), lt(pendingEntries.expiresAt, now)))
    await db.insert(pendingEntries).values({
      authorAddress: session.walletAddress,
      chainId: session.chainId ?? 0,
      entryType,
      parentChainId,
      referenceChainId,
      contentRef,
      text: document.text,
      hashtags: document.hashtags,
      mentions: document.mentions,
      mediaUrls,
      mediaMetadata: mediaItems,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    }).onConflictDoUpdate({
      target: [pendingEntries.authorAddress, pendingEntries.contentRef],
      set: {
        chainId: session.chainId ?? 0,
        entryType,
        parentChainId,
        referenceChainId,
        text: document.text,
        hashtags: document.hashtags,
        mentions: document.mentions,
        mediaUrls,
        mediaMetadata: mediaItems,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    })
    return NextResponse.json({ contentRef, document })
  } catch (error) {
    console.error('[entries prepare] Could not stage pending content:', error)
    return NextResponse.json({ error: 'Could not prepare this entry. Try again.' }, { status: 503 })
  }
}

// ---------------------------------------------------------------------------
// GET /api/entries — List entries with filters
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
  const authorFilter = searchParams.get('author')
  const cursorParam = searchParams.get('cursor')
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = Math.min(Math.max(rawLimit, 1), 50)

  if (!authorFilter) {
    return NextResponse.json(
      { error: 'author query parameter is required' },
      { status: 400 },
    )
  }

  const normalizedAuthor = authorFilter.toLowerCase()

  try {
    const conditions = [
      eq(entries.authorAddress, normalizedAuthor),
      eq(entries.status, 'ACTIVE'),
    ]

    if (cursorParam) {
      const cursorDate = new Date(cursorParam)
      if (!isNaN(cursorDate.getTime())) {
        conditions.push(lt(entries.createdAt, cursorDate))
      }
    }

    const entryRows = await db
      .select()
      .from(entries)
      .where(and(...conditions))
      .orderBy(desc(entries.createdAt))
      .limit(limit + 1)

    const hasMore = entryRows.length > limit
    if (hasMore) entryRows.pop()

    if (entryRows.length === 0) {
      return NextResponse.json({ entries: [], nextCursor: null, total: 0 })
    }

    const entryIds = entryRows.map((e) => e.id)

    const [contentRows, mediaRows, [walletRow], [profileRow]] = await Promise.all([
      db.select().from(entryContent).where(inArray(entryContent.entryId, entryIds)),
      db.select().from(media).where(inArray(media.entryId, entryIds)),
      db.select().from(wallets).where(eq(wallets.address, normalizedAuthor)).limit(1),
      db.select().from(profiles).where(eq(profiles.walletAddress, normalizedAuthor)).limit(1),
    ])

    const contentMap = new Map(contentRows.map((c) => [c.entryId, c]))
    const mediaMap = new Map<number, MediaRow[]>()
    for (const m of mediaRows) {
      const arr = mediaMap.get(m.entryId) ?? []
      arr.push(m)
      mediaMap.set(m.entryId, arr)
    }

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(entries)
      .where(and(eq(entries.authorAddress, normalizedAuthor), eq(entries.status, 'ACTIVE')))

    const serialized = entryRows.map((e) =>
      serializeEntry(
        e,
        contentMap.get(e.id) ?? null,
        mediaMap.get(e.id) ?? [],
        walletRow ?? null,
        profileRow ?? null,
      ),
    )

    const nextCursor = hasMore
      ? entryRows[entryRows.length - 1].createdAt.toISOString()
      : null

    return NextResponse.json({ entries: serialized, nextCursor, total })
  } catch (error) {
    console.error('[entries GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
