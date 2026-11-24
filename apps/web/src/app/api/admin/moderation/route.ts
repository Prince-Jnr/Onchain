import { NextRequest, NextResponse } from 'next/server'
import { and, eq, desc, asc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inArray } from 'drizzle-orm'
import { entries, entryContent, wallets, moderationLogs } from '@/lib/schema'
import { requireAdminSession, parsePositiveInt } from '@/lib/admin'

type EntryRow = typeof entries.$inferSelect
type ContentRow = typeof entryContent.$inferSelect
type WalletRow = typeof wallets.$inferSelect

function serializeEntry(entry: EntryRow, content: ContentRow | null, wallet: WalletRow | null) {
  return {
    id: entry.id,
    chainEntryId: entry.chainEntryId,
    authorAddress: entry.authorAddress,
    entryType: entry.entryType,
    status: entry.status,
    pinned: entry.pinned,
    createdAt: entry.createdAt.toISOString(),
    commentCount: entry.commentCount,
    totalReactions: entry.totalReactions,
    repostCount: entry.repostCount,
    content: content
      ? { text: content.text, hashtags: content.hashtags, mentions: content.mentions }
      : null,
    authorName: wallet?.isModerator ? wallet.address : null,
  }
}

// GET /api/admin/moderation?status=PENDING|HIDDEN|REJECTED&limit=
export async function GET(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') as EntryRow['status'] | null
  const limit = parsePositiveInt(searchParams.get('limit'))

  try {
    const conditions = []
    if (status && ['ACTIVE', 'DELETED', 'HIDDEN', 'PENDING', 'REJECTED'].includes(status)) {
      conditions.push(eq(entries.status, status as EntryRow['status']))
    }
    const entryRows = await db
      .select()
      .from(entries)
      .where(and(...conditions))
      .orderBy(desc(entries.createdAt))
      .limit(limit + 1)

    const hasMore = entryRows.length > limit
    entryRows.pop()

    const contents = await db.select().from(entryContent).where(
      and(...entryRows.length ? [inArray(entryContent.entryId, entryRows.map((e) => e.id))] : [])
    )
    const contentMap = new Map(contents.map((c) => [c.entryId, c]))
    const authors = [...new Set(entryRows.map((e) => e.authorAddress))]
    const authorRows = await db.select().from(wallets).where(and(...authors.length ? [inArray(wallets.address, authors)] : []))
    const walletMap = new Map(authorRows.map((w) => [w.address, w]))

    return NextResponse.json({
      entries: entryRows.map((e) => serializeEntry(e, contentMap.get(e.id) ?? null, walletMap.get(e.authorAddress) ?? null)),
      nextCursor: hasMore ? entryRows[entryRows.length - 1]?.id.toString() : null,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load moderation queue' }, { status: 500 })
  }
}
