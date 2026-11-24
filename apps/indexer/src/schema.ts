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

export const reactionTypeEnum = pgEnum('reaction_type', ['LIKE', 'LOVE', 'LAUGH', 'WOW', 'SAD', 'ANGRY'])
export const userRestrictionEnum = pgEnum('user_restriction', ['NONE', 'RESTRICTED', 'BANNED'])
export const reportCategoryEnum = pgEnum('report_category', ['SPAM', 'HARASSMENT', 'HATE_SPEECH', 'MISINFORMATION', 'ILLEGAL_CONTENT', 'VIOLENT_CONTENT', 'ADULT_CONTENT', 'OTHER'])
export const reportStatusEnum = pgEnum('report_status', ['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'])
export const moderationActionEnum = pgEnum('moderation_action', ['APPROVE', 'REJECT', 'HIDE', 'RESTORE', 'PIN', 'UNPIN', 'DELETE'])

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
  isTrusted: boolean('is_trusted').notNull().default(false),
  isModerator: boolean('is_moderator').notNull().default(false),
  isAdmin: boolean('is_admin').notNull().default(false),
  restriction: userRestrictionEnum('restriction').notNull().default('NONE'),
})
export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull().unique(),
  displayName: varchar('display_name', { length: 50 }),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  bannerUrl: text('banner_url'),
  website: text('website'),
  twitterHandle: varchar('twitter_handle', { length: 50 }),
  githubHandle: varchar('github_handle', { length: 50 }),
  metadataRef: text('metadata_ref'),
  registeredAt: timestamp('registered_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
  followerCount: integer('follower_count').notNull().default(0),
  followingCount: integer('following_count').notNull().default(0),
  postCount: integer('post_count').notNull().default(0),
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
  repostCount: integer('repost_count').notNull().default(0),
  totalReactions: integer('total_reactions').notNull().default(0),
  reactionLike: integer('reaction_like').notNull().default(0),
  reactionLove: integer('reaction_love').notNull().default(0),
  reactionLaugh: integer('reaction_laugh').notNull().default(0),
  reactionWow: integer('reaction_wow').notNull().default(0),
  reactionSad: integer('reaction_sad').notNull().default(0),
  reactionAngry: integer('reaction_angry').notNull().default(0),
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
export const reactions = pgTable('reactions', {
  id: serial('id').primaryKey(),
  entryId: integer('entry_id').notNull(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  reactionType: reactionTypeEnum('reaction_type').notNull(),
  txHash: varchar('tx_hash', { length: 66 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [uniqueIndex('reactions_entry_wallet_idx').on(table.entryId, table.walletAddress)])
export const reposts = pgTable('reposts', {
  id: serial('id').primaryKey(),
  entryId: integer('entry_id').notNull(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  txHash: varchar('tx_hash', { length: 66 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [uniqueIndex('reposts_entry_wallet_idx').on(table.entryId, table.walletAddress)])
export const follows = pgTable('follows', {
  id: serial('id').primaryKey(),
  followerAddress: varchar('follower_address', { length: 42 }).notNull(),
  followedAddress: varchar('followed_address', { length: 42 }).notNull(),
  txHash: varchar('tx_hash', { length: 66 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [uniqueIndex('follows_pair_idx').on(table.followerAddress, table.followedAddress)])
export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  chainReportId: bigint('chain_report_id', { mode: 'number' }),
  reporterAddress: varchar('reporter_address', { length: 42 }).notNull(),
  targetEntryId: integer('target_entry_id'),
  targetChainEntryId: bigint('target_chain_entry_id', { mode: 'number' }),
  targetWalletAddress: varchar('target_wallet_address', { length: 42 }),
  category: reportCategoryEnum('category').notNull(),
  status: reportStatusEnum('status').notNull().default('PENDING'),
  notes: text('notes'),
  txHash: varchar('tx_hash', { length: 66 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  resolvedByAddress: varchar('resolved_by_address', { length: 42 }),
}, (table) => [uniqueIndex('reports_chain_report_unique_idx').on(table.chainReportId)])
export const moderationLogs = pgTable('moderation_logs', {
  id: serial('id').primaryKey(),
  actorAddress: varchar('actor_address', { length: 42 }).notNull(),
  action: moderationActionEnum('action').notNull(),
  targetEntryId: integer('target_entry_id'),
  targetWalletAddress: varchar('target_wallet_address', { length: 42 }),
  reason: text('reason'),
  txHash: varchar('tx_hash', { length: 66 }),
  chainAuditId: bigint('chain_audit_id', { mode: 'number' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [uniqueIndex('moderation_logs_chain_audit_unique_idx').on(table.chainAuditId)])
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

export const notificationTypeEnum = pgEnum('notification_type', [
  'REPLY', 'COMMENT', 'MENTION', 'REPOST', 'QUOTE', 'REACTION', 'FOLLOW', 'MODERATION', 'ADMIN_ANNOUNCEMENT',
])

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  recipientAddress: varchar('recipient_address', { length: 42 }).notNull(),
  type: notificationTypeEnum('type').notNull(),
  actorAddress: varchar('actor_address', { length: 42 }),
  targetEntryId: integer('target_entry_id'),
  targetWalletAddress: varchar('target_wallet_address', { length: 42 }),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('notifications_recipient_idx').on(table.recipientAddress),
  index('notifications_read_idx').on(table.read),
  index('notifications_created_idx').on(table.createdAt),
])

export const appConfig = pgTable('app_config', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
