import { UNICODE_EMOJI_VERSION } from './emojiCatalog'

export const DEFAULT_EMOJI_RECENT_LIMIT = 36
const STORAGE_PREFIX = 'berryeditor:emoji-picker'

/**
 * Returns the versioned storage key prefix used by emoji-picker persistence.
 */
export function getEmojiPickerStorageKeyBase(): string {
  return `${STORAGE_PREFIX}:v${UNICODE_EMOJI_VERSION}`
}

/**
 * Storage key for preferred skin tone.
 */
export function getEmojiPickerToneStorageKey(): string {
  return `${getEmojiPickerStorageKeyBase()}:tone`
}

/**
 * Storage key for preferred gender variant.
 */
export function getEmojiPickerGenderStorageKey(): string {
  return `${getEmojiPickerStorageKeyBase()}:gender`
}

/**
 * Storage key for recent emoji history.
 */
export function getEmojiPickerRecentsStorageKey(): string {
  return `${getEmojiPickerStorageKeyBase()}:recents`
}

function readRecents(storageKey: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeRecents(storageKey: string, recents: readonly string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(recents))
  } catch {
    // Ignore storage write failures.
  }
}

/**
 * Moves an emoji to the front of recents and enforces the configured limit.
 */
export function mergeEmojiRecents(
  currentRecents: readonly string[],
  unicode: string,
  recentLimit: number
): string[] {
  const normalizedUnicode = unicode.trim()
  if (!normalizedUnicode) return [...currentRecents].slice(0, recentLimit)
  return [normalizedUnicode, ...currentRecents.filter((item) => item !== normalizedUnicode)].slice(
    0,
    recentLimit
  )
}

/**
 * Appends an emoji to local recents storage and returns the updated list.
 */
export function appendEmojiRecentToStorage(
  unicode: string,
  options: { recentLimit?: number; storageKey?: string } = {}
): string[] {
  const recentLimit = Math.max(1, options.recentLimit ?? DEFAULT_EMOJI_RECENT_LIMIT)
  const storageKey = options.storageKey ?? getEmojiPickerRecentsStorageKey()
  const currentRecents = readRecents(storageKey)
  const nextRecents = mergeEmojiRecents(currentRecents, unicode, recentLimit)
  writeRecents(storageKey, nextRecents)
  return nextRecents
}
