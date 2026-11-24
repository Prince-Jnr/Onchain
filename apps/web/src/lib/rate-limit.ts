import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { apiRateLimits } from '@/lib/schema'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

export async function checkRateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
): Promise<RateLimitResult> {
  if (!process.env.DATABASE_URL) {
    // Fail open when the database is unavailable; per-route guards still apply.
    return { allowed: true, remaining: max, retryAfterMs: 0 }
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - windowMs)

  try {
    // Atomically reset the window and increment the counter in one statement.
    const [updated] = await db
      .update(apiRateLimits)
      .set({
        windowStart: sql`CASE WHEN ${apiRateLimits.windowStart} <= ${windowStart} THEN ${now} ELSE ${apiRateLimits.windowStart} END`,
        count: sql`CASE WHEN ${apiRateLimits.windowStart} <= ${windowStart} THEN 1 ELSE ${apiRateLimits.count} + 1 END`,
      })
      .where(eq(apiRateLimits.key, key))
      .returning({ count: apiRateLimits.count, windowStart: apiRateLimits.windowStart })

    if (!updated) {
      await db
        .insert(apiRateLimits)
        .values({ key, count: 1, windowStart: now })
        .onConflictDoNothing()
      return { allowed: 1 <= max, remaining: Math.max(max - 1, 0), retryAfterMs: 0 }
    }

    const count = updated.count
    if (count > max) {
      return { allowed: false, remaining: 0, retryAfterMs: windowMs }
    }
    return { allowed: true, remaining: Math.max(max - count, 0), retryAfterMs: 0 }
  } catch {
    // Fail open on DB errors; rate limiting is an abuse control, not a blocker.
    return { allowed: true, remaining: max, retryAfterMs: 0 }
  }
}

export function rateLimitKeyFromRequest(request: Request, prefix: string): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  return `${prefix}:${ip}`
}
