import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notificationPreferences, notificationTypeEnum } from '@/lib/schema'
import { getAuthenticatedSession } from '@/lib/session'
import { NotificationType } from '@onchain/shared'

const ALL_TYPES = notificationTypeEnum.enumValues

export async function getNotificationPreferences(): Promise<Record<string, boolean>> {
  try {
    const session = await getAuthenticatedSession()
    if (!session) return {}
    const rows = await db
      .select({ type: notificationPreferences.type, enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.walletAddress, session.walletAddress))
    const map: Record<string, boolean> = {}
    for (const row of rows) {
      if (ALL_TYPES.includes(row.type as NotificationType)) map[row.type] = row.enabled
    }
    for (const type of ALL_TYPES) {
      if (map[type] === undefined) map[type] = true
    }
    return map
  } catch {
    return {}
  }
}
