import { DEFAULT_TWEMOJI_BASE_URL, EMOJI_CATALOG } from './emojiCatalog'

interface EmojiReplacementEntry {
  unicode: string
  twemojiUrl: string
}

interface EmojiReplacementIndex {
  byUnicode: ReadonlyMap<string, EmojiReplacementEntry>
  lengths: readonly number[]
  firstCodeUnitSet: ReadonlySet<string>
}

const replacementIndexCache = new Map<string, EmojiReplacementIndex>()

function normalizeTwemojiBaseUrl(value?: string): string {
  const base = value?.trim() || DEFAULT_TWEMOJI_BASE_URL
  return base.endsWith('/') ? base.slice(0, -1) : base
}

function escapeHTML(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function createEmojiImageHTML(entry: EmojiReplacementEntry): string {
  const safeUnicode = escapeHTML(entry.unicode)
  const safeSrc = escapeHTML(entry.twemojiUrl)
  return `<img class="berry-emoji" draggable="false" alt="${safeUnicode}" data-berry-emoji="${safeUnicode}" src="${safeSrc}" />`
}

function createEmojiImageElement(doc: Document, entry: EmojiReplacementEntry): HTMLImageElement {
  const image = doc.createElement('img')
  image.className = 'berry-emoji'
  image.setAttribute('draggable', 'false')
  image.setAttribute('alt', entry.unicode)
  image.setAttribute('data-berry-emoji', entry.unicode)
  image.setAttribute('src', entry.twemojiUrl)
  return image
}

function getReplacementIndex(twemojiBaseUrl?: string): EmojiReplacementIndex {
  const normalizedBase = normalizeTwemojiBaseUrl(twemojiBaseUrl)
  const cached = replacementIndexCache.get(normalizedBase)
  if (cached) return cached

  const byUnicode = new Map<string, EmojiReplacementEntry>()
  for (const entry of EMOJI_CATALOG) {
    const twemojiUrl = `${normalizedBase}/${entry.codepoints}.svg`
    const replacement: EmojiReplacementEntry = { unicode: entry.unicode, twemojiUrl }
    byUnicode.set(entry.unicode, replacement)

    // Add no-VS16 alias to catch pasted emoji that omit variation selectors.
    const withoutVariationSelector = entry.unicode.replaceAll('\uFE0F', '')
    if (withoutVariationSelector !== entry.unicode && !byUnicode.has(withoutVariationSelector)) {
      byUnicode.set(withoutVariationSelector, { unicode: withoutVariationSelector, twemojiUrl })
    }
  }

  const lengths = Array.from(new Set(Array.from(byUnicode.keys(), (unicode) => unicode.length))).sort(
    (a, b) => b - a
  )
  const firstCodeUnitSet = new Set(Array.from(byUnicode.keys(), (unicode) => unicode[0] ?? ''))
  const index: EmojiReplacementIndex = { byUnicode, lengths, firstCodeUnitSet }
  replacementIndexCache.set(normalizedBase, index)
  return index
}

function tokenizeTextForEmojiReplacement(
  text: string,
  index: EmojiReplacementIndex
): { tokens: Array<string | EmojiReplacementEntry>; replaced: boolean } {
  if (!text) return { tokens: [''], replaced: false }

  const tokens: Array<string | EmojiReplacementEntry> = []
  let cursor = 0
  let pendingText = ''
  let replaced = false

  while (cursor < text.length) {
    let match: EmojiReplacementEntry | null = null

    const firstCodeUnit = text[cursor] ?? ''
    if (index.firstCodeUnitSet.has(firstCodeUnit)) {
      for (const length of index.lengths) {
        if (cursor + length > text.length) continue
        const candidate = text.slice(cursor, cursor + length)
        const entry = index.byUnicode.get(candidate)
        if (!entry) continue
        match = entry
        break
      }
    }

    if (match) {
      if (pendingText) {
        tokens.push(pendingText)
        pendingText = ''
      }
      tokens.push(match)
      cursor += match.unicode.length
      replaced = true
      continue
    }

    pendingText += text[cursor] ?? ''
    cursor += 1
  }

  if (pendingText) {
    tokens.push(pendingText)
  }

  return { tokens, replaced }
}

/**
 * Replaces supported unicode emoji in HTML text nodes with Twemoji `<img>` tags.
 */
export function replaceUnicodeEmojiInHTML(
  html: string,
  options?: { twemojiBaseUrl?: string }
): { html: string; replaced: boolean } {
  if (typeof DOMParser === 'undefined' || typeof NodeFilter === 'undefined') {
    return { html, replaced: false }
  }

  const index = getReplacementIndex(options?.twemojiBaseUrl)
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []

  let currentNode = walker.nextNode()
  while (currentNode) {
    if (currentNode instanceof Text) {
      textNodes.push(currentNode)
    }
    currentNode = walker.nextNode()
  }

  let replaced = false
  for (const textNode of textNodes) {
    const parentElement = textNode.parentElement
    if (!parentElement) continue

    const tagName = parentElement.tagName.toLowerCase()
    if (tagName === 'code' || tagName === 'pre') continue

    const { tokens, replaced: nodeReplaced } = tokenizeTextForEmojiReplacement(textNode.data, index)
    if (!nodeReplaced) continue

    const fragment = doc.createDocumentFragment()
    for (const token of tokens) {
      if (typeof token === 'string') {
        fragment.append(doc.createTextNode(token))
      } else {
        fragment.append(createEmojiImageElement(doc, token))
      }
    }
    textNode.replaceWith(fragment)
    replaced = true
  }

  return { html: doc.body.innerHTML, replaced }
}

/**
 * Converts plain text to escaped HTML and replaces supported unicode emoji with Twemoji images.
 */
export function replaceUnicodeEmojiInPlainTextAsHTML(
  text: string,
  options?: { twemojiBaseUrl?: string }
): { html: string; replaced: boolean } {
  const normalized = text.replace(/\r\n?/g, '\n')
  const index = getReplacementIndex(options?.twemojiBaseUrl)
  const lines = normalized.split('\n')
  let replaced = false

  const html = lines
    .map((line) => {
      const { tokens, replaced: lineReplaced } = tokenizeTextForEmojiReplacement(line, index)
      replaced ||= lineReplaced
      return tokens
        .map((token) => (typeof token === 'string' ? escapeHTML(token) : createEmojiImageHTML(token)))
        .join('')
    })
    .join('<br>')

  return { html, replaced }
}
