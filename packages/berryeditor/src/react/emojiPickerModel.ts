import {
  DEFAULT_TWEMOJI_BASE_URL,
  EMOJI_CATALOG,
  UNICODE_EMOJI_VERSION,
  type EmojiCatalogEntry
} from './emojiCatalog'
import type { EmojiGender, EmojiTone } from './types'

export interface EmojiPickerVariant {
  unicode: string
  name: string
  keywords: readonly string[]
  group: string
  subgroup: string
  codepoints: string
  twemojiUrl: string
  tone: EmojiTone
  gender: EmojiGender
}

export interface EmojiPickerEntry {
  id: string
  group: string
  subgroup: string
  label: string
  keywords: readonly string[]
  variants: readonly EmojiPickerVariant[]
  defaultVariant: EmojiPickerVariant
}

export interface EmojiPickerGroup {
  id: string
  label: string
  entries: readonly EmojiPickerEntry[]
}

export interface EmojiSearchOptions {
  query: string
  activeGroupId?: string | null
  maxResults: number
  recents?: readonly string[]
}

export interface EmojiPickerDataset {
  unicodeVersion: typeof UNICODE_EMOJI_VERSION
  groups: readonly EmojiPickerGroup[]
  allEntries: readonly EmojiPickerEntry[]
  variantByUnicode: ReadonlyMap<string, EmojiPickerVariant>
  entryByVariantUnicode: ReadonlyMap<string, EmojiPickerEntry>
  resolveSearch(options: EmojiSearchOptions): EmojiPickerEntry[]
}

const SKIN_TONE_ORDER: ReadonlyArray<EmojiTone> = [
  'default',
  'light',
  'medium-light',
  'medium',
  'medium-dark',
  'dark'
]
const TONE_RANK = new Map(SKIN_TONE_ORDER.map((tone, index) => [tone, index]))
const GENDER_PRIORITY = new Map<EmojiGender, number>([
  ['person', 0],
  ['auto', 1],
  ['woman', 2],
  ['man', 3]
])
const RECENTS_SCORE_BOOST = 100

const datasetCache = new Map<string, EmojiPickerDataset>()

function normalizeWordList(values: readonly string[]): string[] {
  const unique = new Set<string>()
  for (const value of values) {
    const normalized = value.trim().toLowerCase()
    if (!normalized) continue
    unique.add(normalized)
  }
  return Array.from(unique)
}

function normalizeVariantKey(entry: EmojiCatalogEntry): string {
  const normalizedName = entry.name
    .toLowerCase()
    .replace(/,\s*(light|medium-light|medium|medium-dark|dark) skin tone/g, '')
    .replace(/:\s*(light|medium-light|medium|medium-dark|dark) skin tone/g, '')
    .replace(/\b(woman|man|person)\b/g, 'person')
    .replace(/\s+/g, ' ')
    .trim()
  return `${entry.subgroup}::${normalizedName}`
}

function resolveRawVariantKey(entry: EmojiCatalogEntry): string {
  const fromCatalog = entry.variantKey.trim().toLowerCase()
  if (fromCatalog) return fromCatalog
  return normalizeVariantKey(entry)
}

function canonicalizeVariantKey(rawKey: string, existingKeys: ReadonlySet<string>): string {
  const separatorIndex = rawKey.indexOf('::')
  if (separatorIndex < 0) return rawKey

  const prefix = rawKey.slice(0, separatorIndex)
  const name = rawKey.slice(separatorIndex + 2)
  const candidates: string[] = []

  if (name.startsWith('person ')) {
    candidates.push(`${prefix}::${name.slice('person '.length)}`)
  }
  if (name.startsWith('woman ')) {
    candidates.push(`${prefix}::${name.slice('woman '.length)}`)
  }
  if (name.startsWith('man ')) {
    candidates.push(`${prefix}::${name.slice('man '.length)}`)
  }

  for (const candidate of candidates) {
    if (existingKeys.has(candidate)) return candidate
  }

  return rawKey
}

function resolveTwemojiUrl(codepoints: string, baseUrl: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  return `${normalizedBase}/${codepoints}.svg`
}

