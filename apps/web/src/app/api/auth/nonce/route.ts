import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { siweNonces } from '@/lib/schema'
import { checkRateLimit as pgCheckRateLimit } from '@/lib/rate-limit'

// Rate limiting (distributed, PostgreSQL-backed)
async function checkRateLimit(ip: string): Promise<boolean> {
  const result = await pgCheckRateLimit(`nonce:${ip}`, { max: 20, windowMs: 60_000 })
  return result.allowed
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: 'Service temporarily unavailable' },
      { status: 503 }
    )
  }

  // Rate limiting
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'

  if (!(await checkRateLimit(ip))) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in a minute.' },
      { status: 429 }
    )
  }

  try {
    const nonce = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    await db.insert(siweNonces).values({
      nonce,
      expiresAt,
    })

    return NextResponse.json({ nonce })
  } catch (error) {
    console.error('[auth/nonce] Failed to generate nonce:', error)
    return NextResponse.json(
      { error: 'Failed to generate nonce' },
      { status: 500 }
    )
  }
}
