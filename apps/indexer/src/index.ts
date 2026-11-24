import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { and, count, desc, eq, gt, lt, lte, sql } from 'drizzle-orm'
import { decodeEventLog, defineChain, http, createPublicClient, type Address, type Log } from 'viem'
import { CHAIN_IDS, ONCHAIN_ENTRIES_ABI, ONCHAIN_SOCIAL_ABI, ONCHAIN_PROFILES_ABI, ONCHAIN_MODERATION_ABI, createEntryContentDocument, getEntryContentReference } from '@onchain/shared'
import * as schema from './schema.js'
import { activeAfterEvent, reactionAfterEvent } from './projection-state.js'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')

const chainId = Number(process.env.INDEXER_CHAIN_ID ?? CHAIN_IDS.BASE_SEPOLIA)
const rpcUrl = chainId === CHAIN_IDS.BASE
  ? process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'
  : process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org'
const addressFor = (name: 'ENTRIES' | 'SOCIAL' | 'PROFILES' | 'MODERATION') =>
  process.env[chainId === CHAIN_IDS.BASE ? `NEXT_PUBLIC_${name}_ADDRESS` : `NEXT_PUBLIC_${name}_ADDRESS_SEPOLIA`]
const contracts = [
  { name: 'entries', address: addressFor('ENTRIES') },
  { name: 'social', address: addressFor('SOCIAL') },
  { name: 'profiles', address: addressFor('PROFILES') },
  { name: 'moderation', address: addressFor('MODERATION') },
].filter((contract): contract is { name: string; address: string } =>
  typeof contract.address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(contract.address) && contract.address !== '0x0000000000000000000000000000000000000000',
)

if (chainId !== CHAIN_IDS.BASE && chainId !== CHAIN_IDS.BASE_SEPOLIA) {
  throw new Error(`Unsupported indexer chain ${chainId}`)
}
if (contracts.length === 0) throw new Error('At least one deployed contract address must be configured')

const chain = defineChain({
  id: chainId,
  name: chainId === CHAIN_IDS.BASE ? 'Base' : 'Base Sepolia',
  nativeCurrency: { name: chainId === CHAIN_IDS.BASE ? 'Ether' : 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
})
const client = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 15_000, retryCount: 3 }) })
neonConfig.webSocketConstructor = WebSocket
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 30_000 })
const db = drizzle(pool, { schema })
const startBlock = Number(process.env.INDEXER_START_BLOCK ?? '0')
const confirmations = Number(process.env.INDEXER_CONFIRMATIONS ?? '12')
const blockChunk = Number(process.env.INDEXER_BLOCK_CHUNK ?? '500')
const pollMs = Number(process.env.INDEXER_POLL_MS ?? '5000')
const REORG_MARKER_LIMIT = 128

if (![startBlock, confirmations, blockChunk, pollMs].every(Number.isSafeInteger) || startBlock < 0 || confirmations < 1 || blockChunk < 1 || pollMs < 1000) {
  throw new Error('Invalid indexer numeric configuration')
}

function decodeEntryLog(log: Log) {
  try {
    return decodeEventLog({
      abi: ONCHAIN_ENTRIES_ABI,
      data: log.data,
      topics: log.topics,
      strict: false,
    })
  } catch {
    return null
  }
}

function asDbEntryType(value: number): 'POST' | 'COMMENT' | 'QUOTE' | null {
  return (['POST', 'COMMENT', 'QUOTE'] as const)[value] ?? null
}

function asDbStatus(value: number): 'ACTIVE' | 'DELETED' | 'HIDDEN' | 'PENDING' | 'REJECTED' | null {
  return (['ACTIVE', 'DELETED', 'HIDDEN', 'PENDING', 'REJECTED'] as const)[value] ?? null
}

