import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { entries, bookmarks } from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'

// ---------------------------------------------------------------------------
// POST /api/entries/[id]/bookmark — Toggle bookmark
// ---------------------------------------------------------------------------
export async function POST(
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
    // Verify entry exists and is not deleted
    const [entry] = await db
      .select({ id: entries.id, status: entries.status })
      .from(entries)
      .where(eq(entries.id, id))
      .limit(1)

    if (!entry || entry.status === 'DELETED') {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Check for existing bookmark
    const [existing] = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.entryId, id),
          eq(bookmarks.walletAddress, session.walletAddress),
        ),
      )
      .limit(1)

    if (existing) {
      // Remove bookmark
      await db
        .delete(bookmarks)
        .where(
          and(
            eq(bookmarks.entryId, id),
            eq(bookmarks.walletAddress, session.walletAddress),
          ),
        )
      return NextResponse.json({ bookmarked: false })
    } else {
      // Add bookmark
      await db.insert(bookmarks).values({
        entryId: id,
        walletAddress: session.walletAddress,
      })
      return NextResponse.json({ bookmarked: true })
    }
  } catch (error) {
    console.error('[entries/[id]/bookmark] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
