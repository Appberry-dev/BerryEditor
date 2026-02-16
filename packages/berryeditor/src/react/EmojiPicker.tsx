import * as Popover from '@radix-ui/react-popover'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import {
  DEFAULT_TWEMOJI_BASE_URL
} from './emojiCatalog'
import {
  getEmojiPickerDataset,
  resolvePreferredVariant,
  type EmojiPickerEntry,
  type EmojiPickerVariant
} from './emojiPickerModel'
import {
  DEFAULT_EMOJI_RECENT_LIMIT,
  getEmojiPickerGenderStorageKey,
  getEmojiPickerRecentsStorageKey,
  getEmojiPickerToneStorageKey,
  mergeEmojiRecents
} from './emojiPickerRecents'
import type { EmojiGender, EmojiInsertPayload, EmojiPickerOptions, EmojiTone } from './types'

const RECENTS_TAB_ID = '__recents__'
const ALL_TAB_ID = '__all__'
const DEFAULT_SEARCH_MAX_RESULTS = 300
const SKIN_TONE_OPTIONS: ReadonlyArray<{ value: EmojiTone; label: string; swatch: string }> = [
  {
    value: 'default',
    label: 'Default',
    swatch: 'linear-gradient(145deg, #f8d7bc 0%, #d49a6a 48%, #8a5a3a 100%)'
  },
  { value: 'light', label: 'Light', swatch: '#f8d7bc' },
  { value: 'medium-light', label: 'Medium-light', swatch: '#edc39a' },
  { value: 'medium', label: 'Medium', swatch: '#d49a6a' },
  { value: 'medium-dark', label: 'Medium-dark', swatch: '#a16b43' },
  { value: 'dark', label: 'Dark', swatch: '#6e4428' }
]
const GENDER_OPTIONS: ReadonlyArray<{
  value: Exclude<EmojiGender, 'auto'>
  label: string
  emoji: string
}> = [
  { value: 'person', label: 'Neutral person', emoji: '🧑' },
  { value: 'woman', label: 'Woman', emoji: '👩' },
  { value: 'man', label: 'Man', emoji: '👨' }
]
const SUPPORTED_GENDERS: ReadonlyArray<EmojiGender> = ['auto', 'person', 'woman', 'man']
const SKIN_TONE_MODIFIER_BY_TONE: Record<EmojiTone, string> = {
  default: '',
  light: '\u{1F3FB}',
  'medium-light': '\u{1F3FC}',
  medium: '\u{1F3FD}',
  'medium-dark': '\u{1F3FE}',
  dark: '\u{1F3FF}'
}

interface EmojiPickerProps {
  disabled: boolean
  options?: EmojiPickerOptions
  onInsert: (payload: EmojiInsertPayload) => void
  onClose: () => void
}

type RenderItem = {
  key: string
  entry: EmojiPickerEntry
  variant: EmojiPickerVariant
}

function buildRecentUnicodeAliasMap(
  variants: ReadonlyMap<string, EmojiPickerVariant>
): Map<string, string> {
  const aliasMap = new Map<string, string>()
  for (const unicode of variants.keys()) {
    if (!aliasMap.has(unicode)) aliasMap.set(unicode, unicode)

    const withoutEmojiPresentation = unicode.replaceAll('\uFE0F', '')
    if (!aliasMap.has(withoutEmojiPresentation)) {
      aliasMap.set(withoutEmojiPresentation, unicode)
    }

    const withoutTextPresentation = unicode.replaceAll('\uFE0E', '')
    if (!aliasMap.has(withoutTextPresentation)) {
      aliasMap.set(withoutTextPresentation, unicode)
    }
  }
  return aliasMap
}

function hasToneVariants(entry: EmojiPickerEntry): boolean {
  const toneValues = new Set(entry.variants.map((variant) => variant.tone))
  return toneValues.size > 1
}

function hasGenderVariants(entry: EmojiPickerEntry): boolean {
  const genderValues = new Set(
    entry.variants
      .map((variant) => variant.gender)
      .filter((gender): gender is Exclude<EmojiGender, 'auto'> => gender !== 'auto')
  )
  return genderValues.size > 1
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJSON<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage write failures.
  }
}

function isSupportedTone(value: unknown): value is EmojiTone {
  return SKIN_TONE_OPTIONS.some((option) => option.value === value)
}

function normalizePersistedGender(value: EmojiGender | null): EmojiGender {
  if (!value || !SUPPORTED_GENDERS.includes(value)) return 'person'
  return value === 'auto' ? 'person' : value
}

