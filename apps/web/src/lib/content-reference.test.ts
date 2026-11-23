import { describe, expect, it } from 'vitest'
import {
  createEntryContentDocument,
  extractHashtags,
  extractMentions,
  getEntryContentReference,
} from './content-reference'

describe('entry content references', () => {
  it('normalizes and deduplicates tags and wallet mentions', () => {
    expect(extractHashtags('#Base #base #ONCHAIN_dev')).toEqual(['base', 'onchain_dev'])
    expect(extractMentions('@0x0000000000000000000000000000000000000001 @0x0000000000000000000000000000000000000001'))
      .toEqual(['@0x0000000000000000000000000000000000000001'.slice(1)])
  })

  it('creates a deterministic content reference from the canonical document', () => {
    const first = createEntryContentDocument('  hello #Base  ')
    const second = createEntryContentDocument('hello #Base')
    expect(first).toEqual(second)
    expect(getEntryContentReference(first)).toMatch(/^0x[0-9a-f]{64}$/)
    expect(getEntryContentReference(first)).toBe(getEntryContentReference(second))
  })

  it('changes the reference when content changes', () => {
    expect(getEntryContentReference(createEntryContentDocument('hello')))
      .not.toBe(getEntryContentReference(createEntryContentDocument('hello!')))
  })
})
