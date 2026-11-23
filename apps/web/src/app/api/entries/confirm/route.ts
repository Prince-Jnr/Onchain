import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createPublicClient, decodeEventLog, http, isAddress, isHex } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { CHAIN_IDS, ONCHAIN_ENTRIES_ABI } from '@onchain/shared'
import { db } from '@/lib/db'
import { entryContent, entries, media, wallets } from '@/lib/schema'
import { getEntryContentReference, createEntryContentDocument } from '@/lib/content-reference'
import { getAuthenticatedSession } from '@/lib/session'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  let body: { txHash?: unknown; text?: unknown; mediaUrls?: unknown; media?: unknown; entryType?: unknown; parentId?: unknown; referenceId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof body.txHash !== 'string' || body.txHash.length !== 66 || !isHex(body.txHash)) {
    return NextResponse.json({ error: 'A valid transaction hash is required' }, { status: 400 })
  }
  if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 500) {
    return NextResponse.json({ error: 'text must contain 1–500 characters' }, { status: 400 })
  }
  const types = ['POST', 'COMMENT', 'QUOTE'] as const
  if (!types.includes(body.entryType as (typeof types)[number])) {
    return NextResponse.json({ error: 'Invalid entry type' }, { status: 400 })
  }
  const entryType = body.entryType as (typeof types)[number]
  const mediaUrls = Array.isArray(body.mediaUrls) && body.mediaUrls.every((url) => typeof url === 'string')
    ? body.mediaUrls as string[]
    : []
  if (mediaUrls.length > 4 || mediaUrls.some((url) => url.length > 2048)) {
    return NextResponse.json({ error: 'Invalid media URLs' }, { status: 400 })
  }
  const mediaItems = Array.isArray(body.media) ? body.media as { url?: unknown; ipfsCid?: unknown; mimeType?: unknown; sizeBytes?: unknown }[] : []
  const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  if (mediaItems.length !== mediaUrls.length || mediaItems.some((item, index) =>
    item.url !== mediaUrls[index] || typeof item.ipfsCid !== 'string' || !/^bafy[a-z2-7]{20,}$/.test(item.ipfsCid) ||
    item.url !== `https://gateway.pinata.cloud/ipfs/${item.ipfsCid}` ||
    typeof item.mimeType !== 'string' || !acceptedMimeTypes.has(item.mimeType) ||
    typeof item.sizeBytes !== 'number' || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || item.sizeBytes > 10 * 1024 * 1024
  )) {
    return NextResponse.json({ error: 'Media metadata does not match the pinned content URLs' }, { status: 400 })
  }
  if (new Set(mediaItems.map((item) => item.ipfsCid)).size !== mediaItems.length) {
    return NextResponse.json({ error: 'Duplicate image content references are not allowed' }, { status: 400 })
  }
  const parseRef = (value: unknown) => value == null ? 0 : Number(value)
  const parentNumber = parseRef(body.parentId)
  const referenceNumber = parseRef(body.referenceId)
  if (!Number.isSafeInteger(parentNumber) || !Number.isSafeInteger(referenceNumber) || parentNumber < 0 || referenceNumber < 0) {
    return NextResponse.json({ error: 'Invalid entry reference' }, { status: 400 })
  }
  const parentId = BigInt(parentNumber)
  const referenceId = BigInt(referenceNumber)
  if ((entryType === 'POST' && (parentNumber !== 0 || referenceNumber !== 0)) ||
      (entryType === 'COMMENT' && (parentNumber === 0 || referenceNumber !== 0)) ||
      (entryType === 'QUOTE' && (parentNumber !== 0 || referenceNumber === 0))) {
    return NextResponse.json({ error: 'Entry type and references do not match' }, { status: 400 })
  }

  const chainId = session.chainId
  const chain = chainId === CHAIN_IDS.BASE_SEPOLIA ? baseSepolia : chainId === CHAIN_IDS.BASE ? base : null
  const contractValue = chainId === CHAIN_IDS.BASE_SEPOLIA
    ? process.env.NEXT_PUBLIC_ENTRIES_ADDRESS_SEPOLIA
    : chainId === CHAIN_IDS.BASE ? process.env.NEXT_PUBLIC_ENTRIES_ADDRESS : undefined
  if (!chain || !contractValue || !isAddress(contractValue) || contractValue.toLowerCase() === ZERO_ADDRESS) {
    return NextResponse.json({ error: 'No deployed entries contract is configured for this network' }, { status: 503 })
  }

  const document = createEntryContentDocument(body.text, mediaUrls)
  const contentRef = getEntryContentReference(document)
  const client = createPublicClient({
    chain,
    transport: http(chainId === CHAIN_IDS.BASE_SEPOLIA
      ? process.env.BASE_SEPOLIA_RPC_URL
      : process.env.BASE_RPC_URL),
  })

  try {
    const hash = body.txHash as `0x${string}`
    const [tx, receipt] = await Promise.all([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash }),
    ])
    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'The transaction failed on-chain' }, { status: 422 })
    }
    if (tx.from.toLowerCase() !== session.walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Transaction sender does not match the signed-in wallet' }, { status: 403 })
    }
    if (!tx.to || tx.to.toLowerCase() !== contractValue.toLowerCase() ||
        receipt.to?.toLowerCase() !== contractValue.toLowerCase()) {
      return NextResponse.json({ error: 'Transaction was not sent to the configured entries contract' }, { status: 422 })
    }

    const created = receipt.logs.flatMap((log, logIndex) => {
      if (log.address.toLowerCase() !== contractValue.toLowerCase()) return []
      try {
        const decoded = decodeEventLog({ abi: ONCHAIN_ENTRIES_ABI, data: log.data, topics: log.topics, eventName: 'EntryCreated' })
        return [{ args: decoded.args, logIndex }]
      } catch {
        return []
      }
    })
    const matched = created.find(({ args: item }) =>
      item.author.toLowerCase() === session.walletAddress.toLowerCase() &&
      item.entryType === (entryType === 'POST' ? 0 : entryType === 'COMMENT' ? 1 : 2) &&
      item.parentId === parentId && item.referenceId === referenceId && item.contentRef === contentRef,
    )
    if (!matched) {
      return NextResponse.json({ error: 'The confirmed transaction does not contain the expected entry event' }, { status: 422 })
    }
    const event = matched.args

    const [existing] = await db.select().from(entries).where(eq(entries.txHash, hash)).limit(1)
    if (existing) {
      const [content] = await db.select().from(entryContent).where(eq(entryContent.entryId, existing.id)).limit(1)
      if (!content) {
        await db.insert(entryContent).values({
          entryId: existing.id,
          text: document.text,
          hashtags: document.hashtags,
          mentions: document.mentions,
        })
      }
      for (const item of mediaItems) {
        await db.insert(media).values({
          entryId: existing.id,
          url: item.url as string,
          ipfsCid: item.ipfsCid as string,
          mimeType: item.mimeType as string,
          sizeBytes: item.sizeBytes as number,
        }).onConflictDoNothing()
      }
      return NextResponse.json({ id: existing.id, chainEntryId: existing.chainEntryId, txHash: hash })
    }

    const [wallet] = await db.select({ address: wallets.address }).from(wallets)
      .where(eq(wallets.address, session.walletAddress.toLowerCase())).limit(1)
    if (!wallet) return NextResponse.json({ error: 'Wallet profile missing; sign in again before publishing' }, { status: 409 })

    const status = (['ACTIVE', 'DELETED', 'HIDDEN', 'PENDING', 'REJECTED'] as const)[Number(event.status)]
    if (!status) return NextResponse.json({ error: 'Contract emitted an unknown entry status' }, { status: 422 })
    let localParentId: number | null = null
    let localReferenceId: number | null = null
    if (parentNumber || referenceNumber) {
      const chainTarget = parentNumber || referenceNumber
      const [target] = await db.select({ id: entries.id }).from(entries)
        .where(eq(entries.chainEntryId, chainTarget)).limit(1)
      if (!target) {
        return NextResponse.json({ error: 'The referenced entry is not indexed yet. Retry confirmation shortly.' }, { status: 409 })
      }
      if (parentNumber) localParentId = target.id
      if (referenceNumber) localReferenceId = target.id
    }
    const block = await client.getBlock({ blockNumber: receipt.blockNumber })
    const [newEntry] = await db.insert(entries).values({
      chainEntryId: Number(event.entryId),
      txHash: hash,
      blockNumber: Number(receipt.blockNumber),
      logIndex: matched.logIndex,
      authorAddress: session.walletAddress.toLowerCase(),
      entryType,
      parentId: localParentId,
      referenceId: localReferenceId,
      contentRef,
      chainCreatedAt: new Date(Number(event.timestamp) * 1000),
      createdAt: new Date(Number(block.timestamp) * 1000),
      status,
    }).returning()
    const [content] = await db.insert(entryContent).values({
      entryId: newEntry.id,
      text: document.text,
      hashtags: document.hashtags,
      mentions: document.mentions,
    }).returning()
    for (const item of mediaItems) {
      await db.insert(media).values({
        entryId: newEntry.id,
        url: item.url as string,
        ipfsCid: item.ipfsCid as string,
        mimeType: item.mimeType as string,
        sizeBytes: item.sizeBytes as number,
      })
    }
    return NextResponse.json({ id: newEntry.id, chainEntryId: newEntry.chainEntryId, txHash: hash, status: newEntry.status, content: content.text }, { status: 201 })
  } catch (error) {
    console.error('[entries confirm] Verification failed:', error)
    return NextResponse.json({ error: 'Could not verify transaction yet. Retry after it is confirmed on-chain.' }, { status: 502 })
  }
}
