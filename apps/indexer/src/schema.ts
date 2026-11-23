import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  bigint,
} from 'drizzle-orm/pg-core'

export const entryTypeEnum = pgEnum('entry_type', ['POST', 'COMMENT', 'QUOTE'])
export const entryStatusEnum = pgEnum('entry_status', ['ACTIVE', 'DELETED', 'HIDDEN', 'PENDING', 'REJECTED'])
export const pendingEntries = pgTable('pending_entries', {
  id: serial('id').primaryKey(),
  authorAddress: varchar('author_address', { length: 42 }).notNull(),
  chainId: integer('chain_id').notNull(),
  entryType: entryTypeEnum('entry_type').notNull(),
  parentChainId: bigint('parent_chain_id', { mode: 'number' }).notNull(),
  referenceChainId: bigint('reference_chain_id', { mode: 'number' }).notNull(),
  contentRef: varchar('content_ref', { length: 66 }).notNull(),
  text: text('text').notNull(),
  hashtags: text('hashtags').array().notNull(),
  mentions: text('mentions').array().notNull(),
  mediaUrls: text('media_urls').array().notNull(),
  mediaMetadata: jsonb('media_metadata').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').notNull(),
}, (table) => [index('pending_entries_author_ref_idx').on(table.authorAddress, table.contentRef)])
export const wallets = pgTable('wallets', {
  address: varchar('address', { length: 42 }).primaryKey(),
  chainId: integer('chain_id').notNull(),
})
export const entries = pgTable('entries', {
  id: serial('id').primaryKey(),
  chainEntryId: bigint('chain_entry_id', { mode: 'number' }).unique(),
  txHash: varchar('tx_hash', { length: 66 }),
  blockNumber: bigint('block_number', { mode: 'number' }),
  logIndex: integer('log_index'),
  authorAddress: varchar('author_address', { length: 42 }).notNull(),
  entryType: entryTypeEnum('entry_type').notNull(),
  parentId: integer('parent_id'),
  referenceId: integer('reference_id'),
  contentRef: text('content_ref').notNull(),
  chainCreatedAt: timestamp('chain_created_at'),
  status: entryStatusEnum('status').notNull().default('PENDING'),
  pinned: boolean('pinned').notNull().default(false),
  commentCount: integer('comment_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
export const entryContent = pgTable('entry_content', {
  id: serial('id').primaryKey(),
  entryId: integer('entry_id').notNull().unique(),
  text: text('text').notNull(),
  hashtags: text('hashtags').array().notNull(),
  mentions: text('mentions').array().notNull(),
})
export const media = pgTable('media', {
  id: serial('id').primaryKey(),
  entryId: integer('entry_id').notNull(),
  url: text('url').notNull(),
  ipfsCid: text('ipfs_cid'),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes: integer('size_bytes'),
}, (table) => [uniqueIndex('media_entry_cid_unique_idx').on(table.entryId, table.ipfsCid)])
export const indexerCheckpoints = pgTable('indexer_checkpoints', {
  id: serial('id').primaryKey(),
  chainId: integer('chain_id').notNull(),
  contractName: varchar('contract_name', { length: 50 }).notNull(),
  lastBlock: bigint('last_block', { mode: 'number' }).notNull().default(0),
  lastLogIndex: integer('last_log_index').notNull().default(0),
  lastTxHash: varchar('last_tx_hash', { length: 66 }),
  lastBlockHash: varchar('last_block_hash', { length: 66 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [uniqueIndex('indexer_chain_contract_idx').on(table.chainId, table.contractName)])
export const indexedEvents = pgTable('indexed_events', {
  id: serial('id').primaryKey(),
  chainId: integer('chain_id').notNull(),
  contractName: varchar('contract_name', { length: 50 }).notNull(),
  contractAddress: varchar('contract_address', { length: 42 }).notNull(),
  blockNumber: bigint('block_number', { mode: 'number' }).notNull(),
  blockHash: varchar('block_hash', { length: 66 }).notNull(),
  transactionHash: varchar('transaction_hash', { length: 66 }).notNull(),
  logIndex: integer('log_index').notNull(),
  topics: jsonb('topics').$type<string[]>().notNull(),
  data: text('data').notNull(),
  canonical: boolean('canonical').notNull().default(true),
  indexedAt: timestamp('indexed_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('indexed_events_tx_log_unique_idx').on(table.chainId, table.transactionHash, table.logIndex),
  index('indexed_events_block_idx').on(table.chainId, table.contractName, table.blockNumber),
])
export const indexedBlocks = pgTable('indexed_blocks', {
  chainId: integer('chain_id').notNull(),
  contractName: varchar('contract_name', { length: 50 }).notNull(),
  blockNumber: bigint('block_number', { mode: 'number' }).notNull(),
  blockHash: varchar('block_hash', { length: 66 }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.chainId, table.contractName, table.blockNumber] }),
  index('indexed_blocks_recent_idx').on(table.chainId, table.contractName, table.blockNumber),
])