async function updateEntryProjection(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], log: Log, reversed = false) {
  const decoded = decodeEntryLog(log)
  if (!decoded) return
  if (decoded.eventName === 'UserRestrictionChanged' && 'user' in decoded.args && 'restriction' in decoded.args &&
      typeof decoded.args.user === 'string' && typeof decoded.args.restriction === 'number') {
    const restrictions = ['NONE', 'RESTRICTED', 'BANNED'] as const
    const restriction = restrictions[decoded.args.restriction]
    if (!restriction) throw new Error(`Invalid wallet restriction in ${log.transactionHash}`)
    const address = decoded.args.user.toLowerCase()
    await tx.insert(schema.wallets).values({ address, chainId }).onConflictDoNothing()
    await tx.update(schema.wallets).set({ restriction: reversed ? 'NONE' : restriction }).where(eq(schema.wallets.address, address))
    return
  }
  if (!('entryId' in decoded.args)) return
  const eventName = decoded.eventName
  const entryId = Number(decoded.args.entryId)
  if (!Number.isSafeInteger(entryId) || entryId <= 0) throw new Error(`Unsafe entry ID in ${log.transactionHash}`)

  if (eventName === 'EntryCreated') {
    if (reversed) {
      if ('author' in decoded.args && typeof decoded.args.author === 'string' &&
          'contentRef' in decoded.args && typeof decoded.args.contentRef === 'string') {
        await tx.update(schema.pendingEntries).set({ consumedAt: null }).where(and(
          eq(schema.pendingEntries.authorAddress, decoded.args.author.toLowerCase()),
          eq(schema.pendingEntries.contentRef, decoded.args.contentRef),
          eq(schema.pendingEntries.chainId, chainId),
        ))
      }
      const [orphan] = await tx.select({ id: schema.entries.id, entryType: schema.entries.entryType, parentId: schema.entries.parentId })
        .from(schema.entries).where(eq(schema.entries.chainEntryId, entryId)).limit(1)
      await tx.delete(schema.entries).where(eq(schema.entries.chainEntryId, entryId))
      if (orphan?.entryType === 'COMMENT' && orphan.parentId !== null) {
        await tx.update(schema.entries).set({
          commentCount: sql`GREATEST(${schema.entries.commentCount} - 1, 0)`,
        }).where(eq(schema.entries.id, orphan.parentId))
      }
      return
    }
    if (!('author' in decoded.args) || typeof decoded.args.author !== 'string' ||
        !('entryType' in decoded.args) || typeof decoded.args.entryType !== 'number' ||
        !('contentRef' in decoded.args) || typeof decoded.args.contentRef !== 'string' ||
        !('status' in decoded.args) || typeof decoded.args.status !== 'number' ||
        !('timestamp' in decoded.args) || typeof decoded.args.timestamp !== 'bigint') return
    const entryType = asDbEntryType(Number(decoded.args.entryType))
    const status = asDbStatus(Number(decoded.args.status))
    if (!entryType || !status || !log.blockNumber || !log.blockHash || !log.transactionHash || log.logIndex === null) return
    const author = decoded.args.author.toLowerCase()
    await tx.insert(schema.wallets).values({ address: author, chainId }).onConflictDoNothing()
    const parentChainId = Number('parentId' in decoded.args ? decoded.args.parentId : 0n)
    const referenceChainId = Number('referenceId' in decoded.args ? decoded.args.referenceId : 0n)
    const [parent] = parentChainId
      ? await tx.select({ id: schema.entries.id }).from(schema.entries).where(eq(schema.entries.chainEntryId, parentChainId)).limit(1)
      : []
    const [reference] = referenceChainId
      ? await tx.select({ id: schema.entries.id }).from(schema.entries).where(eq(schema.entries.chainEntryId, referenceChainId)).limit(1)
      : []
    await tx.insert(schema.entries).values({
      chainEntryId: entryId,
      txHash: log.transactionHash,
      blockNumber: Number(log.blockNumber),
      logIndex: log.logIndex,
      authorAddress: author,
      entryType,
      parentId: parent?.id ?? null,
      referenceId: reference?.id ?? null,
      contentRef: decoded.args.contentRef,
      chainCreatedAt: new Date(Number(decoded.args.timestamp) * 1000),
      status,
      createdAt: new Date(Number(decoded.args.timestamp) * 1000),
    }).onConflictDoUpdate({
      target: schema.entries.chainEntryId,
      set: {
        txHash: log.transactionHash,
        blockNumber: Number(log.blockNumber),
        logIndex: log.logIndex,
        authorAddress: author,
        entryType,
        parentId: parent?.id ?? null,
        referenceId: reference?.id ?? null,
        contentRef: decoded.args.contentRef,
        chainCreatedAt: new Date(Number(decoded.args.timestamp) * 1000),
        createdAt: new Date(Number(decoded.args.timestamp) * 1000),
        status,
        updatedAt: new Date(),
      },
    })
    const [storedEntry] = await tx.select({ id: schema.entries.id }).from(schema.entries)
      .where(eq(schema.entries.chainEntryId, entryId)).limit(1)
    if (!storedEntry) throw new Error(`Entry projection ${entryId} was not persisted`)
    if (entryType === 'COMMENT' && parent?.id) {
      await tx.update(schema.entries).set({
        commentCount: sql`${schema.entries.commentCount} + 1`,
      }).where(eq(schema.entries.id, parent.id))
    }
    const [pending] = await tx.select().from(schema.pendingEntries).where(and(
      eq(schema.pendingEntries.authorAddress, author),
      eq(schema.pendingEntries.chainId, chainId),
      eq(schema.pendingEntries.contentRef, decoded.args.contentRef),
    )).limit(1)
    if (pending) {
      const document = createEntryContentDocument(pending.text, pending.mediaUrls)
      if (getEntryContentReference(document) !== decoded.args.contentRef) {
        throw new Error(`Pending content integrity check failed for entry ${entryId}`)
      }
      await tx.insert(schema.entryContent).values({
        entryId: storedEntry.id,
        text: document.text,
        hashtags: document.hashtags,
        mentions: document.mentions,
      }).onConflictDoUpdate({
        target: schema.entryContent.entryId,
        set: { text: document.text, hashtags: document.hashtags, mentions: document.mentions },
      })
      for (const rawItem of pending.mediaMetadata as unknown[]) {
        if (!rawItem || typeof rawItem !== 'object') continue
        const item = rawItem as { url?: unknown; ipfsCid?: unknown; mimeType?: unknown; sizeBytes?: unknown }
        if (typeof item.url !== 'string' || typeof item.ipfsCid !== 'string' || typeof item.mimeType !== 'string' || typeof item.sizeBytes !== 'number') continue
        await tx.insert(schema.media).values({
          entryId: storedEntry.id,
          url: item.url,
          ipfsCid: item.ipfsCid,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
        }).onConflictDoNothing()
      }
      await tx.update(schema.pendingEntries).set({ consumedAt: new Date() })
        .where(eq(schema.pendingEntries.id, pending.id))
    }
    return
  }

  if (eventName === 'EntryStatusChanged' && 'oldStatus' in decoded.args && 'newStatus' in decoded.args) {
    const status = asDbStatus(Number(reversed ? decoded.args.oldStatus : decoded.args.newStatus))
    if (status) await tx.update(schema.entries).set({ status, updatedAt: new Date() }).where(eq(schema.entries.chainEntryId, entryId))
  }
  if (eventName === 'EntryPinned' && 'pinned' in decoded.args) {
    const pinned = reversed ? !decoded.args.pinned : decoded.args.pinned
    await tx.update(schema.entries).set({ pinned, updatedAt: new Date() }).where(eq(schema.entries.chainEntryId, entryId))
  }
}

function decodeSocialLog(log: Log) {
  try {
    return decodeEventLog({ abi: ONCHAIN_SOCIAL_ABI, data: log.data, topics: log.topics, strict: false })
  } catch {
    return null
  }
}

function decodeProfileLog(log: Log) {
  try {
    return decodeEventLog({ abi: ONCHAIN_PROFILES_ABI, data: log.data, topics: log.topics, strict: false })
  } catch {
    return null
  }
}

