import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { reports, moderationLogs } from '@/lib/schema'
import { requireAdminSession } from '@/lib/admin'

// POST /api/admin/reports/[id] — { action: 'resolve'|'dismiss', notes? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

  const { id: idParam } = await params
  const reportId = parseInt(idParam, 10)
  if (!Number.isSafeInteger(reportId) || reportId <= 0) {
    return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 })
  }

  let body: { action?: unknown; notes?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action as 'resolve' | 'dismiss' | null
  if (action !== 'resolve' && action !== 'dismiss') {
    return NextResponse.json({ error: 'Action must be "resolve" or "dismiss"' }, { status: 400 })
  }

  try {
    const [row] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1)
    if (!row) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const update = {
      status: action === 'resolve' ? 'RESOLVED' : 'DISMISSED',
      resolvedAt: new Date(),
      resolvedByAddress: session.walletAddress,
      notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : row.notes,
    } as const

    const [updated] = await db.update(reports).set(update).where(eq(reports.id, reportId)).returning()

    return NextResponse.json({ report: updated })
  } catch {
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
  }
}
