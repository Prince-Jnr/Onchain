import type { Address } from 'viem'
import { BLOCK_EXPLORER_URLS } from './constants'

// =========================================================
// Address Utilities
// =========================================================

export function shortenAddress(address: Address | string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function isValidAddress(address: string): address is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

// =========================================================
// Block Explorer Links
// =========================================================

export function getTxUrl(hash: string, chainId: number): string {
  const base = BLOCK_EXPLORER_URLS[chainId] ?? 'https://basescan.org'
  return `${base}/tx/${hash}`
}

export function getAddressUrl(address: string, chainId: number): string {
  const base = BLOCK_EXPLORER_URLS[chainId] ?? 'https://basescan.org'
  return `${base}/address/${address}`
}

// =========================================================
// Content Utilities
// =========================================================

export function parseHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z][a-zA-Z0-9_]*/g) ?? []
  return [...new Set(matches.map((tag) => tag.toLowerCase().slice(1)))]
}

export function parseMentions(text: string): string[] {
  // Matches @0x... ethereum addresses
  const matches = text.match(/@0x[0-9a-fA-F]{40}/g) ?? []
  return [...new Set(matches.map((m) => m.slice(1)))]
}

export function formatPostText(text: string): string {
  // Normalize whitespace
  return text.trim().replace(/\s+/g, ' ')
}

// =========================================================
// Time Utilities
// =========================================================

export function formatRelativeTime(date: Date | string | number): string {
  const d = new Date(date)
  const now = new Date()
  const diffSeconds = Math.floor((now.getTime() - d.getTime()) / 1000)

  if (diffSeconds < 60) return `${diffSeconds}s`
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h`
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d`

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatFullDate(date: Date | string | number): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// =========================================================
// Number Formatting
// =========================================================

export function formatCount(count: number): string {
  if (count < 1000) return count.toString()
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`
  return `${(count / 1_000_000).toFixed(1)}M`
}

// =========================================================
// IPFS Utilities
// =========================================================

export function ipfsToHttp(cid: string, gateway?: string): string {
  const gw = gateway ?? 'https://gateway.pinata.cloud/ipfs'
  if (cid.startsWith('http')) return cid
  if (cid.startsWith('ipfs://')) return `${gw}/${cid.slice(7)}`
  return `${gw}/${cid}`
}

export function isValidCid(cid: string): boolean {
  // Basic CID v0 (Qm...) and v1 (bafy...) validation
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{55})/.test(cid)
}

// =========================================================
// Error Utilities
// =========================================================

export function parseContractError(error: unknown): string {
  if (!error) return 'Unknown error'

  const message = error instanceof Error ? error.message : String(error)

  // Common contract errors
  if (message.includes('EmptyContentRef')) return 'Post content cannot be empty'
  if (message.includes('ContentRefTooLong')) return 'Post content is too long'
  if (message.includes('UserRestricted')) return 'Your account is restricted'
  if (message.includes('UserBanned')) return 'Your account has been banned'
  if (message.includes('AlreadyReacted')) return 'You have already reacted to this post'
  if (message.includes('NotReacted')) return 'You have not reacted to this post'
  if (message.includes('AlreadyReposted')) return 'You have already reposted this'
  if (message.includes('NotReposted')) return 'You have not reposted this'
  if (message.includes('AlreadyFollowing')) return 'You are already following this user'
  if (message.includes('NotFollowing')) return 'You are not following this user'
  if (message.includes('CannotFollowSelf')) return 'You cannot follow yourself'
  if (message.includes('InvalidParentEntry')) return 'The post you are replying to is not available'
  if (message.includes('Pausable: paused')) return 'The contract is currently paused'
  if (message.includes('user rejected')) return 'Transaction was rejected'
  if (message.includes('insufficient funds')) return 'Insufficient funds for gas'

  // Truncate long messages
  if (message.length > 100) return message.slice(0, 100) + '...'
  return message
}