function decodeModerationLog(log: Log) {
  try {
    return decodeEventLog({ abi: ONCHAIN_MODERATION_ABI, data: log.data, topics: log.topics, strict: false })
  } catch {
    return null
  }
}

const reportCategories = ['SPAM', 'HARASSMENT', 'HATE_SPEECH', 'MISINFORMATION', 'ILLEGAL_CONTENT', 'VIOLENT_CONTENT', 'ADULT_CONTENT', 'OTHER'] as const
const reportStatuses = ['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const
const moderationActions = ['APPROVE', 'REJECT', 'HIDE', 'RESTORE', 'PIN', 'UNPIN', 'DELETE'] as const

async function updateModerationProjection(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], log: Log, reversed = false) {
  const decoded = decodeModerationLog(log)
  if (!decoded || !log.transactionHash) return
  const timestamp = 'timestamp' in decoded.args && typeof decoded.args.timestamp === 'bigint'
    ? new Date(Number(decoded.args.timestamp) * 1000)
    : new Date()

  if (decoded.eventName === 'ReportSubmitted' && 'reportId' in decoded.args && 'reporter' in decoded.args &&
      'targetEntryId' in decoded.args && 'targetWallet' in decoded.args && 'category' in decoded.args &&
      typeof decoded.args.reportId === 'bigint' && typeof decoded.args.reporter === 'string' &&
      typeof decoded.args.targetEntryId === 'bigint' && typeof decoded.args.targetWallet === 'string' &&
      typeof decoded.args.category === 'number') {
    const reportId = Number(decoded.args.reportId)
    const targetChainEntryId = Number(decoded.args.targetEntryId)
    const category = reportCategories[decoded.args.category]
    if (!Number.isSafeInteger(reportId) || reportId <= 0 || !Number.isSafeInteger(targetChainEntryId) || !category) {
      throw new Error(`Invalid report event data in ${log.transactionHash}`)
    }
    if (reversed) {
      await tx.delete(schema.reports).where(eq(schema.reports.chainReportId, reportId))
      return
    }
    const reporter = decoded.args.reporter.toLowerCase()
    const targetWallet = decoded.args.targetWallet.toLowerCase()
    await tx.insert(schema.wallets).values({ address: reporter, chainId }).onConflictDoNothing()
    if (targetWallet !== '0x0000000000000000000000000000000000000000') {
      await tx.insert(schema.wallets).values({ address: targetWallet, chainId }).onConflictDoNothing()
    }
    const [target] = targetChainEntryId
      ? await tx.select({ id: schema.entries.id }).from(schema.entries).where(eq(schema.entries.chainEntryId, targetChainEntryId)).limit(1)
      : []
    await tx.insert(schema.reports).values({
      chainReportId: reportId,
      reporterAddress: reporter,
      targetEntryId: target?.id ?? null,
      targetChainEntryId: targetChainEntryId || null,
      targetWalletAddress: targetWallet === '0x0000000000000000000000000000000000000000' ? null : targetWallet,
      category,
      status: 'PENDING',
      txHash: log.transactionHash,
      createdAt: timestamp,
    }).onConflictDoUpdate({
      target: schema.reports.chainReportId,
      set: { reporterAddress: reporter, targetEntryId: target?.id ?? null, targetChainEntryId: targetChainEntryId || null,
        targetWalletAddress: targetWallet === '0x0000000000000000000000000000000000000000' ? null : targetWallet,
        category, status: 'PENDING', txHash: log.transactionHash, createdAt: timestamp },
    })
    return
  }

  if (decoded.eventName === 'ReportStatusChanged' && 'reportId' in decoded.args && 'oldStatus' in decoded.args &&
      'newStatus' in decoded.args && 'changedBy' in decoded.args && typeof decoded.args.reportId === 'bigint' &&
      typeof decoded.args.oldStatus === 'number' && typeof decoded.args.newStatus === 'number' && typeof decoded.args.changedBy === 'string') {
    const reportId = Number(decoded.args.reportId)
    const status = reportStatuses[reversed ? decoded.args.oldStatus : decoded.args.newStatus]
    if (!status) throw new Error(`Invalid report status in ${log.transactionHash}`)
    const by = decoded.args.changedBy.toLowerCase()
    await tx.insert(schema.wallets).values({ address: by, chainId }).onConflictDoNothing()
    await tx.update(schema.reports).set({
      status,
      resolvedAt: status === 'RESOLVED' || status === 'DISMISSED' ? timestamp : null,
      resolvedByAddress: status === 'RESOLVED' || status === 'DISMISSED' ? by : null,
    }).where(eq(schema.reports.chainReportId, reportId))
    return
  }

  if (decoded.eventName === 'ModerationAuditRecorded' && 'auditId' in decoded.args && 'actor' in decoded.args &&
      'action' in decoded.args && 'targetEntryId' in decoded.args && 'targetWallet' in decoded.args &&
      typeof decoded.args.auditId === 'bigint' && typeof decoded.args.actor === 'string' &&
      typeof decoded.args.action === 'number' && typeof decoded.args.targetEntryId === 'bigint' &&
      typeof decoded.args.targetWallet === 'string') {
    const auditId = Number(decoded.args.auditId)
    const targetChainEntryId = Number(decoded.args.targetEntryId)
    const action = moderationActions[decoded.args.action]
    if (!Number.isSafeInteger(auditId) || !action) throw new Error(`Invalid moderation audit in ${log.transactionHash}`)
    if (reversed) {
      await tx.delete(schema.moderationLogs).where(eq(schema.moderationLogs.chainAuditId, auditId))
      return
    }
    const actor = decoded.args.actor.toLowerCase()
    const targetWallet = decoded.args.targetWallet.toLowerCase()
    await tx.insert(schema.wallets).values({ address: actor, chainId }).onConflictDoNothing()
    const [target] = targetChainEntryId
      ? await tx.select({ id: schema.entries.id }).from(schema.entries).where(eq(schema.entries.chainEntryId, targetChainEntryId)).limit(1)
      : []
    await tx.insert(schema.moderationLogs).values({
      actorAddress: actor,
      action,
      targetEntryId: target?.id ?? null,
      targetWalletAddress: targetWallet === '0x0000000000000000000000000000000000000000' ? null : targetWallet,
      txHash: log.transactionHash,
      chainAuditId: auditId,
      createdAt: timestamp,
    }).onConflictDoUpdate({
      target: schema.moderationLogs.chainAuditId,
      set: { actorAddress: actor, action, targetEntryId: target?.id ?? null,
        targetWalletAddress: targetWallet === '0x0000000000000000000000000000000000000000' ? null : targetWallet,
        txHash: log.transactionHash, createdAt: timestamp },
    })
    return
  }

  const roleEvents = {
    ModeratorAdded: { field: 'isModerator', added: true },
    ModeratorRemoved: { field: 'isModerator', added: false },
    TrustedUserAdded: { field: 'isTrusted', added: true },
    TrustedUserRemoved: { field: 'isTrusted', added: false },
  } as const
  const roleEvent = roleEvents[decoded.eventName as keyof typeof roleEvents]
  if (roleEvent) {
    const address = 'moderator' in decoded.args ? decoded.args.moderator : 'user' in decoded.args ? decoded.args.user : null
    if (typeof address !== 'string') return
    const normalized = address.toLowerCase()
    await tx.insert(schema.wallets).values({ address: normalized, chainId }).onConflictDoNothing()
    await tx.update(schema.wallets).set({ [roleEvent.field]: reversed ? !roleEvent.added : roleEvent.added })
      .where(eq(schema.wallets.address, normalized))
  }
}

