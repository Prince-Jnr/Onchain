import { eq, desc, gt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { wallets, indexedBlocks, indexerCheckpoints, moderationLogs, entries, reports } from '@/lib/schema'
import { and } from 'drizzle-orm'
import { getAuthenticatedSession } from '@/lib/session'
import { isValidAddress } from '@onchain/shared'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function requireAdminSession() {
  const session = await getAuthenticatedSession()
  if (!session?.walletAddress) return null
  const [wallet] = await db
    .select({ isAdmin: wallets.isAdmin })
    .from(wallets)
    .where(eq(wallets.address, session.walletAddress.toLowerCase()))
    .limit(1)
  if (!wallet?.isAdmin) return null
  return session as Awaited<ReturnType<typeof getAuthenticatedSession>> & { walletAddress: string }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parsePositiveInt(value: string | null, fallback = 20): number {
  const parsed = value ? parseInt(value, 10) : NaN
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function isValidWallet(address: string): boolean {
  return isValidAddress(address)
}

// ---------------------------------------------------------------------------
// Indexer status (from indexedBlocks checkpoints)
// ---------------------------------------------------------------------------

const INDEXER_FRESHNESS_MS = 60 * 60 * 1000 // 1 hour

export async function getIndexerStatus() {
  const rows = await db
    .select({ blockNumber: indexedBlocks.blockNumber, updatedAt: indexerCheckpoints.updatedAt })
    .from(indexedBlocks)
    .innerJoin(indexerCheckpoints, and(
      eq(indexerCheckpoints.chainId, indexedBlocks.chainId),
      eq(indexerCheckpoints.contractName, indexedBlocks.contractName),
    ))
    .orderBy(desc(indexedBlocks.blockNumber))
    .limit(1)

  const latest = rows[0]
  if (!latest || !latest.updatedAt) return { indexerStatus: 'down' as const, lastIndexedBlock: 0 }
  const age = Date.now() - latest.updatedAt.getTime()
  return {
    indexerStatus: age < INDEXER_FRESHNESS_MS ? ('healthy' as const) : ('degraded' as const),
    lastIndexedBlock: Number(latest.blockNumber ?? 0),
  }
}

// ---------------------------------------------------------------------------
// AdminStats (api/admin/stats)
// ---------------------------------------------------------------------------

export async function computeAdminStats() {
  const totalUsers = await db.$count(wallets)
  const totalPosts = await db.$count(entries)
  const [totalReactionsRow] = await db
    .select({ value: sql<number>`COALESCE(SUM(${entries.totalReactions}), 0)` })
    .from(entries)
  const totalReactions = Number(totalReactionsRow?.value ?? 0)
  const pendingModeration = await db.$count(entries, eq(entries.status, 'PENDING'))
  const openReports = await db.$count(reports, eq(reports.status, 'PENDING'))
  const activeUsers24h = await db.$count(
    wallets,
    gt(wallets.firstSeenAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
  )
  const indexer = await getIndexerStatus()
  void moderationLogs
  return {
    totalUsers,
    totalPosts,
    totalComments: 0,
    totalReactions,
    totalReposts: 0,
    pendingModeration,
    openReports,
    indexerStatus: indexer.indexerStatus,
    lastIndexedBlock: indexer.lastIndexedBlock,
    activeUsers24h,
  }
}
