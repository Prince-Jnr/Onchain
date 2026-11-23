import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function POST() {
  try {
    const session = await getSession()
    await session.destroy()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[auth/logout] Failed to destroy session:', error)
    return NextResponse.json({ error: 'Failed to log out' }, { status: 500 })
  }
}