async function updateProfileProjection(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], log: Log, reversed = false) {
  const decoded = decodeProfileLog(log)
  if (!decoded || !('wallet' in decoded.args) || typeof decoded.args.wallet !== 'string') return
  const wallet = decoded.args.wallet.toLowerCase()
  const timestamp = 'timestamp' in decoded.args && typeof decoded.args.timestamp === 'bigint'
    ? new Date(Number(decoded.args.timestamp) * 1000)
    : new Date()
  await tx.insert(schema.wallets).values({ address: wallet, chainId }).onConflictDoNothing()

  if (decoded.eventName === 'ProfileRegistered' && 'metadataRef' in decoded.args && typeof decoded.args.metadataRef === 'string') {
    if (reversed) {
      await tx.update(schema.profiles).set({ metadataRef: null, registeredAt: null, isActive: true, updatedAt: timestamp })
        .where(eq(schema.profiles.walletAddress, wallet))
      return
    }
    const [followCounts] = await tx.select({
      followers: sql<number>`count(*) filter (where ${schema.follows.followedAddress} = ${wallet} and ${schema.follows.active} = true)`,
      following: sql<number>`count(*) filter (where ${schema.follows.followerAddress} = ${wallet} and ${schema.follows.active} = true)`,
    }).from(schema.follows)
    await tx.insert(schema.profiles).values({
      walletAddress: wallet,
      metadataRef: decoded.args.metadataRef,
      registeredAt: timestamp,
      updatedAt: timestamp,
      isActive: true,
      followerCount: Number(followCounts?.followers ?? 0),
      followingCount: Number(followCounts?.following ?? 0),
    }).onConflictDoUpdate({
      target: schema.profiles.walletAddress,
      set: { metadataRef: decoded.args.metadataRef, updatedAt: timestamp, isActive: true },
    })
    return
  }

  if (decoded.eventName === 'ProfileUpdated' && 'oldMetadataRef' in decoded.args && 'newMetadataRef' in decoded.args &&
      typeof decoded.args.oldMetadataRef === 'string' && typeof decoded.args.newMetadataRef === 'string') {
    await tx.update(schema.profiles).set({
      metadataRef: reversed ? decoded.args.oldMetadataRef : decoded.args.newMetadataRef,
      updatedAt: timestamp,
    }).where(eq(schema.profiles.walletAddress, wallet))
    return
  }

  if (decoded.eventName === 'ProfileDeactivated' || decoded.eventName === 'ProfileRestored') {
    const isActive = decoded.eventName === 'ProfileRestored' ? !reversed : reversed
    await tx.update(schema.profiles).set({ isActive, updatedAt: timestamp })
      .where(eq(schema.profiles.walletAddress, wallet))
  }
}

const reactionNames = ['LIKE', 'LOVE', 'LAUGH', 'WOW', 'SAD', 'ANGRY'] as const