function toVariant(entry: EmojiCatalogEntry, twemojiBaseUrl: string): EmojiPickerVariant {
  return {
    unicode: entry.unicode,
    name: entry.name,
    keywords: entry.keywords,
    group: entry.group,
    subgroup: entry.subgroup,
    codepoints: entry.codepoints,
    twemojiUrl: resolveTwemojiUrl(entry.codepoints, twemojiBaseUrl),
    tone: entry.tone,
    gender: entry.gender
  }
}

function pickDefaultVariant(variants: EmojiPickerVariant[]): EmojiPickerVariant {
  const sorted = [...variants].sort((a, b) => {
    const toneCompare = (TONE_RANK.get(a.tone) ?? 999) - (TONE_RANK.get(b.tone) ?? 999)
    if (toneCompare !== 0) return toneCompare
    const genderCompare = (GENDER_PRIORITY.get(a.gender) ?? 999) - (GENDER_PRIORITY.get(b.gender) ?? 999)
    if (genderCompare !== 0) return genderCompare
    return a.name.localeCompare(b.name)
  })
  if (!sorted.length) {
    throw new Error('Cannot pick default emoji variant from an empty list.')
  }
  return sorted[0]!
}

function pickEntryLabel(defaultVariant: EmojiPickerVariant): string {
  return defaultVariant.name
    .replace(/,\s*(light|medium-light|medium|medium-dark|dark) skin tone/gi, '')
    .replace(/:\s*(light|medium-light|medium|medium-dark|dark) skin tone/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function scoreEntry(
  entry: EmojiPickerEntry,
  tokens: readonly string[],
  recentIndexMap: ReadonlyMap<string, number>
): number | null {
  if (!tokens.length) return 1000

  const haystack = `${entry.label.toLowerCase()} ${entry.keywords.join(' ')}`
  let score = 0
  for (const token of tokens) {
    if (!haystack.includes(token)) return null
    const labelLower = entry.label.toLowerCase()
    if (labelLower === token) {
      score += 0
      continue
    }
    if (labelLower.startsWith(token)) {
      score += 10
      continue
    }
    if (entry.keywords.some((keyword) => keyword.startsWith(token))) {
      score += 20
      continue
    }
    score += 40
  }

  const recency = recentIndexMap.get(entry.defaultVariant.unicode)
  if (recency !== undefined) {
    score -= RECENTS_SCORE_BOOST - recency
  }
  return score
}

function buildRecentIndexMap(recents: readonly string[] | undefined): Map<string, number> {
  const map = new Map<string, number>()
  if (!recents?.length) return map
  recents.forEach((unicode, index) => {
    if (!map.has(unicode)) {
      map.set(unicode, index)
    }
  })
  return map
}

function resolveSearch(
  allEntries: readonly EmojiPickerEntry[],
  groups: readonly EmojiPickerGroup[],
  options: EmojiSearchOptions
): EmojiPickerEntry[] {
  const tokens = tokenizeQuery(options.query)
  const recentIndexMap = buildRecentIndexMap(options.recents)

  const source =
    tokens.length > 0
      ? allEntries
      : options.activeGroupId && options.activeGroupId !== '__recents__'
        ? (groups.find((group) => group.id === options.activeGroupId)?.entries ?? allEntries)
        : allEntries

  const scored: Array<{ entry: EmojiPickerEntry; score: number }> = []
  for (const entry of source) {
    const score = scoreEntry(entry, tokens, recentIndexMap)
    if (score === null) continue
    scored.push({ entry, score })
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return a.entry.label.localeCompare(b.entry.label)
  })

  return scored.slice(0, options.maxResults).map((item) => item.entry)
}

export function getEmojiPickerDataset(
  twemojiBaseUrl: string = DEFAULT_TWEMOJI_BASE_URL
): EmojiPickerDataset {
  const normalizedBase = twemojiBaseUrl || DEFAULT_TWEMOJI_BASE_URL
  const cached = datasetCache.get(normalizedBase)
  if (cached) return cached

  const variantGroups = new Map<string, EmojiPickerVariant[]>()
  const variantByUnicode = new Map<string, EmojiPickerVariant>()
  const variantsWithRawKeys: Array<{ rawKey: string; variant: EmojiPickerVariant }> = []
  const rawKeys = new Set<string>()

  for (const entry of EMOJI_CATALOG) {
    const variant = toVariant(entry, normalizedBase)
    const rawKey = resolveRawVariantKey(entry)
    variantsWithRawKeys.push({ rawKey, variant })
    rawKeys.add(rawKey)
    variantByUnicode.set(variant.unicode, variant)
  }

  for (const { rawKey, variant } of variantsWithRawKeys) {
    const variantKey = canonicalizeVariantKey(rawKey, rawKeys)
    const variants = variantGroups.get(variantKey)
    if (variants) {
      variants.push(variant)
    } else {
      variantGroups.set(variantKey, [variant])
    }
  }

  const entries: EmojiPickerEntry[] = []
  const entryByVariantUnicode = new Map<string, EmojiPickerEntry>()
  for (const [id, variantsRaw] of variantGroups.entries()) {
    const variants = [...variantsRaw].sort((a, b) => {
      const toneCompare = (TONE_RANK.get(a.tone) ?? 999) - (TONE_RANK.get(b.tone) ?? 999)
      if (toneCompare !== 0) return toneCompare
      const genderCompare = (GENDER_PRIORITY.get(a.gender) ?? 999) - (GENDER_PRIORITY.get(b.gender) ?? 999)
      if (genderCompare !== 0) return genderCompare
      return a.name.localeCompare(b.name)
    })
    const defaultVariant = pickDefaultVariant(variants)
    const keywords = normalizeWordList(
      variants.flatMap((variant) => [variant.name, ...variant.keywords])
    )

    const nextEntry: EmojiPickerEntry = {
      id,
      group: defaultVariant.group,
      subgroup: defaultVariant.subgroup,
      label: pickEntryLabel(defaultVariant),
      keywords,
      variants,
      defaultVariant
    }
    entries.push(nextEntry)
    for (const variant of variants) {
      entryByVariantUnicode.set(variant.unicode, nextEntry)
    }
  }

  const groupMap = new Map<string, EmojiPickerEntry[]>()
  for (const entry of entries) {
    const groupEntries = groupMap.get(entry.group)
    if (groupEntries) {
      groupEntries.push(entry)
    } else {
      groupMap.set(entry.group, [entry])
    }
  }

  const groups: EmojiPickerGroup[] = Array.from(groupMap.entries()).map(([id, groupEntries]) => ({
    id,
    label: id,
    entries: groupEntries
  }))

  const allEntries = [...entries]
  const dataset: EmojiPickerDataset = {
    unicodeVersion: UNICODE_EMOJI_VERSION,
    groups,
    allEntries,
    variantByUnicode,
    entryByVariantUnicode,
    resolveSearch: (options) => resolveSearch(allEntries, groups, options)
  }

  datasetCache.set(normalizedBase, dataset)
  return dataset
}

function pickVariantWithTone(variants: readonly EmojiPickerVariant[], tone: EmojiTone): EmojiPickerVariant | null {
  if (tone === 'default') return null
  return variants.find((variant) => variant.tone === tone) ?? null
}

function pickVariantWithGender(
  variants: readonly EmojiPickerVariant[],
  gender: EmojiGender
): EmojiPickerVariant | null {
  if (gender === 'auto') return null
  return variants.find((variant) => variant.gender === gender) ?? null
}

export function resolvePreferredVariant(
  entry: EmojiPickerEntry,
  preference: { tone: EmojiTone; gender: EmojiGender }
): EmojiPickerVariant {
  const { tone, gender } = preference

  if (tone !== 'default' && gender !== 'auto') {
    const exact = entry.variants.find((variant) => variant.tone === tone && variant.gender === gender)
    if (exact) return exact
  }

  const toneOnly = pickVariantWithTone(entry.variants, tone)
  if (toneOnly) return toneOnly

  const genderOnly = pickVariantWithGender(entry.variants, gender)
  if (genderOnly) return genderOnly

  return entry.defaultVariant
}
