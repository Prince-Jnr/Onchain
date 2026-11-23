import { getIronSession, type IronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/types/session'

function getSessionOptions() {
  const password = process.env.SESSION_SECRET
  if (!password || password.length < 32) {
    throw new Error('SESSION_SECRET must be configured with at least 32 characters')
  }

  return {
  password,
  cookieName: 'onchain-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  }
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, getSessionOptions())
}

export async function getAuthenticatedSession(): Promise<(IronSession<SessionData> & { walletAddress: string }) | null> {
  const session = await getSession()
  if (!session.walletAddress) {
    return null
  }
  return session as IronSession<SessionData> & { walletAddress: string }
}
