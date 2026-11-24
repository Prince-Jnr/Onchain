import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  varchar,
  pgEnum,
  index,
  uniqueIndex,
  serial,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// =========================================================
// Enums
// =========================================================

export const entryTypeEnum = pgEnum('entry_type', ['POST', 'COMMENT', 'QUOTE'])

export const entryStatusEnum = pgEnum('entry_status', [
  'ACTIVE',
  'DELETED',
  'HIDDEN',
  'PENDING',
  'REJECTED',
])

export const reactionTypeEnum = pgEnum('reaction_type', [
  'LIKE',
  'LOVE',
  'LAUGH',
  'WOW',
  'SAD',
  'ANGRY',
])

export const moderationModeEnum = pgEnum('moderation_mode', [
  'OPEN',
  'TRUSTED',
  'STRICT',
  'EVENT',
])

export const moderationActionEnum = pgEnum('moderation_action', [
  'APPROVE',
  'REJECT',
  'HIDE',
  'RESTORE',
  'PIN',
  'UNPIN',
  'DELETE',
])

export const userRestrictionEnum = pgEnum('user_restriction', [
  'NONE',
  'RESTRICTED',
  'BANNED',
])

export const reportCategoryEnum = pgEnum('report_category', [
  'SPAM',
  'HARASSMENT',
  'HATE_SPEECH',
  'MISINFORMATION',
  'ILLEGAL_CONTENT',
  'VIOLENT_CONTENT',
  'ADULT_CONTENT',
  'OTHER',
])

export const reportStatusEnum = pgEnum('report_status', [
  'PENDING',
  'REVIEWING',
  'RESOLVED',
  'DISMISSED',
])

export const notificationTypeEnum = pgEnum('notification_type', [
  'REPLY',
  'COMMENT',
  'MENTION',
  'REPOST',
  'QUOTE',
  'REACTION',
  'FOLLOW',
  'MODERATION',
  'ADMIN_ANNOUNCEMENT',
])

export const badgeTypeEnum = pgEnum('badge_type', [
  'EARLY_CONTRIBUTOR',
  'FOUNDING_MEMBER',
  'ACTIVE_PARTICIPANT',
  'TRUSTED_CONTRIBUTOR',
  'VERIFIED_MODERATOR',
  'CREATOR',
  'COMMUNITY_MEMBER',
])

// =========================================================
// Core Tables
// =========================================================

export const wallets = pgTable(
  'wallets',
  {
    address: varchar('address', { length: 42 }).primaryKey(),
    chainId: integer('chain_id').notNull().default(8453),
    firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
    restriction: userRestrictionEnum('restriction').notNull().default('NONE'),
    isTrusted: boolean('is_trusted').notNull().default(false),
    isModerator: boolean('is_moderator').notNull().default(false),
    isAdmin: boolean('is_admin').notNull().default(false),
  },
  (t) => [
    index('wallets_last_seen_idx').on(t.lastSeenAt),
  ]
)