async function updateSocialProjection(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], log: Log, reversed = false) {
  const decoded = decodeSocialLog(log)
  if (!decoded || !log.transactionHash) return
  const timestamp = 'timestamp' in decoded.args && typeof decoded.args.timestamp === 'bigint'
    ? new Date(Number(decoded.args.timestamp) * 1000)
    : new Date()

  if ('entryId' in decoded.args && 'user' in decoded.args && typeof decoded.args.user === 'string') {
    const chainEntryId = Number(decoded.args.entryId)
    if (!Number.isSafeInteger(chainEntryId) || chainEntryId <= 0) throw new Error(`Unsafe social entry ID in ${log.transactionHash}`)
    const user = decoded.args.user.toLowerCase()
    const [entry] = await tx.select({ id: schema.entries.id }).from(schema.entries)
      .where(eq(schema.entries.chainEntryId, chainEntryId)).limit(1)
    if (!entry) throw new Error(`Social event references unindexed entry ${chainEntryId}`)
    await tx.insert(schema.wallets).values({ address: user, chainId }).onConflictDoNothing()

    if (decoded.eventName === 'ReactionAdded' || decoded.eventName === 'ReactionRemoved' || decoded.eventName === 'ReactionChanged') {
      let target: typeof reactionNames[number] | null = null
      if (decoded.eventName === 'ReactionAdded' && 'reactionType' in decoded.args && typeof decoded.args.reactionType === 'number') {
        target = reactionAfterEvent({ name: 'ReactionAdded', reactionType: decoded.args.reactionType }, reversed)
      } else if (decoded.eventName === 'ReactionRemoved' && 'previousType' in decoded.args && typeof decoded.args.previousType === 'number') {
        target = reactionAfterEvent({ name: 'ReactionRemoved', previousType: decoded.args.previousType }, reversed)
      } else if (decoded.eventName === 'ReactionChanged' && 'oldType' in decoded.args && 'newType' in decoded.args &&
                 typeof decoded.args.oldType === 'number' && typeof decoded.args.newType === 'number') {
        target = reactionAfterEvent({ name: 'ReactionChanged', oldType: decoded.args.oldType, newType: decoded.args.newType }, reversed)
      }
      if (target === null && decoded.eventName === 'ReactionAdded' && !reversed) throw new Error(`Invalid reaction type in ${log.transactionHash}`)
      if (target === null && decoded.eventName === 'ReactionRemoved' && reversed) throw new Error(`Invalid prior reaction in ${log.transactionHash}`)

      if (target === null) {
        await tx.delete(schema.reactions).where(and(eq(schema.reactions.entryId, entry.id), eq(schema.reactions.walletAddress, user)))
      } else {
        await tx.insert(schema.reactions).values({
          entryId: entry.id,
          walletAddress: user,
          reactionType: target,
          txHash: log.transactionHash,
          createdAt: timestamp,
          updatedAt: timestamp,
        }).onConflictDoUpdate({
          target: [schema.reactions.entryId, schema.reactions.walletAddress],
          set: { reactionType: target, txHash: log.transactionHash, updatedAt: timestamp },
        })
      }
      const current = await tx.select({ reactionType: schema.reactions.reactionType }).from(schema.reactions)
        .where(eq(schema.reactions.entryId, entry.id))
      const totals = [0, 0, 0, 0, 0, 0]
      for (const row of current) totals[reactionNames.indexOf(row.reactionType)]++
      await tx.update(schema.entries).set({
        totalReactions: current.length,
        reactionLike: totals[0], reactionLove: totals[1], reactionLaugh: totals[2],
        reactionWow: totals[3], reactionSad: totals[4], reactionAngry: totals[5],
      }).where(eq(schema.entries.id, entry.id))
      return
    }

    if (decoded.eventName === 'Reposted' || decoded.eventName === 'Unreposted') {
      const active = activeAfterEvent(decoded.eventName, reversed)
      await tx.insert(schema.reposts).values({
        entryId: entry.id,
        walletAddress: user,
        txHash: active ? log.transactionHash : null,
        active,
        createdAt: timestamp,
        updatedAt: timestamp,
      }).onConflictDoUpdate({
        target: [schema.reposts.entryId, schema.reposts.walletAddress],
        set: { active, txHash: active ? log.transactionHash : null, updatedAt: timestamp },
      })
      const [totals] = await tx.select({ value: count() }).from(schema.reposts)
        .where(and(eq(schema.reposts.entryId, entry.id), eq(schema.reposts.active, true)))
      await tx.update(schema.entries).set({ repostCount: Number(totals?.value ?? 0) }).where(eq(schema.entries.id, entry.id))
      return
    }
  }

  if ((decoded.eventName === 'Followed' || decoded.eventName === 'Unfollowed') &&
      'follower' in decoded.args && 'followed' in decoded.args &&
      typeof decoded.args.follower === 'string' && typeof decoded.args.followed === 'string') {
    const follower = decoded.args.follower.toLowerCase()
    const followed = decoded.args.followed.toLowerCase()
    const active = activeAfterEvent(decoded.eventName, reversed)
    await tx.insert(schema.wallets).values([
      { address: follower, chainId },
      { address: followed, chainId },
    ]).onConflictDoNothing()
    await tx.insert(schema.follows).values({
      followerAddress: follower,
      followedAddress: followed,
      txHash: active ? log.transactionHash : null,
      active,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).onConflictDoUpdate({
      target: [schema.follows.followerAddress, schema.follows.followedAddress],
      set: { active, txHash: active ? log.transactionHash : null, updatedAt: timestamp },
    })
    const [followerTotals] = await tx.select({ value: count() }).from(schema.follows)
      .where(and(eq(schema.follows.followerAddress, follower), eq(schema.follows.active, true)))
    const [followedTotals] = await tx.select({ value: count() }).from(schema.follows)
      .where(and(eq(schema.follows.followedAddress, followed), eq(schema.follows.active, true)))
    await tx.update(schema.profiles).set({ followingCount: Number(followerTotals?.value ?? 0) })
      .where(eq(schema.profiles.walletAddress, follower))
    await tx.update(schema.profiles).set({ followerCount: Number(followedTotals?.value ?? 0) })
      .where(eq(schema.profiles.walletAddress, followed))
  }
}

async function updateProjection(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], contractName: string, log: Log, reversed = false) {
  if (contractName === 'entries') {
    await updateEntryProjection(tx, log, reversed)
    await updateNotificationsProjection(tx, log, reversed)
    return
  }
  if (contractName === 'social') {
    await updateSocialProjection(tx, log, reversed)
    await updateNotificationsProjection(tx, log, reversed)
    return
  }
  if (contractName === 'profiles') return updateProfileProjection(tx, log, reversed)
  if (contractName === 'moderation') {
    await updateModerationProjection(tx, log, reversed)
    await updateAppConfigProjection(tx, log, reversed)
    await updateNotificationsProjection(tx, log, reversed)
  }
}

// ---------------------------------------------------------------------------
// Notifications (app layer) — derived from chain events
// ---------------------------------------------------------------------------

type NotificationTypeName =
  | 'REPLY' | 'COMMENT' | 'MENTION' | 'REPOST' | 'QUOTE' | 'REACTION' | 'FOLLOW' | 'MODERATION' | 'ADMIN_ANNOUNCEMENT'

async function insertNotification(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  recipient: string,
  type: NotificationTypeName,
  actor: string | null,
  targetEntryId: number | null,
  timestamp: Date,
) {
  await tx.insert(schema.notifications).values({
    recipientAddress: recipient.toLowerCase(),
    type,
    actorAddress: actor ? actor.toLowerCase() : null,
    targetEntryId,
    createdAt: timestamp,
  }).onConflictDoNothing({
    target: [schema.notifications.recipientAddress, schema.notifications.type, schema.notifications.actorAddress, schema.notifications.targetEntryId],
  })
}

