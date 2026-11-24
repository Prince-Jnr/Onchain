import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { follows } from '@/lib/schema'

export async function getFollowStatus(address: string | null): Promise<{ isFollowing: boolean }> {
  if (!address) return { isFollowing: false }
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerAddress, address), eq(follows.active, true)))
    .limit(1)
  return { isFollowing: !!row }
}