export const profiles = pgTable(
  'profiles',
  {
    id: serial('id').primaryKey(),
    walletAddress: varchar('wallet_address', { length: 42 }).notNull().references(() => wallets.address),
    displayName: varchar('display_name', { length: 50 }),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    bannerUrl: text('banner_url'),
    website: text('website'),
    twitterHandle: varchar('twitter_handle', { length: 50 }),
    githubHandle: varchar('github_handle', { length: 50 }),
    metadataRef: text('metadata_ref'), // IPFS CID
    registeredAt: timestamp('registered_at'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    isActive: boolean('is_active').notNull().default(true),
    // Cached counts (updated by indexer)
    followerCount: integer('follower_count').notNull().default(0),
    followingCount: integer('following_count').notNull().default(0),
    postCount: integer('post_count').notNull().default(0),
  },
  (t) => [
    uniqueIndex('profiles_wallet_idx').on(t.walletAddress),
    index('profiles_display_name_idx').on(t.displayName),
  ]
)

export const siweNonces = pgTable(
  'siwe_nonces',
  {
    id: serial('id').primaryKey(),
    nonce: varchar('nonce', { length: 64 }).notNull().unique(),
    walletAddress: varchar('wallet_address', { length: 42 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
    used: boolean('used').notNull().default(false),
  },
  (t) => [
    index('siwe_nonces_expires_idx').on(t.expiresAt),
    index('siwe_nonces_nonce_idx').on(t.nonce),
  ]
)

export const sessions = pgTable(
  'sessions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    walletAddress: varchar('wallet_address', { length: 42 }).notNull().references(() => wallets.address),
    chainId: integer('chain_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
    lastUsedAt: timestamp('last_used_at').notNull().defaultNow(),
  },
  (t) => [
    index('sessions_wallet_idx').on(t.walletAddress),
    index('sessions_expires_idx').on(t.expiresAt),
  ]
)

// =========================================================
// Content Tables
// =========================================================

export const entries = pgTable(
  'entries',
  {
    id: serial('id').primaryKey(),
    // On-chain data (synced by indexer)
    chainEntryId: bigint('chain_entry_id', { mode: 'number' }).unique(),
    txHash: varchar('tx_hash', { length: 66 }),
    blockNumber: bigint('block_number', { mode: 'number' }),
    logIndex: integer('log_index'),
    authorAddress: varchar('author_address', { length: 42 }).notNull().references(() => wallets.address),
    entryType: entryTypeEnum('entry_type').notNull(),
    parentId: integer('parent_id'),
    referenceId: integer('reference_id'),
    contentRef: text('content_ref').notNull(), // keccak256 hash of canonical content document
    chainCreatedAt: timestamp('chain_created_at'),
    status: entryStatusEnum('status').notNull().default('PENDING'),
    pinned: boolean('pinned').notNull().default(false),
    // Application layer
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    // Cached counts (updated by indexer)
    commentCount: integer('comment_count').notNull().default(0),
    repostCount: integer('repost_count').notNull().default(0),
    totalReactions: integer('total_reactions').notNull().default(0),
    reactionLike: integer('reaction_like').notNull().default(0),
    reactionLove: integer('reaction_love').notNull().default(0),
    reactionLaugh: integer('reaction_laugh').notNull().default(0),
    reactionWow: integer('reaction_wow').notNull().default(0),
    reactionSad: integer('reaction_sad').notNull().default(0),
    reactionAngry: integer('reaction_angry').notNull().default(0),
  },
  (t) => [
    index('entries_author_idx').on(t.authorAddress),
    index('entries_parent_idx').on(t.parentId),
    index('entries_status_idx').on(t.status),
    index('entries_created_idx').on(t.createdAt),
    index('entries_chain_id_idx').on(t.chainEntryId),
    uniqueIndex('entries_tx_hash_unique_idx').on(t.txHash),
    index('entries_type_idx').on(t.entryType),
  ]
)

export const pendingEntries = pgTable(
  'pending_entries',
  {
    id: serial('id').primaryKey(),
    authorAddress: varchar('author_address', { length: 42 }).notNull().references(() => wallets.address),
    chainId: integer('chain_id').notNull(),
    entryType: entryTypeEnum('entry_type').notNull(),
    parentChainId: bigint('parent_chain_id', { mode: 'number' }).notNull().default(0),
    referenceChainId: bigint('reference_chain_id', { mode: 'number' }).notNull().default(0),
    contentRef: varchar('content_ref', { length: 66 }).notNull(),
    text: text('text').notNull(),
    hashtags: text('hashtags').array().notNull().default([]),
    mentions: text('mentions').array().notNull().default([]),
    mediaUrls: text('media_urls').array().notNull().default([]),
    mediaMetadata: jsonb('media_metadata').notNull().default([]),
    expiresAt: timestamp('expires_at').notNull(),
    consumedAt: timestamp('consumed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('pending_entries_author_ref_unique_idx').on(t.authorAddress, t.contentRef),
    index('pending_entries_expiry_idx').on(t.expiresAt),
  ],
)

export const entryContent = pgTable(
  'entry_content',
  {
    id: serial('id').primaryKey(),
    entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    hashtags: text('hashtags').array().notNull().default([]),
    mentions: text('mentions').array().notNull().default([]),
    metadata: jsonb('metadata'), // Link previews, extra data
    fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('entry_content_entry_idx').on(t.entryId),
  ]
)

export const media = pgTable(
  'media',
  {
    id: serial('id').primaryKey(),
    entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    ipfsCid: text('ipfs_cid'),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    width: integer('width'),
    height: integer('height'),
    sizeBytes: integer('size_bytes'),
    altText: text('alt_text'),
    uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  },
  (t) => [
    index('media_entry_idx').on(t.entryId),
    uniqueIndex('media_entry_cid_unique_idx').on(t.entryId, t.ipfsCid),
  ]
)

export const reactions = pgTable(
  'reactions',
  {
    id: serial('id').primaryKey(),
    entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
    walletAddress: varchar('wallet_address', { length: 42 }).notNull().references(() => wallets.address),
    reactionType: reactionTypeEnum('reaction_type').notNull(),
    txHash: varchar('tx_hash', { length: 66 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('reactions_entry_wallet_idx').on(t.entryId, t.walletAddress),
    index('reactions_entry_idx').on(t.entryId),
    index('reactions_wallet_idx').on(t.walletAddress),
  ]
)

export const reposts = pgTable(
  'reposts',
  {
    id: serial('id').primaryKey(),
    entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
    walletAddress: varchar('wallet_address', { length: 42 }).notNull().references(() => wallets.address),
    txHash: varchar('tx_hash', { length: 66 }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('reposts_entry_wallet_idx').on(t.entryId, t.walletAddress),
    index('reposts_wallet_idx').on(t.walletAddress),
  ]
)

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: serial('id').primaryKey(),
    entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
    walletAddress: varchar('wallet_address', { length: 42 }).notNull().references(() => wallets.address),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('bookmarks_entry_wallet_idx').on(t.entryId, t.walletAddress),
    index('bookmarks_wallet_idx').on(t.walletAddress),
    index('bookmarks_entry_idx').on(t.entryId),
  ]
)

export const follows = pgTable(
  'follows',
  {
    id: serial('id').primaryKey(),
    followerAddress: varchar('follower_address', { length: 42 }).notNull().references(() => wallets.address),
    followedAddress: varchar('followed_address', { length: 42 }).notNull().references(() => wallets.address),
    txHash: varchar('tx_hash', { length: 66 }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('follows_pair_idx').on(t.followerAddress, t.followedAddress),
    index('follows_follower_idx').on(t.followerAddress),
    index('follows_followed_idx').on(t.followedAddress),
  ]
)

// =========================================================
// Discovery Tables
// =========================================================

export const hashtags = pgTable(
  'hashtags',
  {
    id: serial('id').primaryKey(),
    tag: varchar('tag', { length: 100 }).notNull().unique(),
    postCount: integer('post_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at').notNull().defaultNow(),
  },
  (t) => [
    index('hashtags_count_idx').on(t.postCount),
    index('hashtags_tag_idx').on(t.tag),
  ]
)

export const entryHashtags = pgTable(
  'entry_hashtags',
  {
    entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
    hashtagId: integer('hashtag_id').notNull().references(() => hashtags.id),
  },
  (t) => [
    uniqueIndex('entry_hashtags_pair_idx').on(t.entryId, t.hashtagId),
    index('entry_hashtags_hashtag_idx').on(t.hashtagId),
  ]
)

export const mentions = pgTable(
  'mentions',
  {
    id: serial('id').primaryKey(),
    entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
    mentionedAddress: varchar('mentioned_address', { length: 42 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('mentions_entry_idx').on(t.entryId),
    index('mentions_address_idx').on(t.mentionedAddress),
  ]
)

// =========================================================
// Notifications
// =========================================================

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    recipientAddress: varchar('recipient_address', { length: 42 }).notNull().references(() => wallets.address),
    type: notificationTypeEnum('type').notNull(),
    actorAddress: varchar('actor_address', { length: 42 }).references(() => wallets.address),
    targetEntryId: integer('target_entry_id').references(() => entries.id),
    targetWalletAddress: varchar('target_wallet_address', { length: 42 }),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('notifications_recipient_idx').on(t.recipientAddress),
    index('notifications_read_idx').on(t.read),
    index('notifications_created_idx').on(t.createdAt),
  ]
)

// =========================================================
// Moderation Tables
// =========================================================

export const reports = pgTable(
  'reports',
  {
    id: serial('id').primaryKey(),
    chainReportId: bigint('chain_report_id', { mode: 'number' }),
    reporterAddress: varchar('reporter_address', { length: 42 }).notNull().references(() => wallets.address),
    targetEntryId: integer('target_entry_id').references(() => entries.id),
    targetChainEntryId: bigint('target_chain_entry_id', { mode: 'number' }),
    targetWalletAddress: varchar('target_wallet_address', { length: 42 }),
    category: reportCategoryEnum('category').notNull(),
    status: reportStatusEnum('status').notNull().default('PENDING'),
    notes: text('notes'), // Internal moderator notes (never exposed to public)
    txHash: varchar('tx_hash', { length: 66 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at'),
    resolvedByAddress: varchar('resolved_by_address', { length: 42 }),
  },
  (t) => [
    uniqueIndex('reports_chain_report_unique_idx').on(t.chainReportId),
    index('reports_status_idx').on(t.status),
    index('reports_reporter_idx').on(t.reporterAddress),
    index('reports_target_entry_idx').on(t.targetEntryId),
  ]
)

export const moderationLogs = pgTable(
  'moderation_logs',
  {
    id: serial('id').primaryKey(),
    actorAddress: varchar('actor_address', { length: 42 }).notNull().references(() => wallets.address),
    action: moderationActionEnum('action').notNull(),
    targetEntryId: integer('target_entry_id').references(() => entries.id),
    targetWalletAddress: varchar('target_wallet_address', { length: 42 }),
    reason: text('reason'),
    txHash: varchar('tx_hash', { length: 66 }),
    chainAuditId: bigint('chain_audit_id', { mode: 'number' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('moderation_logs_chain_audit_unique_idx').on(t.chainAuditId),
    index('moderation_logs_actor_idx').on(t.actorAddress),
    index('moderation_logs_action_idx').on(t.action),
    index('moderation_logs_created_idx').on(t.createdAt),
  ]
)

// =========================================================
// Reputation & Badges
// =========================================================

export const badges = pgTable(
  'badges',
  {
    id: serial('id').primaryKey(),
    walletAddress: varchar('wallet_address', { length: 42 }).notNull().references(() => wallets.address),
    type: badgeTypeEnum('type').notNull(),
    earnedAt: timestamp('earned_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('badges_wallet_type_idx').on(t.walletAddress, t.type),
    index('badges_wallet_idx').on(t.walletAddress),
  ]
)

// =========================================================
// Infrastructure
// =========================================================

export const indexerCheckpoints = pgTable(
  'indexer_checkpoints',
  {
    id: serial('id').primaryKey(),
    chainId: integer('chain_id').notNull(),
    contractName: varchar('contract_name', { length: 50 }).notNull(),
    lastBlock: bigint('last_block', { mode: 'number' }).notNull().default(0),
    lastLogIndex: integer('last_log_index').notNull().default(0),
    lastTxHash: varchar('last_tx_hash', { length: 66 }),
    lastBlockHash: varchar('last_block_hash', { length: 66 }),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('indexer_chain_contract_idx').on(t.chainId, t.contractName),
  ]
)

export const indexedEvents = pgTable(
  'indexed_events',
  {
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
  },
  (t) => [
    uniqueIndex('indexed_events_tx_log_unique_idx').on(t.chainId, t.transactionHash, t.logIndex),
    index('indexed_events_block_idx').on(t.chainId, t.contractName, t.blockNumber),
  ],
)

export const indexedBlocks = pgTable(
  'indexed_blocks',
  {
    chainId: integer('chain_id').notNull(),
    contractName: varchar('contract_name', { length: 50 }).notNull(),
    blockNumber: bigint('block_number', { mode: 'number' }).notNull(),
    blockHash: varchar('block_hash', { length: 66 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.chainId, t.contractName, t.blockNumber] }),
    index('indexed_blocks_recent_idx').on(t.chainId, t.contractName, t.blockNumber),
  ],
)

export const appConfig = pgTable('app_config', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedByAddress: varchar('updated_by_address', { length: 42 }),
})

// =========================================================
// Rate limiting (app layer)
// =========================================================

export const apiRateLimits = pgTable('api_rate_limits', {
  key: varchar('key', { length: 255 }).primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: timestamp('window_start').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('api_rate_limits_updated_idx').on(t.updatedAt),
])

// =========================================================
// Notification Preferences (app layer)
// =========================================================

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: serial('id').primaryKey(),
    walletAddress: varchar('wallet_address', { length: 42 }).notNull().references(() => wallets.address),
    type: notificationTypeEnum('type').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('notification_preferences_wallet_type_idx').on(t.walletAddress, t.type),
  ]
)

// =========================================================
// Relations
// =========================================================

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [wallets.address],
    references: [profiles.walletAddress],
  }),
  entries: many(entries),
  reactions: many(reactions),
  reposts: many(reposts),
  bookmarks: many(bookmarks),
  following: many(follows, { relationName: 'follower' }),
  followers: many(follows, { relationName: 'followed' }),
  notifications: many(notifications),
}))

export const entriesRelations = relations(entries, ({ one, many }) => ({
  author: one(wallets, {
    fields: [entries.authorAddress],
    references: [wallets.address],
  }),
  content: one(entryContent, {
    fields: [entries.id],
    references: [entryContent.entryId],
  }),
  parent: one(entries, {
    fields: [entries.parentId],
    references: [entries.id],
    relationName: 'parent',
  }),
  reference: one(entries, {
    fields: [entries.referenceId],
    references: [entries.id],
    relationName: 'reference',
  }),
  media: many(media),
  reactions: many(reactions),
  reposts: many(reposts),
  bookmarks: many(bookmarks),
  entryHashtags: many(entryHashtags),
  mentions: many(mentions),
}))
