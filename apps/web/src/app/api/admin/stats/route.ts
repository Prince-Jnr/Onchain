import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { computeAdminStats, requireAdminSession, parsePositiveInt } from '@/lib/admin'

// GET /api/admin/stats — dashboard metrics
export async function GET() {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })

  try {
    const stats = await computeAdminStats()
    return NextResponse.json(stats)
  } catch {
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}

// PATCH /api/admin/stats/refresh — recomputes stats on demand
export async function PATCH() {
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  return NextResponse.json(await computeAdminStats())
}