function withSkinTone(emoji: string, tone: EmojiTone): string {
  const modifier = SKIN_TONE_MODIFIER_BY_TONE[tone]
  if (!modifier) return emoji
  return `${emoji}${modifier}`
}

/**
 * Full emoji picker with search, recents, and skin-tone/gender preferences.
 */
export function EmojiPicker({
  disabled,
  options,
  onInsert,
  onClose
}: EmojiPickerProps): ReactElement {
  const insertMode = options?.insertMode ?? 'twemojiImage'
  const twemojiBaseUrl = options?.twemojiBaseUrl ?? DEFAULT_TWEMOJI_BASE_URL
  const useTwemoji = options?.useTwemoji !== false
  const searchMaxResults = Math.max(20, options?.searchMaxResults ?? DEFAULT_SEARCH_MAX_RESULTS)
  const recentLimit = Math.max(1, options?.recentLimit ?? DEFAULT_EMOJI_RECENT_LIMIT)
  const persistPreferences = options?.persistPreferences !== false
  const persistRecents = options?.persistRecents !== false
  const showCategories = options?.showCategories !== false
  const toneStorageKey = getEmojiPickerToneStorageKey()
  const genderStorageKey = getEmojiPickerGenderStorageKey()
  const recentsStorageKey = getEmojiPickerRecentsStorageKey()

  const dataset = useMemo(() => getEmojiPickerDataset(twemojiBaseUrl), [twemojiBaseUrl])
  const recentUnicodeAliasMap = useMemo(
    () => buildRecentUnicodeAliasMap(dataset.variantByUnicode),
    [dataset.variantByUnicode]
  )
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState(() => {
    if (!showCategories) return ALL_TAB_ID
    if (persistRecents) return RECENTS_TAB_ID
    return dataset.groups[0]?.id ?? ALL_TAB_ID
  })
  const [tone, setTone] = useState<EmojiTone>(() => {
    if (!persistPreferences) return 'default'
    const persistedTone = readJSON<EmojiTone | null>(toneStorageKey, null)
    return isSupportedTone(persistedTone) ? persistedTone : 'default'
  })
  const [gender, setGender] = useState<EmojiGender>(() => {
    if (!persistPreferences) return 'person'
    const persistedGender = readJSON<EmojiGender | null>(genderStorageKey, null)
    return normalizePersistedGender(persistedGender)
  })
  const [recents, setRecents] = useState<string[]>([])
  const [hasLoadedInitialRecents, setHasLoadedInitialRecents] = useState(false)
  const recentsRef = useRef<string[]>([])
  const hasAutoSwitchedFromEmptyRecents = useRef(false)
  const [openVariantKey, setOpenVariantKey] = useState<string | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (!persistRecents) {
      setHasLoadedInitialRecents(true)
      return
    }
    const persisted = readJSON<string[]>(recentsStorageKey, [])
    const nextRecents: string[] = []
    const seen = new Set<string>()
    for (const value of persisted) {
      const normalized = value.trim()
      if (!normalized) continue
      const resolved = recentUnicodeAliasMap.get(normalized)
      if (!resolved || seen.has(resolved)) continue
      seen.add(resolved)
      nextRecents.push(resolved)
      if (nextRecents.length >= recentLimit) break
    }
    setRecents(nextRecents)
    setHasLoadedInitialRecents(true)
  }, [persistRecents, recentLimit, recentUnicodeAliasMap, recentsStorageKey])

  useEffect(() => {
    recentsRef.current = recents
  }, [recents])

  useEffect(() => {
    if (!showCategories) {
      if (activeTab !== ALL_TAB_ID) {
        setActiveTab(ALL_TAB_ID)
      }
      return
    }

    if (!persistRecents) {
      if (activeTab !== RECENTS_TAB_ID && activeTab !== ALL_TAB_ID) return
      const firstGroupId = dataset.groups[0]?.id
      if (!firstGroupId || activeTab === firstGroupId) return
      setActiveTab(firstGroupId)
      return
    }

    if (activeTab === ALL_TAB_ID) {
      setActiveTab(RECENTS_TAB_ID)
    }
  }, [activeTab, dataset.groups, persistRecents, showCategories])

  useEffect(() => {
    if (!showCategories) return
    if (!persistRecents) return
    if (hasAutoSwitchedFromEmptyRecents.current) return
    if (!hasLoadedInitialRecents) return
    if (activeTab !== RECENTS_TAB_ID) {
      hasAutoSwitchedFromEmptyRecents.current = true
      return
    }
    if (recents.length > 0) {
      hasAutoSwitchedFromEmptyRecents.current = true
      return
    }
    const firstGroupId = dataset.groups[0]?.id
    if (!firstGroupId) return
    hasAutoSwitchedFromEmptyRecents.current = true
    setActiveTab(firstGroupId)
  }, [activeTab, dataset.groups, hasLoadedInitialRecents, persistRecents, recents.length, showCategories])

  useEffect(() => {
    if (!persistPreferences) return
    writeJSON(toneStorageKey, tone)
  }, [persistPreferences, tone, toneStorageKey])

  useEffect(() => {
    if (!persistPreferences) return
    writeJSON(genderStorageKey, gender)
  }, [gender, genderStorageKey, persistPreferences])

  useEffect(() => {
    if (!persistRecents) return
    if (!hasLoadedInitialRecents) return
    writeJSON(recentsStorageKey, recents.slice(0, recentLimit))
  }, [hasLoadedInitialRecents, persistRecents, recentLimit, recents, recentsStorageKey])

  const renderItems = useMemo(() => {
    const trimmedQuery = query.trim()
    if (trimmedQuery) {
      return dataset
        .resolveSearch({
          query: trimmedQuery,
          activeGroupId: showCategories ? activeTab : null,
          maxResults: searchMaxResults,
          recents
        })
        .map((entry) => ({
          key: `search-${entry.id}`,
          entry,
          variant: resolvePreferredVariant(entry, { tone, gender })
        }))
    }

    if (!showCategories) {
      return dataset.allEntries.map((entry) => ({
        key: `all-${entry.id}`,
        entry,
        variant: resolvePreferredVariant(entry, { tone, gender })
      }))
    }

    if (activeTab === RECENTS_TAB_ID) {
      const out: RenderItem[] = []
      const seen = new Set<string>()
      for (const unicode of recents) {
        const entry = dataset.entryByVariantUnicode.get(unicode)
        const variant = dataset.variantByUnicode.get(unicode)
        if (!entry || !variant) continue
        const dedupeKey = `${entry.id}:${variant.unicode}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)
        out.push({ key: `recent-${dedupeKey}`, entry, variant })
        if (out.length >= recentLimit) break
      }
      return out
    }

    const group = dataset.groups.find((item) => item.id === activeTab)
    return (group?.entries ?? []).map((entry) => ({
      key: `group-${entry.id}`,
      entry,
      variant: resolvePreferredVariant(entry, { tone, gender })
    }))
  }, [activeTab, dataset, gender, query, recentLimit, recents, searchMaxResults, showCategories, tone])

  const showToneSelector = useMemo(() => {
    const seen = new Set<string>()
    for (const item of renderItems) {
      if (seen.has(item.entry.id)) continue
      seen.add(item.entry.id)
      if (hasToneVariants(item.entry)) return true
    }
    return false
  }, [renderItems])

  const showGenderSelector = useMemo(() => {
    const seen = new Set<string>()
    for (const item of renderItems) {
      if (seen.has(item.entry.id)) continue
      seen.add(item.entry.id)
      if (hasGenderVariants(item.entry)) return true
    }
    return false
  }, [renderItems])

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, renderItems.length)
  }, [renderItems.length])

  const insertVariant = (
    variant: EmojiPickerVariant,
    opts: { persistFromVariant?: boolean } = {}
  ): void => {
    if (disabled) return
    onInsert({
      unicode: variant.unicode,
      twemojiUrl: variant.twemojiUrl,
      insertMode,
      label: variant.name
    })

    const nextRecents = mergeEmojiRecents(recentsRef.current, variant.unicode, recentLimit)
    recentsRef.current = nextRecents
    setRecents(nextRecents)
    if (persistRecents) writeJSON(recentsStorageKey, nextRecents)

    if (opts.persistFromVariant) {
      if (variant.tone !== 'default') setTone(variant.tone)
      if (variant.gender !== 'auto') setGender(variant.gender)
    }

    setOpenVariantKey(null)
    onClose()
  }

  const handleGridKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const activeIndex = itemRefs.current.findIndex((node) => node === document.activeElement)
    if (activeIndex < 0) return

    const rowSize = 6
    let nextIndex = -1
    if (event.key === 'ArrowRight') nextIndex = activeIndex + 1
    else if (event.key === 'ArrowLeft') nextIndex = activeIndex - 1
    else if (event.key === 'ArrowDown') nextIndex = activeIndex + rowSize
    else if (event.key === 'ArrowUp') nextIndex = activeIndex - rowSize
    else if (event.key === 'Escape') {
      setOpenVariantKey(null)
      return
    } else {
      return
    }

    if (nextIndex < 0 || nextIndex >= itemRefs.current.length) return
    event.preventDefault()
    itemRefs.current[nextIndex]?.focus()
  }

  const isSearching = query.trim().length > 0
  const renderEmojiGlyph = (variant: EmojiPickerVariant): ReactElement =>
    useTwemoji ? (
      <img src={variant.twemojiUrl} alt={variant.unicode} loading="lazy" />
    ) : (
      <span className="berry-emoji-picker__emoji-glyph" aria-hidden="true">
        {variant.unicode}
      </span>
    )

  return (
    <div className="berry-emoji-picker">
      <div className="berry-emoji-picker__header">
        <input
          type="text"
          className="berry-emoji-picker__search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search emoji"
          aria-label="Search emoji"
          disabled={disabled}
        />
        <div className="berry-emoji-picker__controls">
          {showCategories ? (
            <label className="berry-emoji-picker__category">
              <span>Category</span>
              <select
                aria-label="Emoji category"
                value={activeTab}
                disabled={disabled}
                onChange={(event) => setActiveTab(event.target.value)}
              >
                {persistRecents ? <option value={RECENTS_TAB_ID}>Recents</option> : null}
                {dataset.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {showToneSelector ? (
            <div className="berry-emoji-picker__button-group" role="group" aria-label="Skin tone">
              <span>Skin tone</span>
              <div className="berry-emoji-picker__button-row">
                {SKIN_TONE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`berry-emoji-picker__tone-button${tone === option.value ? ' is-active' : ''}`}
                    aria-label={`Skin tone: ${option.label}`}
                    title={`Skin tone: ${option.label}`}
                    aria-pressed={tone === option.value}
                    disabled={disabled}
                    onClick={() => setTone(option.value)}
                  >
                    <span
                      className="berry-emoji-picker__tone-swatch"
                      style={{ background: option.swatch }}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {showGenderSelector ? (
            <div className="berry-emoji-picker__button-group" role="group" aria-label="Gender">
              <span>Gender</span>
              <div className="berry-emoji-picker__button-row">
                {GENDER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`berry-emoji-picker__gender-button${gender === option.value ? ' is-active' : ''}`}
                    aria-label={option.label}
                    title={option.label}
                    aria-pressed={gender === option.value}
                    disabled={disabled}
                    onClick={() => setGender(option.value)}
                  >
                    <span aria-hidden="true">{withSkinTone(option.emoji, tone)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="berry-emoji-picker__grid"
        role="grid"
        aria-label="Emoji results"
        onKeyDown={handleGridKeyDown}
      >
        {renderItems.map((item, index) => {
          const hasVariants = item.entry.variants.length > 1
          return (
            <div key={item.key} className="berry-emoji-picker__tile">
              <button
                type="button"
                ref={(node) => {
                  itemRefs.current[index] = node
                }}
                className="berry-emoji-picker__emoji-button"
                disabled={disabled}
                aria-label={item.variant.name}
                title={item.variant.name}
                onClick={() => insertVariant(item.variant)}
              >
                {renderEmojiGlyph(item.variant)}
              </button>
              {hasVariants ? (
                <Popover.Root
                  open={openVariantKey === item.key}
                  onOpenChange={(open) => setOpenVariantKey(open ? item.key : null)}
                >
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      className="berry-emoji-picker__variant-trigger"
                      aria-label={`Choose variants for ${item.entry.label}`}
                      disabled={disabled}
                      onClick={(event) => event.stopPropagation()}
                    >
                      v
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="berry-emoji-picker__variant-popover"
                      side="right"
                      align="start"
                      sideOffset={8}
                    >
                      <div className="berry-emoji-picker__variant-grid">
                        {item.entry.variants.map((variant) => (
                          <button
                            key={`${item.key}-${variant.unicode}`}
                            type="button"
                            className="berry-emoji-picker__variant-button"
                            aria-label={variant.name}
                            title={variant.name}
                            onClick={() => insertVariant(variant, { persistFromVariant: true })}
                          >
                            {renderEmojiGlyph(variant)}
                          </button>
                        ))}
                      </div>
                      <Popover.Arrow className="berry-toolbar__popover-arrow" />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              ) : null}
            </div>
          )
        })}
      </div>

      {renderItems.length === 0 ? (
        <p className="berry-emoji-picker__empty">
          {isSearching ? 'No emojis matched your search.' : 'No emojis available for this section.'}
        </p>
      ) : null}
    </div>
  )
}
