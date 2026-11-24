import { NextRequest, NextResponse } from 'next/server'
import { and, eq, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { reports, entryContent, profiles } from '@/lib/schema'
import { requireAdminSession, parsePositiveInt } from '@/lib/admin'

type ReportRow = typeof reports.$inferSelect

function serializeReport(
  row: ReportRow,
  targetEntryPreview: string | null,
  reporterName: string | null,
) {
  return {
    id: row.id,
    category: row.category,
    status: row.status,
    reporterAddress: row.reporterAddress,
    reporterName,
    targetEntryId: row.targetEntryId,
    targetWalletAddress: row.targetWalletAddress,
    targetEntryPreview,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedByAddress: row.resolvedByAddress,
  }
}

async function serializeReports(rows: ReportRow[]) {
  const reporterAddresses = [...new Set(rows.map((r) => r.reporterAddress))]
  const reporterRows = await db
    .select({ address: profiles.walletAddress, displayName: profiles.displayName })
    .from(profiles)
    .where(and(...(reporterAddresses.length ? [inArray(profiles.walletAddress, reporterAddresses)] : [])))
  const reporters = new Map(reporterRows.map((w) => [w.address.toLowerCase(), w.displayName]))

  const targetEntryIds = [...new Set(rows.filter((r) => r.targetEntryId).map((r) => r.targetEntryId as number))]
  const targetRows = await db
    .select({ id: entryContent.entryId, text: entryContent.text })
    .from(entryContent)
    .where(and(...(targetEntryIds.length ? [inArray(entryContent.entryId, targetEntryIds)] : [])))
  const previews = new Map(targetRows.map((e) => [e.id, e.text]))

  return rows.map((r) => serializeReport(r, previews.get(r.targetEntryId as number) ?? null, reporters.get(r.reporterAddress.toLowerCase()) ?? null))
}

// GET /api/admin/reports?status=PENDING|REVIEWING|RESOLVED|DISMISSED&limit=
export async function GET(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const statusFilter = searchParams.get('status') as ReportRow['status'] | null
  const limit = parsePositiveInt(searchParams.get('limit'))

  try {
    const conditions = []
    if (statusFilter && ['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'].includes(statusFilter)) {
      conditions.push(eq(reports.status, statusFilter))
    }
    const rows = await db
      .select()
      .from(reports)
      .where(and(...conditions))
      .orderBy(desc(reports.createdAt))
      .limit(limit + 1)
    const hasMore = rows.length > limit
    rows.pop()

    return NextResponse.json({
      reports: await serializeReports(rows),
      nextCursor: hasMore ? rows[rows.length - 1]?.id : null,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
  }
}
