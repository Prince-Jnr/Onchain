import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gt, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notifications } from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'

// GET /api/notifications/events — Server-Sent Events stream of new notifications.
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastId = 0
      let closed = false

      const send = (payload: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        } catch {
          closed = true
        }
      }

      const poll = async () => {
        if (closed) return
        try {
          const rows = await db
            .select()
            .from(notifications)
            .where(and(eq(notifications.recipientAddress, session.walletAddress), gt(notifications.id, lastId)))
            .orderBy(asc(notifications.id))
            .limit(50)
          for (const row of rows) {
            lastId = row.id
            send({
              id: row.id,
              type: row.type,
              actorAddress: row.actorAddress,
              targetEntryId: row.targetEntryId,
              createdAt: row.createdAt.toISOString(),
            })
          }
        } catch {
          // Transient DB errors are retried on the next tick.
        }
      }

      await poll()
      const timer = setInterval(poll, 2000)

      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(timer)
        try {
          controller.close()
        } catch {
          // Stream already closed.
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  })
}
