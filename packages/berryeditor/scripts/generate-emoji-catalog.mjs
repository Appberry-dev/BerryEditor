#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'

const UNICODE_EMOJI_TEST_URL = 'https://unicode.org/Public/emoji/latest/emoji-test.txt'
const CLDR_ANNOTATIONS_URL =
  'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-annotations-full/annotations/en/annotations.json'
const TWEMOJI_TAG = 'v17.0.2'
const TWEMOJI_REF_URL = `https://api.github.com/repos/jdecked/twemoji/git/ref/tags/${TWEMOJI_TAG}`
const TWEMOJI_TREE_URL = (sha) =>
  `https://api.github.com/repos/jdecked/twemoji/git/trees/${sha}?recursive=1`
const OUTPUT_FILE = '../src/react/emojiCatalog.ts'
const TWEMOJI_BASE_URL = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_TAG}/assets/svg`
const SKIN_TONE_CODEPOINTS = new Set(['1f3fb', '1f3fc', '1f3fd', '1f3fe', '1f3ff'])

function fetchText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: { 'User-Agent': 'BerryEditor-EmojiCatalogGenerator', ...headers }
      },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          resolve(fetchText(response.headers.location, headers))
          return
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Request failed for ${url} with status ${response.statusCode}`))
          response.resume()
          return
        }

        const chunks = []
        response.setEncoding('utf8')
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => resolve(chunks.join('')))
      }
    )

    request.on('error', reject)
  })
}