async function updateNotificationsProjection(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  log: Log,
  reversed = false,
) {
  const decodedEntries = decodeEntryLog(log)
  if (decodedEntries) return updateEntryNotifications(tx, log, decodedEntries, reversed)

  const decodedSocial = decodeSocialLog(log)
  if (decodedSocial) return updateSocialNotifications(tx, decodedSocial)

  const decodedModeration = decodeModerationLog(log)
  if (decodedModeration) return updateModerationNotifications(tx, decodedModeration, reversed)
}

async function updateEntryNotifications(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  log: Log,
  decoded: NonNullable<ReturnType<typeof decodeEntryLog>>,
  reversed: boolean,
) {
  {
    const timestamp = 'timestamp' in decoded.args && typeof decoded.args.timestamp === 'bigint'
      ? new Date(Number(decoded.args.timestamp) * 1000)
      : new Date()

    if (decoded.eventName === 'EntryCreated' &&
        'author' in decoded.args && typeof decoded.args.author === 'string' &&
        'entryType' in decoded.args && typeof decoded.args.entryType === 'number' &&
        'parentId' in decoded.args && typeof decoded.args.parentId === 'bigint' &&
        'referenceId' in decoded.args && typeof decoded.args.referenceId === 'bigint' &&
        'contentRef' in decoded.args && typeof decoded.args.contentRef === 'string') {
      const actor = decoded.args.author.toLowerCase()
      const parentChainId = Number(decoded.args.parentId)
      const referenceChainId = Number(decoded.args.referenceId)
      if (decoded.args.entryType === 1 && parentChainId > 0 && !reversed) {
        // COMMENT — notify the parent's author
        const [parent] = await tx.select({ authorAddress: schema.entries.authorAddress })
          .from(schema.entries).where(eq(schema.entries.chainEntryId, parentChainId)).limit(1)
        if (parent?.authorAddress && parent.authorAddress.toLowerCase() !== actor) {
          await insertNotification(tx, parent.authorAddress, 'REPLY', actor, null, timestamp)
        }
      }
      if (decoded.args.entryType === 2 && referenceChainId > 0 && !reversed) {
        // QUOTE — notify the referenced entry's author
        const [reference] = await tx.select({ authorAddress: schema.entries.authorAddress })
          .from(schema.entries).where(eq(schema.entries.chainEntryId, referenceChainId)).limit(1)
        if (reference?.authorAddress && reference.authorAddress.toLowerCase() !== actor) {
          await insertNotification(tx, reference.authorAddress, 'QUOTE', actor, null, timestamp)
        }
      }
      if (!reversed && 'entryId' in decoded.args && typeof decoded.args.entryId === 'bigint') {
        // MENTIONS — parsed from the canonical entry content
        const chainEntryId = Number(decoded.args.entryId)
        const [entry] = await tx.select({ id: schema.entries.id })
          .from(schema.entries).where(eq(schema.entries.chainEntryId, chainEntryId)).limit(1)
        if (entry) {
          const [contentRow] = await tx.select({ mentions: schema.entryContent.mentions })
            .from(schema.entryContent).where(eq(schema.entryContent.entryId, entry.id)).limit(1)
          if (contentRow) {
            const mentions = (contentRow.mentions ?? [])
              .filter((m): m is string => typeof m === 'string' && m.startsWith('0x') && m.length === 42)
              .filter((m) => m.toLowerCase() !== actor)
            for (const mentioned of new Set(mentions)) {
              await insertNotification(tx, mentioned, 'MENTION', actor, entry.id, timestamp)
            }
          }
        }
      }
      return
    }

    if (decoded.eventName === 'EntryStatusChanged' && 'entryId' in decoded.args &&
        typeof decoded.args.entryId === 'bigint' && 'newStatus' in decoded.args && typeof decoded.args.newStatus === 'number' &&
        'changedBy' in decoded.args && typeof decoded.args.changedBy === 'string') {
      const entryId = Number(decoded.args.entryId)
      const newStatus = ['ACTIVE', 'DELETED', 'HIDDEN', 'PENDING', 'REJECTED'][decoded.args.newStatus] ?? null
      const actor = decoded.args.changedBy.toLowerCase()
      const [entry] = await tx.select({ authorAddress: schema.entries.authorAddress })
        .from(schema.entries).where(eq(schema.entries.chainEntryId, entryId)).limit(1)
      if (!entry || !entry.authorAddress) return
      const recipient = entry.authorAddress.toLowerCase()
      const timestamp = 'timestamp' in decoded.args && typeof decoded.args.timestamp === 'bigint'
        ? new Date(Number(decoded.args.timestamp) * 1000)
        : new Date()
      if (reversed) {
        await tx.delete(schema.notifications).where(and(
          eq(schema.notifications.recipientAddress, recipient),
          eq(schema.notifications.type, 'MODERATION'),
        ))
      } else if (newStatus === 'HIDDEN' || newStatus === 'REJECTED' || newStatus === 'DELETED') {
        await insertNotification(tx, recipient, 'MODERATION', actor, entryId, timestamp)
      }
    }
    return
  }
}

