import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc, lt, sql, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  entries,
  entryContent,
  media,
  wallets,
  profiles,
  hashtags,
  entryHashtags,
  mentions,
  notifications,
} from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'

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

/** Extract hashtags from text: #word */
function extractHashtags(text: string): string[] {
  const matches = text.match(/#([a-zA-Z0-9_]+)/g) ?? []
  return [...new Set(matches.map((t) => t.slice(1).toLowerCase()))]
}

/** Extract Ethereum address mentions: @0x... */
function extractMentions(text: string): string[] {
  const matches = text.match(/@(0x[a-fA-F0-9]{40})\b/g) ?? []
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))]
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

  let body: {
    contentRef?: unknown
    entryType?: unknown
    parentId?: unknown
    referenceId?: unknown
    txHash?: unknown
    content?: { text?: unknown }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate contentRef
  if (typeof body.contentRef !== 'string' || !body.contentRef.trim()) {
    return NextResponse.json({ error: 'contentRef must be a non-empty string' }, { status: 400 })
  }
  if (body.contentRef.length > 512) {
    return NextResponse.json({ error: 'contentRef must not exceed 512 characters' }, { status: 400 })
  }

  // Validate entryType
  const validTypes = ['POST', 'COMMENT', 'QUOTE'] as const
  if (!validTypes.includes(body.entryType as (typeof validTypes)[number])) {
    return NextResponse.json({ error: 'entryType must be POST, COMMENT, or QUOTE' }, { status: 400 })
  }
  const entryType = body.entryType as 'POST' | 'COMMENT' | 'QUOTE'

  // Validate content text
  if (
    !body.content ||
    typeof body.content.text !== 'string' ||
    !body.content.text.trim()
  ) {
    return NextResponse.json({ error: 'content.text must be a non-empty string' }, { status: 400 })
  }
  if (body.content.text.length > 500) {
    return NextResponse.json({ error: 'content.text must not exceed 500 characters' }, { status: 400 })
  }

  const contentText = body.content.text as string
  const contentRef = body.contentRef as string
  const txHash = typeof body.txHash === 'string' ? body.txHash : null

  // Validate parentId if provided
  let parentId: number | null = null
  if (body.parentId !== undefined && body.parentId !== null) {
    const pid = Number(body.parentId)
    if (!Number.isInteger(pid) || pid <= 0) {
      return NextResponse.json({ error: 'parentId must be a positive integer' }, { status: 400 })
    }
    const [parentEntry] = await db
      .select({ id: entries.id })
      .from(entries)
      .where(eq(entries.id, pid))
      .limit(1)
    if (!parentEntry) {
      return NextResponse.json({ error: 'parentId does not exist' }, { status: 400 })
    }
    parentId = pid
  }

  // Validate referenceId if provided
  let referenceId: number | null = null
  if (body.referenceId !== undefined && body.referenceId !== null) {
    const rid = Number(body.referenceId)
    if (!Number.isInteger(rid) || rid <= 0) {
      return NextResponse.json({ error: 'referenceId must be a positive integer' }, { status: 400 })
    }
    const [refEntry] = await db
      .select({ id: entries.id })
      .from(entries)
      .where(eq(entries.id, rid))
      .limit(1)
    if (!refEntry) {
      return NextResponse.json({ error: 'referenceId does not exist' }, { status: 400 })
    }
    referenceId = rid
  }

  try {
    // Insert entry
    const [newEntry] = await db
      .insert(entries)
      .values({
        authorAddress: session.walletAddress,
        entryType,
        parentId,
        referenceId,
        contentRef,
        txHash,
        status: 'ACTIVE',
      })
      .returning()

    // Insert content
    const tagList = extractHashtags(contentText)
    const mentionList = extractMentions(contentText)

    const [newContent] = await db
      .insert(entryContent)
      .values({
        entryId: newEntry.id,
        text: contentText,
        hashtags: tagList,
        mentions: mentionList,
      })
      .returning()

    // Process hashtags: upsert each, then link
    if (tagList.length > 0) {
      for (const tag of tagList) {
        const [upsertedTag] = await db
          .insert(hashtags)
          .values({ tag, postCount: 1 })
          .onConflictDoUpdate({
            target: hashtags.tag,
            set: {
              postCount: sql`${hashtags.postCount} + 1`,
              lastUsedAt: new Date(),
            },
          })
          .returning({ id: hashtags.id })

        await db
          .insert(entryHashtags)
          .values({ entryId: newEntry.id, hashtagId: upsertedTag.id })
          .onConflictDoNothing()
      }
    }

    // Process mentions: insert mention records + notifications
    if (mentionList.length > 0) {
      for (const address of mentionList) {
        // Skip self-mentions
        if (address === session.walletAddress) continue

        // Insert mention record
        await db
          .insert(mentions)
          .values({ entryId: newEntry.id, mentionedAddress: address })
          .onConflictDoNothing()

        // Check if mentioned wallet exists before creating notification
        const [mentionedWallet] = await db
          .select({ address: wallets.address })
          .from(wallets)
          .where(eq(wallets.address, address))
          .limit(1)

        if (mentionedWallet) {
          await db.insert(notifications).values({
            recipientAddress: address,
            type: 'MENTION',
            actorAddress: session.walletAddress,
            targetEntryId: newEntry.id,
          })
        }
      }
    }

    // Also create a REPLY notification if this is a comment on someone else's post
    if (entryType === 'COMMENT' && parentId) {
      const [parentEntryRow] = await db
        .select({ authorAddress: entries.authorAddress })
        .from(entries)
        .where(eq(entries.id, parentId))
        .limit(1)

      if (parentEntryRow && parentEntryRow.authorAddress !== session.walletAddress) {
        await db.insert(notifications).values({
          recipientAddress: parentEntryRow.authorAddress,
          type: 'REPLY',
          actorAddress: session.walletAddress,
          targetEntryId: newEntry.id,
        })
      }
    }

    // Fetch author wallet + profile for response
    const [walletRow] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.address, session.walletAddress))
      .limit(1)
    const [profileRow] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.walletAddress, session.walletAddress))
      .limit(1)

    return NextResponse.json(
      serializeEntry(newEntry, newContent, [], walletRow ?? null, profileRow ?? null),
      { status: 201 },
    )
  } catch (error) {
    console.error('[entries POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