function parseUnicodeVersion(emojiTestText) {
  const match = emojiTestText.match(/^#\s*Version:\s*(.+)$/m)
  return match ? match[1].trim() : 'UNKNOWN'
}

function cpToUnicode(codepoints) {
  return codepoints.map((cp) => String.fromCodePoint(Number.parseInt(cp, 16))).join('')
}

function cpToEscapedUnicode(codepoints) {
  return codepoints.map((cp) => `\\u{${cp.toUpperCase()}}`).join('')
}

function tokenizeName(name) {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function parseEmojiTest(emojiTestText) {
  const lines = emojiTestText.split(/\r?\n/)
  const entries = []
  let currentGroup = 'Unknown'
  let currentSubgroup = 'unknown'

  for (const line of lines) {
    if (!line) continue

    const groupMatch = line.match(/^#\s*group:\s*(.+)$/)
    if (groupMatch) {
      currentGroup = groupMatch[1].trim()
      continue
    }

    const subgroupMatch = line.match(/^#\s*subgroup:\s*(.+)$/)
    if (subgroupMatch) {
      currentSubgroup = subgroupMatch[1].trim()
      continue
    }

    const entryMatch = line.match(
      /^([0-9A-F ]+)\s*;\s*fully-qualified\s*#\s*(\S+)\s+E[0-9.]+\s+(.+)$/
    )
    if (!entryMatch) continue

    const codepoints = entryMatch[1]
      .trim()
      .split(/\s+/)
      .map((cp) => {
        const normalized = cp.toLowerCase().replace(/^0+/, '')
        return normalized || '0'
      })
    const unicode = cpToUnicode(codepoints)
    const name = entryMatch[3].trim()

    entries.push({
      unicode,
      name,
      group: currentGroup,
      subgroup: currentSubgroup,
      codepoints
    })
  }

  return entries
}

function parseCldrAnnotations(cldrText) {
  const payload = JSON.parse(cldrText)
  const annotationsMap =
    payload?.annotations?.annotations ??
    payload?.main?.en?.annotations ??
    payload?.main?.root?.annotations ??
    {}

  const keywordMap = new Map()
  for (const [symbol, entry] of Object.entries(annotationsMap)) {
    if (!entry || typeof entry !== 'object') continue
    const defaults = Array.isArray(entry.default) ? entry.default : []
    const tts = Array.isArray(entry.tts) ? entry.tts : []
    const keywords = [...defaults, ...tts]
      .flatMap((item) => (typeof item === 'string' ? item.split('|') : []))
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
    if (!keywords.length) continue
    keywordMap.set(symbol, Array.from(new Set(keywords)))
  }
  return keywordMap
}

function candidateCodepointKeys(codepoints) {
  const fe0fIndexes = []
  for (let index = 0; index < codepoints.length; index += 1) {
    if (codepoints[index] === 'fe0f') fe0fIndexes.push(index)
  }

  if (fe0fIndexes.length === 0) return [codepoints.join('-')]

  const out = []
  const totalMasks = 1 << fe0fIndexes.length
  for (let mask = 0; mask < totalMasks; mask += 1) {
    const remove = new Set()
    for (let bit = 0; bit < fe0fIndexes.length; bit += 1) {
      if ((mask & (1 << bit)) !== 0) remove.add(fe0fIndexes[bit])
    }
    const candidate = codepoints.filter((_, index) => !remove.has(index)).join('-')
    out.push(candidate)
  }

  return Array.from(new Set(out))
}

function resolveTwemojiCodepointKey(codepoints, availableKeys) {
  const candidates = candidateCodepointKeys(codepoints)
  let best = null

  for (const candidate of candidates) {
    if (!availableKeys.has(candidate)) continue
    const candidateParts = candidate.split('-')
    const removed = codepoints.length - candidateParts.length
    const score = removed * 100 + candidateParts.filter((cp) => cp === 'fe0f').length
    if (!best || score < best.score) {
      best = { key: candidate, score }
    }
  }

  return best?.key ?? null
}

function deriveVariantMeta(entry) {
  const lowerName = entry.name.toLowerCase()
  const hasMultipleTones =
    entry.codepoints.filter((cp) => SKIN_TONE_CODEPOINTS.has(cp)).length > 1 ||
    /,\s*(light|medium-light|medium|medium-dark|dark) skin tone/.test(lowerName)

  let tone = 'default'
  if (!hasMultipleTones) {
    if (entry.codepoints.includes('1f3fb')) tone = 'light'
    else if (entry.codepoints.includes('1f3fc')) tone = 'medium-light'
    else if (entry.codepoints.includes('1f3fd')) tone = 'medium'
    else if (entry.codepoints.includes('1f3fe')) tone = 'medium-dark'
    else if (entry.codepoints.includes('1f3ff')) tone = 'dark'
  }

  let gender = 'auto'
  if (/\bwoman\b/.test(lowerName)) gender = 'woman'
  else if (/\bman\b/.test(lowerName)) gender = 'man'
  else if (/\bperson\b/.test(lowerName)) gender = 'person'

  const variantKey = `${entry.subgroup}::${lowerName
    .replace(/,\s*(light|medium-light|medium|medium-dark|dark) skin tone/g, '')
    .replace(/:\s*(light|medium-light|medium|medium-dark|dark) skin tone/g, '')
    .replace(/\b(woman|man|person)\b/g, 'person')
    .replace(/\s+/g, ' ')
    .trim()}`

  return { tone, gender, variantKey }
}

function js(value) {
  return JSON.stringify(value)
}

async function run() {
  const [emojiTestText, cldrText, twemojiRefText] = await Promise.all([
    fetchText(UNICODE_EMOJI_TEST_URL),
    fetchText(CLDR_ANNOTATIONS_URL),
    fetchText(TWEMOJI_REF_URL)
  ])

  const unicodeVersion = parseUnicodeVersion(emojiTestText)
  if (!unicodeVersion.startsWith('17.0')) {
    throw new Error(`Expected Unicode emoji version 17.0, received ${unicodeVersion}`)
  }

  const twemojiRef = JSON.parse(twemojiRefText)
  const twemojiSha = twemojiRef?.object?.sha
  if (!twemojiSha) {
    throw new Error('Unable to resolve Twemoji git ref SHA.')
  }

  const twemojiTreeText = await fetchText(TWEMOJI_TREE_URL(twemojiSha))
  const twemojiTree = JSON.parse(twemojiTreeText)
  const twemojiAssetKeys = new Set(
    (twemojiTree.tree ?? [])
      .filter((node) => typeof node.path === 'string')
      .map((node) => node.path)
      .filter((pathValue) => pathValue.startsWith('assets/svg/') && pathValue.endsWith('.svg'))
      .map((pathValue) => pathValue.replace('assets/svg/', '').replace('.svg', '').toLowerCase())
  )

  const unicodeEntries = parseEmojiTest(emojiTestText)
  const cldrKeywords = parseCldrAnnotations(cldrText)

  const catalog = unicodeEntries.map((entry) => {
    const codepointKey = resolveTwemojiCodepointKey(entry.codepoints, twemojiAssetKeys)
    if (!codepointKey) {
      throw new Error(`No Twemoji asset found for ${entry.name} (${entry.codepoints.join(' ')})`)
    }

    const keywords = new Set([
      ...tokenizeName(entry.name),
      ...(cldrKeywords.get(entry.unicode) ?? [])
    ])

    const variantMeta = deriveVariantMeta(entry)

    return {
      unicode: entry.unicode,
      escapedUnicode: cpToEscapedUnicode(entry.codepoints),
      name: entry.name,
      keywords: Array.from(keywords).sort(),
      group: entry.group,
      subgroup: entry.subgroup,
      codepoints: codepointKey,
      twemojiUrl: `${TWEMOJI_BASE_URL}/${codepointKey}.svg`,
      variantKey: variantMeta.variantKey,
      tone: variantMeta.tone,
      gender: variantMeta.gender
    }
  })

  const fileLines = []
  fileLines.push("import type { EmojiGender, EmojiTone } from './types'")
  fileLines.push('')
  fileLines.push('export interface EmojiCatalogEntry {')
  fileLines.push('  unicode: string')
  fileLines.push('  name: string')
  fileLines.push('  keywords: readonly string[]')
  fileLines.push('  group: string')
  fileLines.push('  subgroup: string')
  fileLines.push('  codepoints: string')
  fileLines.push('  twemojiUrl: string')
  fileLines.push('  variantKey: string')
  fileLines.push('  tone: EmojiTone')
  fileLines.push('  gender: EmojiGender')
  fileLines.push('}')
  fileLines.push('')
  fileLines.push('// Generated by scripts/generate-emoji-catalog.mjs. Do not edit manually.')
  fileLines.push("export const UNICODE_EMOJI_VERSION = '17.0' as const")
  fileLines.push(`export const UNICODE_FULLY_QUALIFIED_COUNT = ${catalog.length} as const`)
  fileLines.push(`export const TWEMOJI_VERSION = ${js(TWEMOJI_TAG.replace(/^v/, ''))} as const`)
  fileLines.push(`export const DEFAULT_TWEMOJI_BASE_URL = ${js(TWEMOJI_BASE_URL)} as const`)
  fileLines.push('')
  fileLines.push('export const EMOJI_CATALOG: ReadonlyArray<EmojiCatalogEntry> = [')

  for (const entry of catalog) {
    fileLines.push('  {')
    fileLines.push(`    unicode: '${entry.escapedUnicode}',`)
    fileLines.push(`    name: ${js(entry.name)},`)
    fileLines.push(`    keywords: ${js(entry.keywords)},`)
    fileLines.push(`    group: ${js(entry.group)},`)
    fileLines.push(`    subgroup: ${js(entry.subgroup)},`)
    fileLines.push(`    codepoints: ${js(entry.codepoints)},`)
    fileLines.push(`    twemojiUrl: ${js(entry.twemojiUrl)},`)
    fileLines.push(`    variantKey: ${js(entry.variantKey)},`)
    fileLines.push(`    tone: ${js(entry.tone)},`)
    fileLines.push(`    gender: ${js(entry.gender)}`)
    fileLines.push('  },')
  }

  fileLines.push(']')
  fileLines.push('')

  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const outPath = path.resolve(scriptDir, OUTPUT_FILE)
  await fs.writeFile(outPath, `${fileLines.join('\n')}\n`, 'utf8')

  const hasKeycapHash = catalog.some((entry) => entry.unicode === '#️⃣')
  const hasFaceWithBags = catalog.some((entry) => entry.name.toLowerCase() === 'face with bags under eyes')
  if (!hasKeycapHash || !hasFaceWithBags || catalog.length !== 3944) {
    throw new Error(
      `Catalog validation failed: count=${catalog.length}, keycap#=${hasKeycapHash}, faceWithBags=${hasFaceWithBags}`
    )
  }

  process.stdout.write(
    `Generated ${catalog.length} entries for Unicode ${unicodeVersion} at ${path.relative(process.cwd(), outPath)}\n`
  )
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
