import createDOMPurify from 'dompurify'
import {
  parseRoundedNumberInRange,
  parseSafeFontFamily,
  parseSafeFontSizeValue,
  parseSafeLineHeightValue
} from '../core/styleGuards'

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  's',
  'strike',
  'u',
  'mark',
  'code',
  'pre',
  'a',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'hr',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'figure',
  'figcaption',
  'img',
  'span',
  'div',
  'progress'
]

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'width',
  'height',
  'class',
  'style',
  'colspan',
  'rowspan',
  'scope',
  'data-berry-attachment-id',
  'data-berry-url',
  'data-berry-filename',
  'data-berry-filesize',
  'data-berry-content-type',
  'data-berry-preview-url',
  'data-berry-caption',
  'data-berry-pending',
  'data-berry-image-align',
  'data-berry-image-wrap',
  'data-berry-image-wrap-side',
  'data-berry-image-padding',
  'data-berry-image-width',
  'data-berry-image-width-unit',
  'data-berry-emoji',
  'value',
  'max',
  'contenteditable'
]

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const RGB_COLOR = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i
const RGBA_COLOR =
  /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i
const ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify'])
const ALLOWED_URI_REGEXP =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|blob):|[^a-z]|[-a-z+.]+(?:[^-a-z+.:]|$))/i

function toHexByte(value: number): string {
  return value.toString(16).padStart(2, '0')
}

function normalizeSafeHexColor(value: string): string | null {
  const trimmed = value.trim()
  if (HEX_COLOR.test(trimmed)) {
    return trimmed
  }

  const rgbMatch = trimmed.match(RGB_COLOR)
  if (rgbMatch) {
    const [, rawR, rawG, rawB] = rgbMatch
    const r = Number(rawR)
    const g = Number(rawG)
    const b = Number(rawB)
    if (
      ![r, g, b].every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255)
    ) {
      return null
    }
    return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
  }

  const rgbaMatch = trimmed.match(RGBA_COLOR)
  if (rgbaMatch) {
    const [, rawR, rawG, rawB, rawA] = rgbaMatch
    const r = Number(rawR)
    const g = Number(rawG)
    const b = Number(rawB)
    const alpha = Number(rawA)
    if (
      ![r, g, b].every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255)
    ) {
      return null
    }
    if (!Number.isFinite(alpha) || Math.abs(alpha - 1) > 0.000001) {
      return null
    }
    return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
  }

  return null
}

function parseSafeWidth(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  if (trimmed.endsWith('%')) {
    const percent = parseRoundedNumberInRange(trimmed.slice(0, -1).trim(), 5, 100)
    return percent === null ? null : `${percent}%`
  }
  const normalized = trimmed.endsWith('px') ? trimmed.slice(0, -2).trim() : trimmed
  const pixels = parseRoundedNumberInRange(normalized, 24, 4096)
  return pixels === null ? null : `${pixels}px`
}

function parseSafePadding(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  const normalized = trimmed.endsWith('px') ? trimmed.slice(0, -2).trim() : trimmed
  const pixels = parseRoundedNumberInRange(normalized, 0, 96)
  return pixels === null ? null : `${pixels}px`
}

function parseSafeTableCellBorder(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase()
  const match = normalized.match(/^1px solid (.+)$/)
  if (!match) return null
  const color = (match[1] ?? '').trim()
  if (!color) return null
  if (color === 'black') return '1px solid #000000'
  const normalizedHex = normalizeSafeHexColor(color)
  if (!normalizedHex) return null
  const loweredHex = normalizedHex.toLowerCase()
  if (loweredHex !== '#000' && loweredHex !== '#000000') return null
  return '1px solid #000000'
}

function parseSafeBorderCollapse(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  return normalized === 'collapse' ? 'collapse' : null
}

function sanitizeStyleText(styleText: string, tagName?: string): string {
  const declarations = styleText
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
  const safeEntries: string[] = []

  for (const declaration of declarations) {
    const [rawProp, ...rawRest] = declaration.split(':')
    if (!rawProp || rawRest.length === 0) continue
    const prop = rawProp.trim().toLowerCase()
    const value = rawRest.join(':').trim()
    if (!value) continue

    if (prop === 'color' || prop === 'background-color') {
      const normalized = normalizeSafeHexColor(value)
      if (normalized) {
        safeEntries.push(`${prop}:${normalized}`)
      }
      continue
    }

    if (prop === 'text-align') {
      const normalized = value.toLowerCase()
      if (ALIGN_VALUES.has(normalized)) {
        safeEntries.push(`text-align:${normalized}`)
      }
      continue
    }

    if (prop === 'line-height') {
      const safeLineHeight = parseSafeLineHeightValue(value)
      if (safeLineHeight !== null) {
        safeEntries.push(`line-height:${safeLineHeight}`)
      }
      continue
    }

    if (prop === 'font-size') {
      const safeFontSize = parseSafeFontSizeValue(value)
      if (safeFontSize !== null) {
        safeEntries.push(`font-size:${safeFontSize}px`)
      }
      continue
    }

    if (prop === 'font-family') {
      const safeFontFamily = parseSafeFontFamily(value)
      if (safeFontFamily) {
        safeEntries.push(`font-family:${safeFontFamily}`)
      }
      continue
    }

    if (prop === 'border') {
      const safeBorder = parseSafeTableCellBorder(value)
      if (safeBorder && (tagName === 'td' || tagName === 'th')) {
        safeEntries.push(`border:${safeBorder}`)
      }
      continue
    }

    if (prop === 'border-collapse') {
      const safeBorderCollapse = parseSafeBorderCollapse(value)
      if (safeBorderCollapse && tagName === 'table') {
        safeEntries.push(`border-collapse:${safeBorderCollapse}`)
      }
      continue
    }

    if (prop === 'width') {
      const safeWidth = parseSafeWidth(value)
      if (safeWidth && (!tagName || tagName === 'img' || tagName === 'figure')) {
        safeEntries.push(`width:${safeWidth}`)
      }
      continue
    }

    if (prop === 'padding') {
      const safePadding = parseSafePadding(value)
      if (safePadding && (!tagName || tagName === 'div')) {
        safeEntries.push(`padding:${safePadding}`)
      }
      continue
    }
  }

  return safeEntries.join(';')
}

function fallbackSanitize(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\sstyle="([^"]*)"/gi, (_, style: string) => {
      const safeStyle = sanitizeStyleText(style)
      return safeStyle ? ` style="${safeStyle}"` : ''
    })
    .replace(/\sstyle='([^']*)'/gi, (_, style: string) => {
      const safeStyle = sanitizeStyleText(style)
      return safeStyle ? ` style="${safeStyle}"` : ''
    })
}

/**
 * Sanitizes editor HTML and preserves only allowlisted tags, attributes, and style properties.
 */
export function sanitizeHTML(raw: string): string {
  if (!raw) return ''

  if (typeof window === 'undefined') {
    return fallbackSanitize(raw)
  }

  const purify = createDOMPurify(window)
  const sanitized = purify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ['style'],
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
    ALLOWED_URI_REGEXP
  })

  const container = document.createElement('div')
  container.innerHTML = sanitized
  for (const element of Array.from(container.querySelectorAll<HTMLElement>('[style]'))) {
    const safeStyle = sanitizeStyleText(
      element.getAttribute('style') ?? '',
      element.tagName.toLowerCase()
    )
    if (safeStyle) {
      element.setAttribute('style', safeStyle)
    } else {
      element.removeAttribute('style')
    }
  }
  return container.innerHTML
}
