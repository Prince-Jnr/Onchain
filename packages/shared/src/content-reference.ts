import { keccak256, toBytes } from 'viem'

export type EntryContentDocument = {
  version: 1
  text: string
  hashtags: string[]
  mentions: string[]
  mediaUrls: string[]
}

export function extractHashtags(text: string): string[] {
  return [...new Set((text.match(/#([a-zA-Z0-9_]+)/g) ?? []).map((tag) => tag.slice(1).toLowerCase()))]
}

export function extractMentions(text: string): string[] {
  return [...new Set((text.match(/@(0x[a-fA-F0-9]{40})\b/g) ?? []).map((mention) => mention.slice(1).toLowerCase()))]
}

export function createEntryContentDocument(text: string, mediaUrls: string[] = []): EntryContentDocument {
  const normalizedText = text.trim()
  return {
    version: 1,
    text: normalizedText,
    hashtags: extractHashtags(normalizedText),
    mentions: extractMentions(normalizedText),
    mediaUrls,
  }
}

export function getEntryContentReference(document: EntryContentDocument): `0x${string}` {
  return keccak256(toBytes(JSON.stringify(document)))
}
