import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { and, desc, eq, gt, lte, sql } from 'drizzle-orm'
import { decodeEventLog, defineChain, http, createPublicClient, type Address, type Log } from 'viem'
import { CHAIN_IDS, ONCHAIN_ENTRIES_ABI, createEntryContentDocument, getEntryContentReference } from '@onchain/shared'
import * as schema from './schema.js'

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
  if (!decoded || !('entryId' in decoded.args)) return
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
    if (contract.name === 'entries') {
      for (const row of orphaned) {
        const result = decodeEntryLog({
          address: contract.address as Address,
          blockHash: row.blockHash as `0x${string}`,
          blockNumber: BigInt(row.blockNumber),
          data: row.data as `0x${string}`,
          topics: row.topics as [`0x${string}`, ...`0x${string}`[]],
          transactionHash: row.transactionHash as `0x${string}`,
          transactionIndex: 0,
          logIndex: row.logIndex,
          removed: false,
        })
        if (result) await updateEntryProjection(tx, {
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
        if (inserted && contract.name === 'entries') await updateEntryProjection(tx, log)
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

async function main() {
  const lockClient = await pool.connect()
  const lockResult = await lockClient.query<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock($1, $2) AS locked',
    [0x4f4e, chainId],
  )
  if (!lockResult.rows[0]?.locked) {
    lockClient.release()
    throw new Error(`Another indexer already holds the chain ${chainId} lock`)
  }
  console.info(`[indexer] chain=${chainId} contracts=${contracts.length} start=${startBlock} confirmations=${confirmations}`)
  while (true) {
    try {
      await runOnce()
    } catch (error) {
      console.error('[indexer] scan failed; checkpoint retained for retry:', error)
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
}

process.once('SIGINT', () => { void pool.end().then(() => process.exit(0)) })
process.once('SIGTERM', () => { void pool.end().then(() => process.exit(0)) })
void main()
