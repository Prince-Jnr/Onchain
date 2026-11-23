import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function GET() {
  try {
    const session = await getSession()

    if (!session.walletAddress) {
      return NextResponse.json({ authenticated: false })
    }

    // Respect the session's own expiresAt if present
    if (session.expiresAt && Date.now() > session.expiresAt) {
      await session.destroy()
      return NextResponse.json({ authenticated: false })
    }

    return NextResponse.json({
      authenticated: true,
      address: session.walletAddress,
      chainId: session.chainId,
    })
  } catch (error) {
    console.error('[auth/session] Failed to read session:', error)
    return NextResponse.json({ authenticated: false })
  }
}
