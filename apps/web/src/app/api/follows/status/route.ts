import { NextRequest, NextResponse } from 'next/server'
import { getFollowStatus } from '../../../lib/follow-status'

// GET /api/follows/status?address=X
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')
  return NextResponse.json(await getFollowStatus(address))
}
