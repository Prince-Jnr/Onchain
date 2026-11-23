import { NextRequest, NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  entries,
  entryContent,
  media,
  wallets,
  profiles,
} from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EntryRow = typeof entries.$inferSelect
type ContentRow = typeof entryContent.$inferSelect
type MediaRow = typeof media.$inferSelect
type WalletRow = typeof wallets.$inferSelect
type ProfileRow = typeof profiles.$inferSelect
type SerializedEntry = Record<string, unknown>

function serializeEntry(
  entry: EntryRow,
  content: ContentRow | null,
  mediaRows: MediaRow[],
  wallet: WalletRow | null,
  profile: ProfileRow | null,
  referencedEntry?: SerializedEntry | null,
): SerializedEntry {
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
    referencedEntry: referencedEntry ?? null,
  }
}

// ---------------------------------------------------------------------------
// GET /api/entries/[id]
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id: idParam } = await params
  const id = parseInt(idParam, 10)
  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid entry ID' }, { status: 400 })
  }

  try {
    const [entry] = await db
      .select()
      .from(entries)
      .where(eq(entries.id, id))
      .limit(1)

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    if (entry.status === 'DELETED') {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Gather all IDs to fetch (entry + referenced entry)
    const idsToFetch = [entry.id]
    if (entry.referenceId) idsToFetch.push(entry.referenceId)

    const [contentRows, mediaRows] = await Promise.all([
      db.select().from(entryContent).where(inArray(entryContent.entryId, idsToFetch)),
      db.select().from(media).where(inArray(media.entryId, idsToFetch)),
    ])

    // Collect all author addresses
    const authorAddresses = [entry.authorAddress]
    let referencedEntryRow: EntryRow | null = null

    if (entry.referenceId) {
      const [refRow] = await db
        .select()
        .from(entries)
        .where(eq(entries.id, entry.referenceId))
        .limit(1)
      if (refRow) {
        referencedEntryRow = refRow
        if (!authorAddresses.includes(refRow.authorAddress)) {
          authorAddresses.push(refRow.authorAddress)
        }
      }
    }

    const [walletRows, profileRows] = await Promise.all([
      db.select().from(wallets).where(inArray(wallets.address, authorAddresses)),
      db.select().from(profiles).where(inArray(profiles.walletAddress, authorAddresses)),
    ])

    const contentMap = new Map(contentRows.map((c) => [c.entryId, c]))
    const mediaMap = new Map<number, MediaRow[]>()
    for (const m of mediaRows) {
      const arr = mediaMap.get(m.entryId) ?? []
      arr.push(m)
      mediaMap.set(m.entryId, arr)
    }
    const walletMap = new Map(walletRows.map((w) => [w.address, w]))
    const profileMap = new Map(profileRows.map((p) => [p.walletAddress, p]))

    let referencedSerialized = null
    if (referencedEntryRow) {
      referencedSerialized = serializeEntry(
        referencedEntryRow,
        contentMap.get(referencedEntryRow.id) ?? null,
        mediaMap.get(referencedEntryRow.id) ?? [],
        walletMap.get(referencedEntryRow.authorAddress) ?? null,
        profileMap.get(referencedEntryRow.authorAddress) ?? null,
      )
    }

    const result = serializeEntry(
      entry,
      contentMap.get(entry.id) ?? null,
      mediaMap.get(entry.id) ?? [],
      walletMap.get(entry.authorAddress) ?? null,
      profileMap.get(entry.authorAddress) ?? null,
      referencedSerialized,
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('[entries/[id] GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/entries/[id] — Soft-delete (requires auth, author or moderator)
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id: idParam } = await params
  const id = parseInt(idParam, 10)
  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid entry ID' }, { status: 400 })
  }

  try {
    const [entry] = await db
      .select()
      .from(entries)
      .where(eq(entries.id, id))
      .limit(1)

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    if (entry.status === 'DELETED') {
      return NextResponse.json({ error: 'Entry already deleted' }, { status: 410 })
    }

    // Check permissions: author or moderator/admin
    const isAuthor = entry.authorAddress === session.walletAddress

    if (!isAuthor) {
      const [walletRow] = await db
        .select({ isModerator: wallets.isModerator, isAdmin: wallets.isAdmin })
        .from(wallets)
        .where(eq(wallets.address, session.walletAddress))
        .limit(1)

      if (!walletRow || (!walletRow.isModerator && !walletRow.isAdmin)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    await db
      .update(entries)
      .set({ status: 'DELETED', updatedAt: new Date() })
      .where(eq(entries.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[entries/[id] DELETE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