async function updateSocialNotifications(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  decoded: NonNullable<ReturnType<typeof decodeSocialLog>>,
) {
  {
    const timestamp = 'timestamp' in decoded.args && typeof decoded.args.timestamp === 'bigint'
      ? new Date(Number(decoded.args.timestamp) * 1000)
      : new Date()

    if (decoded.eventName === 'ReactionAdded' && 'entryId' in decoded.args && typeof decoded.args.entryId === 'bigint' &&
        'user' in decoded.args && typeof decoded.args.user === 'string') {
      const chainEntryId = Number(decoded.args.entryId)
      const actor = decoded.args.user.toLowerCase()
      const [entry] = await tx.select({ id: schema.entries.id, authorAddress: schema.entries.authorAddress })
        .from(schema.entries).where(eq(schema.entries.chainEntryId, chainEntryId)).limit(1)
      if (entry?.authorAddress && entry.authorAddress.toLowerCase() !== actor) {
        await insertNotification(tx, entry.authorAddress, 'REACTION', actor, entry.id, timestamp)
      }
      return
    }

    if ((decoded.eventName === 'Reposted' || decoded.eventName === 'Unreposted') &&
        'entryId' in decoded.args && typeof decoded.args.entryId === 'bigint' &&
        'user' in decoded.args && typeof decoded.args.user === 'string') {
      const chainEntryId = Number(decoded.args.entryId)
      const actor = decoded.args.user.toLowerCase()
      const [entry] = await tx.select({ id: schema.entries.id, authorAddress: schema.entries.authorAddress })
        .from(schema.entries).where(eq(schema.entries.chainEntryId, chainEntryId)).limit(1)
      if (entry?.authorAddress && entry.authorAddress.toLowerCase() !== actor && decoded.eventName === 'Reposted') {
        await insertNotification(tx, entry.authorAddress, 'REPOST', actor, entry.id, timestamp)
      }
      return
    }

    if (decoded.eventName === 'Followed' &&
        'follower' in decoded.args && typeof decoded.args.follower === 'string' &&
        'followed' in decoded.args && typeof decoded.args.followed === 'string') {
      const followed = decoded.args.followed.toLowerCase()
      await insertNotification(tx, followed, 'FOLLOW', decoded.args.follower.toLowerCase(), null, timestamp)
      return
    }
  }
}

async function updateModerationNotifications(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  decoded: NonNullable<ReturnType<typeof decodeModerationLog>>,
  reversed = false,
) {
  {
    if (decoded.eventName === 'ReportSubmitted' && 'reportId' in decoded.args &&
        'reporter' in decoded.args && typeof decoded.args.reporter === 'string' &&
        'targetEntryId' in decoded.args && 'targetWallet' in decoded.args &&
        typeof decoded.args.targetEntryId === 'bigint' &&
        'timestamp' in decoded.args && typeof decoded.args.timestamp === 'bigint') {
      const timestamp = new Date(Number(decoded.args.timestamp) * 1000)
      // Target the referenced entry; skip when it has no indexed entry row yet.
      const [entry] = decoded.args.targetEntryId
        ? await tx.select({ id: schema.entries.id }).from(schema.entries)
            .where(eq(schema.entries.chainEntryId, Number(decoded.args.targetEntryId))).limit(1)
        : []
      if (!entry) return
      const [target] = await tx.select({ authorAddress: schema.entries.authorAddress })
        .from(schema.entries).where(eq(schema.entries.id, entry.id)).limit(1)
      if (target?.authorAddress) {
        await insertNotification(tx, target.authorAddress, 'MODERATION', decoded.args.reporter.toLowerCase(), entry.id, timestamp)
      }
    }
  }
}

async function updateAppConfigProjection(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  log: Log,
  reversed = false,
) {
  const decoded = decodeModerationLog(log)
  if (decoded?.eventName === 'ModerationModeChanged' && 'mode' in decoded.args && typeof decoded.args.mode === 'number') {
    const mode = ['OPEN', 'TRUSTED', 'STRICT', 'EVENT'][decoded.args.mode] ?? 'OPEN'
    await tx.insert(schema.appConfig).values({
      key: 'moderationMode',
      value: mode,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: schema.appConfig.key,
      set: { value: mode, updatedAt: new Date() },
    })
  }
}

async function rollbackToCommonBlock(contract: { name: string; address: string }, checkpoint: typeof schema.indexerCheckpoints.$inferSelect) {
  if (!checkpoint.lastBlock || !checkpoint.lastBlockHash) return checkpoint.lastBlock
  const currentBlock = await client.getBlock({ blockNumber: BigInt(checkpoint.lastBlock) })
  if (currentBlock.hash === checkpoint.lastBlockHash) return checkpoint.lastBlock

  const markers = await db.select().from(schema.indexedBlocks)
    .where(and(
      eq(schema.indexedBlocks.chainId, chainId),
      eq(schema.indexedBlocks.contractName, contract.name),
      lte(schema.indexedBlocks.blockNumber, checkpoint.lastBlock),
    ))
    .orderBy(desc(schema.indexedBlocks.blockNumber))
    .limit(REORG_MARKER_LIMIT)

  let commonBlock: number | null = null
  let commonHash: string | null = null
  for (const marker of markers) {
    const canonical = await client.getBlock({ blockNumber: BigInt(marker.blockNumber) })
    if (canonical.hash === marker.blockHash) {
      commonBlock = marker.blockNumber
      commonHash = marker.blockHash
      break
    }
  }
  if (commonBlock === null) {
    throw new Error(`Reorganization exceeds retained checkpoints for ${contract.name}; operator recovery is required`)
  }

  await db.transaction(async (tx) => {
    const orphaned = await tx.select().from(schema.indexedEvents)
      .where(and(
        eq(schema.indexedEvents.chainId, chainId),
        eq(schema.indexedEvents.contractName, contract.name),
        gt(schema.indexedEvents.blockNumber, commonBlock!),
        eq(schema.indexedEvents.canonical, true),
      ))
      .orderBy(desc(schema.indexedEvents.blockNumber), desc(schema.indexedEvents.logIndex))
    for (const row of orphaned) {
      if (['entries', 'social', 'profiles', 'moderation'].includes(contract.name)) {
        await updateProjection(tx, contract.name, {
          address: contract.address as Address,
          blockHash: row.blockHash as `0x${string}`,
          blockNumber: BigInt(row.blockNumber),
          data: row.data as `0x${string}`,
          topics: row.topics as [`0x${string}`, ...`0x${string}`[]],
          transactionHash: row.transactionHash as `0x${string}`,
          transactionIndex: 0,
          logIndex: row.logIndex,
          removed: false,
        }, true)
      }
    }
    await tx.delete(schema.indexedEvents).where(and(
      eq(schema.indexedEvents.chainId, chainId),
      eq(schema.indexedEvents.contractName, contract.name),
      gt(schema.indexedEvents.blockNumber, commonBlock!),
    ))
    await tx.delete(schema.indexedBlocks).where(and(
      eq(schema.indexedBlocks.chainId, chainId),
      eq(schema.indexedBlocks.contractName, contract.name),
      gt(schema.indexedBlocks.blockNumber, commonBlock!),
    ))
    await tx.update(schema.indexerCheckpoints).set({
      lastBlock: commonBlock!,
      lastBlockHash: commonHash!,
      updatedAt: new Date(),
    }).where(eq(schema.indexerCheckpoints.id, checkpoint.id))
  })
  console.warn(`[indexer] ${contract.name} chain reorganized; rolled back to block ${commonBlock}`)
  return commonBlock
}

