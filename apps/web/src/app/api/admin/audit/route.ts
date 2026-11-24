import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, inArray, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { moderationLogs, profiles } from '@/lib/schema'
import { requireAdminSession, parsePositiveInt, isValidWallet } from '@/lib/admin'

type AuditRow = typeof moderationLogs.$inferSelect

function serializeAudit(row: AuditRow & { actorName?: string | null }) {
  return {
    id: row.id,
    actorAddress: row.actorAddress,
    actorName: row.actorName ?? null,
    action: row.action,
    targetEntryId: row.targetEntryId,
    targetWalletAddress: row.targetWalletAddress,
    reason: row.reason,
    txHash: row.txHash,
    chainAuditId: row.chainAuditId,
    createdAt: row.createdAt.toISOString(),
  }
}

// GET /api/admin/audit?limit=&actor=
export async function GET(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const limit = parsePositiveInt(searchParams.get('limit'))
  const actor = searchParams.get('actor')

  try {
    const conditions = []
    if (actor && isValidWallet(actor)) {
      conditions.push(eq(moderationLogs.actorAddress, actor.toLowerCase()))
    }
    const rows = await db
      .select()
      .from(moderationLogs)
      .where(and(...conditions))
      .orderBy(desc(moderationLogs.createdAt))
      .limit(limit)

    const actorAddresses = [...new Set(rows.map((r) => r.actorAddress))]
    const actorRows = await db
      .select({ address: profiles.walletAddress, displayName: profiles.displayName })
      .from(profiles)
      .where(and(...(actorAddresses.length ? [inArray(profiles.walletAddress, actorAddresses)] : [])))
    const actorNames = new Map(actorRows.map((w) => [w.address.toLowerCase(), w.displayName]))

    return NextResponse.json({
      audit: rows.map((r) =>
        serializeAudit({ ...r, actorName: actorNames.get(r.actorAddress.toLowerCase()) ?? null })
      ),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 })
  }
}
