import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TWEMOJI_BASE_URL,
  EMOJI_CATALOG,
  TWEMOJI_VERSION,
  UNICODE_EMOJI_VERSION,
  UNICODE_FULLY_QUALIFIED_COUNT
} from '../src/react/emojiCatalog'

describe('emoji catalog', () => {
  it('matches Unicode 17 fully-qualified count', () => {
    expect(UNICODE_EMOJI_VERSION).toBe('17.0')
    expect(UNICODE_FULLY_QUALIFIED_COUNT).toBe(3944)
    expect(EMOJI_CATALOG).toHaveLength(UNICODE_FULLY_QUALIFIED_COUNT)
  })

  it('contains known Unicode 17 entries', () => {
    const keycapHash = EMOJI_CATALOG.find((entry) => entry.unicode === '#️⃣')
    const faceWithBags = EMOJI_CATALOG.find(
      (entry) => entry.name.toLowerCase() === 'face with bags under eyes'
    )

    expect(keycapHash).toBeTruthy()
    expect(faceWithBags).toBeTruthy()
  })

  it('provides non-empty Twemoji URLs for all entries', () => {
    expect(TWEMOJI_VERSION).toBe('17.0.2')
    expect(DEFAULT_TWEMOJI_BASE_URL).toContain('@v17.0.2')
    expect(EMOJI_CATALOG.every((entry) => entry.twemojiUrl.length > 0)).toBe(true)
  })
})

