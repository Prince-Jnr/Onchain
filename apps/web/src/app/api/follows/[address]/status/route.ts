import { NextRequest, NextResponse } from 'next/server'
import { getFollowStatus } from '../../../../lib/follow-status'

// GET /api/follows/[address]/status
export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params
  return NextResponse.json(await getFollowStatus(address.toLowerCase()))
}
