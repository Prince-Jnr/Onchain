import { NextRequest, NextResponse } from 'next/server'
import { SiweMessage } from 'siwe'
import { eq, and, gt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { siweNonces, wallets } from '@/lib/schema'
import { getSession } from '@/lib/session'

const SUPPORTED_CHAIN_IDS = new Set([
  31337, // Anvil (local dev)
  84532, // Base Sepolia
  8453,  // Base
])

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: 'Service temporarily unavailable' },
      { status: 503 }
    )
  }

  let body: { message?: unknown; signature?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { message, signature } = body

  if (typeof message !== 'string' || !message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }
  if (typeof signature !== 'string' || !signature) {
    return NextResponse.json({ error: 'signature is required' }, { status: 400 })
  }

  // Parse and verify the SIWE message
  let siweMessage: SiweMessage
  try {
    siweMessage = new SiweMessage(message)
  } catch {
    return NextResponse.json({ error: 'Invalid SIWE message format' }, { status: 400 })
  }

  // Domain validation
  const host = request.headers.get('host') ?? ''
  const expectedDomain = host.split(':')[0] // strip port
  if (siweMessage.domain !== host && siweMessage.domain !== expectedDomain) {
    return NextResponse.json(
      { error: `Domain mismatch: expected ${host}, got ${siweMessage.domain}` },
      { status: 422 }
    )
  }

  // Chain ID validation
  if (!SUPPORTED_CHAIN_IDS.has(siweMessage.chainId)) {
    return NextResponse.json(
      { error: `Unsupported chain ID: ${siweMessage.chainId}` },
      { status: 422 }
    )
  }

  // Cryptographic signature verification
  try {
    const result = await siweMessage.verify({ signature })
    if (!result.success) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 })
    }
  } catch (err) {
    console.error('[auth/verify] Signature verification error:', err)
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 })
  }

  const address = siweMessage.address.toLowerCase()
  const { nonce, chainId } = siweMessage
  const now = new Date()

  // Validate nonce: must exist, not be used, and not be expired
  let nonceRecord: typeof siweNonces.$inferSelect | undefined
  try {
    const rows = await db
      .select()
      .from(siweNonces)
      .where(
        and(
          eq(siweNonces.nonce, nonce),
          eq(siweNonces.used, false),
          gt(siweNonces.expiresAt, now)
        )
      )
      .limit(1)

    nonceRecord = rows[0]
  } catch (err) {
    console.error('[auth/verify] Nonce lookup failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!nonceRecord) {
    return NextResponse.json(
      { error: 'Invalid, expired, or already-used nonce' },
      { status: 422 }
    )
  }

  // Mark nonce as used (single-use guarantee)
  try {
    await db
      .update(siweNonces)
      .set({ used: true, walletAddress: address })
      .where(eq(siweNonces.id, nonceRecord.id))
  } catch (err) {
    console.error('[auth/verify] Failed to mark nonce used:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Upsert the wallet record
  try {
    await db
      .insert(wallets)
      .values({
        address,
        chainId,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: wallets.address,
        set: { lastSeenAt: now, chainId },
      })
  } catch (err) {
    console.error('[auth/verify] Failed to upsert wallet:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Create the iron-session
  const sessionExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days (matches cookie maxAge)
  try {
    const session = await getSession()
    session.walletAddress = address
    session.chainId = chainId
    session.createdAt = Date.now()
    session.expiresAt = sessionExpiresAt
    await session.save()
  } catch (err) {
    console.error('[auth/verify] Failed to save session:', err)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    address,
    chainId,
  })
}
