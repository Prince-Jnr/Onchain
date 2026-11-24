import { NextRequest, NextResponse } from 'next/server'
import { computeAdminStats, getIndexerStatus } from '@/lib/admin'

// GET /api/admin/analytics — key metrics for the dashboard
export async function GET(_request: NextRequest) {
  try {
    const stats = await computeAdminStats()
    const indexer = await getIndexerStatus()
    return NextResponse.json({
      ...stats,
      indexer: indexer.indexerStatus,
      lastIndexedBlock: indexer.lastIndexedBlock,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
  }
}
