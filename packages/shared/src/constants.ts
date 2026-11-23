import type { Address } from 'viem'

// =========================================================
// Network Configuration
// =========================================================

export const CHAIN_IDS = {
  ANVIL: 31337,
  BASE_SEPOLIA: 84532,
  BASE: 8453,
} as const

export const SUPPORTED_CHAIN_IDS = [CHAIN_IDS.BASE_SEPOLIA, CHAIN_IDS.BASE] as const

export const CHAIN_NAMES: Record<number, string> = {
  [CHAIN_IDS.ANVIL]: 'Local Anvil',
  [CHAIN_IDS.BASE_SEPOLIA]: 'Base Sepolia',
  [CHAIN_IDS.BASE]: 'Base',
}

export const BLOCK_EXPLORER_URLS: Record<number, string> = {
  [CHAIN_IDS.ANVIL]: 'http://localhost:8545',
  [CHAIN_IDS.BASE_SEPOLIA]: 'https://sepolia.basescan.org',
  [CHAIN_IDS.BASE]: 'https://basescan.org',
}

// =========================================================
// Contract Addresses (populated after deployment)
// =========================================================

export const CONTRACT_ADDRESSES: Record<
  number,
  {
    entries: Address
    social: Address
    profiles: Address
    moderation: Address
  }
> = {
  [CHAIN_IDS.ANVIL]: {
    entries: '0x0000000000000000000000000000000000000000',
    social: '0x0000000000000000000000000000000000000000',
    profiles: '0x0000000000000000000000000000000000000000',
    moderation: '0x0000000000000000000000000000000000000000',
  },
  [CHAIN_IDS.BASE_SEPOLIA]: {
    entries: (process.env.NEXT_PUBLIC_ENTRIES_ADDRESS_SEPOLIA ?? '0x0000000000000000000000000000000000000000') as Address,
    social: (process.env.NEXT_PUBLIC_SOCIAL_ADDRESS_SEPOLIA ?? '0x0000000000000000000000000000000000000000') as Address,
    profiles: (process.env.NEXT_PUBLIC_PROFILES_ADDRESS_SEPOLIA ?? '0x0000000000000000000000000000000000000000') as Address,
    moderation: (process.env.NEXT_PUBLIC_MODERATION_ADDRESS_SEPOLIA ?? '0x0000000000000000000000000000000000000000') as Address,
  },
}

// =========================================================
// Application Constants
// =========================================================

export const APP_NAME = 'ONCHAIN'
export const APP_TAGLINE = 'Leave something behind.'
export const APP_DESCRIPTION =
  'A decentralized social guestbook built around blockchain identity, public expression, and community interactions.'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const MAX_POST_LENGTH = 500
export const MAX_BIO_LENGTH = 160
export const MAX_DISPLAY_NAME_LENGTH = 50
export const MAX_HASHTAGS_PER_POST = 10
export const MAX_MENTIONS_PER_POST = 10
export const MAX_MEDIA_PER_POST = 4
export const MAX_MEDIA_SIZE_MB = 10

export const FEED_PAGE_SIZE = 20
export const NOTIFICATIONS_PAGE_SIZE = 30
export const SEARCH_PAGE_SIZE = 20
export const PROFILE_FEED_PAGE_SIZE = 20

export const REACTION_LABELS: Record<number, string> = {
  0: 'Like',
  1: 'Love',
  2: 'Laugh',
  3: 'Wow',
  4: 'Sad',
  5: 'Angry',
}

export const REACTION_EMOJIS: Record<number, string> = {
  0: '👍',
  1: '❤️',
  2: '😂',
  3: '😮',
  4: '😢',
  5: '😡',
}

export const REPORT_CATEGORY_LABELS: Record<number, string> = {
  0: 'Spam',
  1: 'Harassment',
  2: 'Hate Speech',
  3: 'Misinformation',
  4: 'Illegal Content',
  5: 'Violent Content',
  6: 'Adult Content',
  7: 'Other',
}

export const MODERATION_MODE_LABELS: Record<number, string> = {
  0: 'Open',
  1: 'Trusted',
  2: 'Strict',
  3: 'Event',
}

export const SIWE_EXPIRY_SECONDS = 600 // 10 minutes
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60 // 7 days
