import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export { shortenAddress, formatRelativeTime, formatFullDate, formatCount, parseHashtags, parseMentions, ipfsToHttp, getTxUrl, getAddressUrl, parseContractError } from '@onchain/shared'
