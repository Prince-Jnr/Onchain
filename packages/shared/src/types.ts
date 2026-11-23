import type { Address } from 'viem'

// =========================================================
// Contract Enums (mirror of Solidity enums)
// =========================================================

export enum EntryType {
  POST = 0,
  COMMENT = 1,
  QUOTE = 2,
}

export enum EntryStatus {
  ACTIVE = 0,
  DELETED = 1,
  HIDDEN = 2,
  PENDING = 3,
  REJECTED = 4,
}

export enum ReactionType {
  LIKE = 0,
  LOVE = 1,
  LAUGH = 2,
  WOW = 3,
  SAD = 4,
  ANGRY = 5,
}

export enum ModerationMode {
  OPEN = 0,
  TRUSTED = 1,
  STRICT = 2,
  EVENT = 3,
}

export enum ModerationAction {
  APPROVE = 0,
  REJECT = 1,
  HIDE = 2,
  RESTORE = 3,
  PIN = 4,
  UNPIN = 5,
  DELETE = 6,
}

export enum UserRestriction {
  NONE = 0,
  RESTRICTED = 1,
  BANNED = 2,
}

export enum ReportCategory {
  SPAM = 0,
  HARASSMENT = 1,
  HATE_SPEECH = 2,
  MISINFORMATION = 3,
  ILLEGAL_CONTENT = 4,
  VIOLENT_CONTENT = 5,
  ADULT_CONTENT = 6,
  OTHER = 7,
}

export enum ReportStatus {
  PENDING = 0,
  REVIEWING = 1,
  RESOLVED = 2,
  DISMISSED = 3,
}

// =========================================================
// Application Types
// =========================================================

export interface Profile {
  wallet: Address
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  website: string | null
  twitterHandle: string | null
  githubHandle: string | null
  metadataRef: string | null
  registeredAt: Date | null
  updatedAt: Date | null
  isActive: boolean
  followerCount: number
  followingCount: number
  postCount: number
  badges: Badge[]
}

export interface Entry {
  id: number
  txHash: string | null
  author: Address
  authorProfile: Profile | null
  entryType: EntryType
  parentId: number | null
  referenceId: number | null
  contentRef: string
  content: EntryContent | null
  createdAt: Date
  status: EntryStatus
  pinned: boolean
  reactionCounts: Record<ReactionType, number>
  totalReactions: number
  commentCount: number
  repostCount: number
  // Viewer context
  viewerReaction: ReactionType | null
  viewerHasReposted: boolean
  viewerHasBookmarked: boolean
  // Relations
  parentEntry: Entry | null
  referencedEntry: Entry | null
  media: Media[]
}

export interface EntryContent {
  text: string
  hashtags: string[]
  mentions: Address[]
  linkPreviews: LinkPreview[]
}

export interface Media {
  id: string
  url: string
  type: 'image' | 'video'
  width?: number
  height?: number
  altText?: string
}

export interface LinkPreview {
  url: string
  title?: string
  description?: string
  imageUrl?: string
  siteName?: string
}

export interface Notification {
  id: string
  type: NotificationType
  actor: Profile | null
  targetEntry: Entry | null
  targetProfile: Profile | null
  read: boolean
  createdAt: Date
}

export enum NotificationType {
  REPLY = 'REPLY',
  COMMENT = 'COMMENT',
  MENTION = 'MENTION',
  REPOST = 'REPOST',
  QUOTE = 'QUOTE',
  REACTION = 'REACTION',
  FOLLOW = 'FOLLOW',
  MODERATION = 'MODERATION',
  ADMIN_ANNOUNCEMENT = 'ADMIN_ANNOUNCEMENT',
}

export interface Badge {
  id: string
  type: BadgeType
  label: string
  description: string
  earnedAt: Date
}

export enum BadgeType {
  EARLY_CONTRIBUTOR = 'EARLY_CONTRIBUTOR',
  FOUNDING_MEMBER = 'FOUNDING_MEMBER',
  ACTIVE_PARTICIPANT = 'ACTIVE_PARTICIPANT',
  TRUSTED_CONTRIBUTOR = 'TRUSTED_CONTRIBUTOR',
  VERIFIED_MODERATOR = 'VERIFIED_MODERATOR',
  CREATOR = 'CREATOR',
  COMMUNITY_MEMBER = 'COMMUNITY_MEMBER',
}

export interface ModerationAuditLog {
  id: string
  actor: Address
  action: ModerationAction
  targetEntryId: number | null
  targetWallet: Address | null
  reason: string | null
  txHash: string | null
  createdAt: Date
}

export interface Report {
  id: number
  reporter: Address
  targetEntryId: number | null
  targetWallet: Address | null
  category: ReportCategory
  status: ReportStatus
  createdAt: Date
  resolvedAt: Date | null
  resolvedBy: Address | null
}

// =========================================================
// Transaction States
// =========================================================

export type TxState =
  | { status: 'idle' }
  | { status: 'preparing' }
  | { status: 'awaiting_wallet' }
  | { status: 'rejected'; message: string }
  | { status: 'submitted'; hash: string }
  | { status: 'pending'; hash: string }
  | { status: 'confirmed'; hash: string; blockNumber: bigint }
  | { status: 'failed'; hash?: string; message: string }
  | { status: 'expired' }

// =========================================================
// Feed Types
// =========================================================

export type FeedType = 'latest' | 'following' | 'popular' | 'trending' | 'featured'

export interface FeedPage {
  entries: Entry[]
  nextCursor: string | null
  total: number
}

// =========================================================
// Search Types
// =========================================================

export interface SearchResults {
  entries: Entry[]
  profiles: Profile[]
  hashtags: HashtagResult[]
  total: number
}

export interface HashtagResult {
  tag: string
  count: number
}

// =========================================================
// Admin Types
// =========================================================

export interface AdminStats {
  totalUsers: number
  activeUsers24h: number
  totalPosts: number
  totalComments: number
  totalReactions: number
  totalReposts: number
  pendingModeration: number
  openReports: number
  indexerStatus: 'healthy' | 'degraded' | 'down'
  lastIndexedBlock: number
}
