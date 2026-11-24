import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appConfig } from '@/lib/schema'
import { requireAdminSession } from '@/lib/admin'

// GET /api/admin/settings — platform settings stored in app_config
export async function GET() {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  try {
    const rows = await db.select().from(appConfig).orderBy(desc(appConfig.updatedAt))
    return NextResponse.json({ settings: rows })
  } catch {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

// PUT /api/admin/settings — { settings: [{ key, value }] }
export async function PUT(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

  let body: { settings?: Array<{ key: string; value: string }> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const entries = Array.isArray(body.settings) ? body.settings : []
  if (entries.length === 0) {
    return NextResponse.json({ error: 'Provide at least one setting' }, { status: 400 })
  }

  try {
    for (const entry of entries) {
      if (typeof entry.key !== 'string' || typeof entry.value !== 'string') continue
      await db
        .insert(appConfig)
        .values({ key: entry.key, value: entry.value, updatedByAddress: session.walletAddress })
        .onConflictDoUpdate({ target: appConfig.key, set: { value: entry.value, updatedByAddress: session.walletAddress } })
    }
    const rows = await db.select().from(appConfig)
    return NextResponse.json({ settings: rows })
  } catch {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