async function processContract(contract: { name: string; address: string }, safeHead: number) {
  const [existing] = await db.select().from(schema.indexerCheckpoints).where(and(
    eq(schema.indexerCheckpoints.chainId, chainId),
    eq(schema.indexerCheckpoints.contractName, contract.name),
  )).limit(1)
  let checkpoint = existing
  if (!checkpoint) {
    const [created] = await db.insert(schema.indexerCheckpoints).values({
      chainId,
      contractName: contract.name,
      lastBlock: Math.max(0, startBlock - 1),
    }).returning()
    checkpoint = created
  }

  let cursor = await rollbackToCommonBlock(contract, checkpoint)
  if (!checkpoint.lastBlockHash && cursor === checkpoint.lastBlock) {
    const markerBlock = await client.getBlock({ blockNumber: BigInt(cursor) })
    await db.update(schema.indexerCheckpoints).set({ lastBlockHash: markerBlock.hash }).where(eq(schema.indexerCheckpoints.id, checkpoint.id))
  }

  while (cursor < safeHead) {
    const fromBlock = Math.max(cursor + 1, startBlock)
    const toBlock = Math.min(fromBlock + blockChunk - 1, safeHead)
    if (fromBlock > toBlock) break
    const logs = await client.getLogs({ address: contract.address as Address, fromBlock: BigInt(fromBlock), toBlock: BigInt(toBlock) })
    const endBlock = await client.getBlock({ blockNumber: BigInt(toBlock) })

    await db.transaction(async (tx) => {
      for (const log of logs) {
        if (!log.blockNumber || !log.blockHash || !log.transactionHash || log.logIndex === null) continue
        const [inserted] = await tx.insert(schema.indexedEvents).values({
          chainId,
          contractName: contract.name,
          contractAddress: contract.address.toLowerCase(),
          blockNumber: Number(log.blockNumber),
          blockHash: log.blockHash,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex,
          topics: [...log.topics],
          data: log.data,
        }).onConflictDoNothing().returning({ id: schema.indexedEvents.id })
        if (inserted) await updateProjection(tx, contract.name, log)
      }
      await tx.insert(schema.indexedBlocks).values({
        chainId,
        contractName: contract.name,
        blockNumber: toBlock,
        blockHash: endBlock.hash,
      }).onConflictDoUpdate({
        target: [schema.indexedBlocks.chainId, schema.indexedBlocks.contractName, schema.indexedBlocks.blockNumber],
        set: { blockHash: endBlock.hash },
      })
      await tx.update(schema.indexerCheckpoints).set({
        lastBlock: toBlock,
        lastBlockHash: endBlock.hash,
        lastLogIndex: logs.at(-1)?.logIndex ?? 0,
        lastTxHash: logs.at(-1)?.transactionHash ?? null,
        updatedAt: new Date(),
      }).where(eq(schema.indexerCheckpoints.id, checkpoint!.id))
      const retainedMarkers = await tx.select({ blockNumber: schema.indexedBlocks.blockNumber })
        .from(schema.indexedBlocks)
        .where(and(eq(schema.indexedBlocks.chainId, chainId), eq(schema.indexedBlocks.contractName, contract.name)))
        .orderBy(desc(schema.indexedBlocks.blockNumber))
        .limit(REORG_MARKER_LIMIT)
      const oldestRetainedBlock = retainedMarkers.at(-1)?.blockNumber
      if (oldestRetainedBlock !== undefined) {
        await tx.delete(schema.indexedBlocks).where(and(
          eq(schema.indexedBlocks.chainId, chainId),
          eq(schema.indexedBlocks.contractName, contract.name),
          lt(schema.indexedBlocks.blockNumber, oldestRetainedBlock),
        ))
      }
    })
    cursor = toBlock
  }
}

async function runOnce() {
  const head = await client.getBlockNumber()
  const safeHead = Number(head) - confirmations
  if (safeHead < startBlock) return
  for (const contract of contracts) await processContract(contract, safeHead)
}

let shutdownRequested = false
process.once('SIGINT', () => { shutdownRequested = true })
process.once('SIGTERM', () => { shutdownRequested = true })

async function main() {
  const lockClient = await pool.connect()
  let lockAcquired = false
  try {
    const lockResult = await lockClient.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS locked',
      [0x4f4e, chainId],
    )
    if (!lockResult.rows[0]?.locked) {
      throw new Error(`Another indexer already holds the chain ${chainId} lock`)
    }
    lockAcquired = true
    console.info(`[indexer] chain=${chainId} contracts=${contracts.length} start=${startBlock} confirmations=${confirmations}`)
    while (!shutdownRequested) {
      try {
        await runOnce()
      } catch (error) {
        console.error('[indexer] scan failed; checkpoint retained for retry:', error)
      }
      if (!shutdownRequested) await new Promise((resolve) => setTimeout(resolve, pollMs))
    }
  } finally {
    if (lockAcquired) await lockClient.query('SELECT pg_advisory_unlock($1, $2)', [0x4f4e, chainId])
    lockClient.release()
    await pool.end()
  }
}

void main().catch((error) => {
  console.error('[indexer] stopped unexpectedly:', error)
  process.exitCode = 1
})
