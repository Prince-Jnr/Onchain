import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { hashtags } from '@/lib/schema'

// GET /api/hashtags?sort=trending|recent&limit=N
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const { searchParams } = request.nextUrl
  const sort = (searchParams.get('sort') === 'recent' ? 'recent' : 'trending') as 'recent' | 'trending'
  const rawLimit = parseInt(searchParams.get('limit') ?? '12', 10)
  const limit = Math.min(Math.max(rawLimit, 1), 50)

  try {
    // Tag-specific counts use the cached hashtag row when available
    const tag = searchParams.get('tag')
    if (tag) {
      const rows = await db
        .select({ tag: hashtags.tag, postCount: hashtags.postCount })
        .from(hashtags)
        .where(eq(hashtags.tag, tag.toLowerCase().replace(/^#/, '')))
        .limit(1)
      const count = rows[0]?.postCount ?? 0
      return NextResponse.json([{ tag, count }])
    }

    const rows = await db
      .select({ tag: hashtags.tag, postCount: hashtags.postCount })
      .from(hashtags)
      .orderBy(sort === 'trending' ? sql`${hashtags.postCount} DESC, ${hashtags.lastUsedAt} DESC` : sql`${hashtags.lastUsedAt} DESC`)
      .limit(limit)
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Failed to load hashtags' }, { status: 500 })
  }
}
