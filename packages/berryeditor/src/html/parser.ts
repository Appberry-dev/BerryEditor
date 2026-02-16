import { sanitizeHTML } from './sanitize'
import {
  parseRoundedNumberInRange,
  parseSafeFontFamily as parseSafeFontFamilyValue,
  parseSafeFontSizeValue,
  parseSafeLineHeightValue
} from '../core/styleGuards'
import type {
  Alignment,
  AttachmentNode,
  BlockNode,
  EditorDocument,
  InlineNode,
  TableCellNode,
  TableRowNode,
  TextNode
} from '../model/types'

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const ALIGNMENTS: Alignment[] = ['left', 'center', 'right', 'justify']
const IMAGE_ALIGNMENTS = ['left', 'center', 'right'] as const
const IMAGE_WRAP_SIDES = ['left', 'right'] as const

function parseNumberInRange(
  value: string | null | undefined,
  min: number,
  max: number
): number | undefined {
  return parseRoundedNumberInRange(value, min, max) ?? undefined
}

function parseImageWidthFromStyle(value: string | undefined): { width: number; unit: 'px' | 'percent' } | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (normalized.endsWith('%')) {
    const width = parseNumberInRange(normalized.slice(0, -1).trim(), 5, 100)
    if (width === undefined) return null
    return { width, unit: 'percent' }
  }
  const numericText = normalized.endsWith('px') ? normalized.slice(0, -2).trim() : normalized
  const width = parseNumberInRange(numericText, 24, 4096)
  if (width === undefined) return null
  return { width, unit: 'px' }
}

function parseImagePaddingFromStyle(value: string | undefined): number | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (!normalized) return undefined
  const numericText = normalized.endsWith('px') ? normalized.slice(0, -2).trim() : normalized
  return parseNumberInRange(numericText, 0, 96)
}

function parseImageAlign(value: string | null): 'left' | 'center' | 'right' | undefined {
  if (!value) return undefined
  const normalized = value.toLowerCase().trim()
  return IMAGE_ALIGNMENTS.includes(normalized as (typeof IMAGE_ALIGNMENTS)[number])
    ? (normalized as 'left' | 'center' | 'right')
    : undefined
}

function parseImageWrapSide(value: string | null): 'left' | 'right' | undefined {
  if (!value) return undefined
  const normalized = value.toLowerCase().trim()
  return IMAGE_WRAP_SIDES.includes(normalized as (typeof IMAGE_WRAP_SIDES)[number])
    ? (normalized as 'left' | 'right')
    : undefined
}

function parseAlignment(value: string | null): Alignment | undefined {
  if (!value) return undefined
  const normalized = value.toLowerCase().trim()
  return ALIGNMENTS.includes(normalized as Alignment) ? (normalized as Alignment) : undefined
}

function parseLineHeight(value: string | null): number | undefined {
  return parseSafeLineHeightValue(value) ?? undefined
}

function parseFontSize(value: string | null): number | undefined {
  return parseSafeFontSizeValue(value) ?? undefined
}

function parseFontFamily(value: string | null): string | undefined {
  return parseSafeFontFamilyValue(value) ?? undefined
}

function parseStyleMap(styleText: string | null): Record<string, string> {
  if (!styleText) return {}
  const out: Record<string, string> = {}
  const entries = styleText
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
  for (const entry of entries) {
    const [name, ...rest] = entry.split(':')
    if (!name || rest.length === 0) continue
    out[name.trim().toLowerCase()] = rest.join(':').trim()
  }
  return out
}

function parseBlockStyle(node: Element): {
  align?: Alignment
  lineHeight?: number
  fontSize?: number
  fontFamily?: string
} {
  const { align, lineHeight, fontSize, fontFamily } = parseTypographyStyle(
    parseStyleMap(node.getAttribute('style'))
  )
  return {
    ...(align ? { align } : {}),
    ...(lineHeight ? { lineHeight } : {}),
    ...(fontSize ? { fontSize } : {}),
    ...(fontFamily ? { fontFamily } : {})
  }
}

function parseTypographyStyle(styleMap: Record<string, string>): {
  align?: Alignment
  lineHeight?: number
  fontSize?: number
  fontFamily?: string
} {
  const align = parseAlignment(styleMap['text-align'] ?? null)
  const lineHeight = parseLineHeight(styleMap['line-height'] ?? null)
  const fontSize = parseFontSize(styleMap['font-size'] ?? null)
  const fontFamily = parseFontFamily(styleMap['font-family'] ?? null)

  return {
    ...(align ? { align } : {}),
    ...(lineHeight ? { lineHeight } : {}),
    ...(fontSize ? { fontSize } : {}),
    ...(fontFamily ? { fontFamily } : {})
  }
}

function parseMarks(node: Element, parentMarks: TextNode['marks']): TextNode['marks'] {
  const marks = { ...parentMarks }
  const tag = node.tagName.toLowerCase()

  if (tag === 'strong' || tag === 'b') marks.bold = true
  if (tag === 'em' || tag === 'i') marks.italic = true
  if (tag === 'u') marks.underline = true
  if (tag === 's' || tag === 'strike' || tag === 'del') marks.strike = true
  if (tag === 'code') marks.code = true
  if (tag === 'a') {
    const href = node.getAttribute('href')
    if (href) marks.link = href
    const target = node.getAttribute('target')
    if (target === '_blank') marks.linkTarget = '_blank'
  }
  if (tag === 'mark') {
    marks.highlightColor = '#ffff00'
  }

  const styleMap = parseStyleMap(node.getAttribute('style'))
  const color = styleMap.color ?? ''
  if (HEX_COLOR.test(color)) {
    marks.textColor = color
  }

  const backgroundColor = styleMap['background-color'] ?? ''
  if (HEX_COLOR.test(backgroundColor)) {
    marks.highlightColor = backgroundColor
  }

  const fontFamily = parseFontFamily(styleMap['font-family'] ?? null)
  if (fontFamily) {
    marks.fontFamily = fontFamily
  }

  const fontSize = parseFontSize(styleMap['font-size'] ?? null)
  if (fontSize) {
    marks.fontSize = `${fontSize}px`
  }

  return marks
}

function parseAttachment(node: Element): AttachmentNode | null {
  const id = node.getAttribute('data-berry-attachment-id')
  const url = node.getAttribute('data-berry-url') || ''
  const filename = node.getAttribute('data-berry-filename') || 'file'
  const filesize = Number(node.getAttribute('data-berry-filesize') || '0')
  const contentType = node.getAttribute('data-berry-content-type') || 'application/octet-stream'

  if (!id) return null

  const previewUrl = node.getAttribute('data-berry-preview-url') || undefined
  const caption =
    node.getAttribute('data-berry-caption') || node.querySelector('figcaption')?.textContent || undefined
  const pending = node.getAttribute('data-berry-pending') === 'true'
  const img = node.querySelector('img')
  const body = node.querySelector('.berry-attachment__body')
  const imageStyleMap = parseStyleMap(img?.getAttribute('style') ?? null)
  const bodyStyleMap = parseStyleMap(body?.getAttribute('style') ?? null)
  const widthFromData = parseNumberInRange(node.getAttribute('data-berry-image-width'), 0, 4096)
  const widthUnitFromData = node.getAttribute('data-berry-image-width-unit')
  let width: number | undefined
  let widthUnit: 'px' | 'percent' | undefined
  if (widthFromData !== undefined && (widthUnitFromData === 'px' || widthUnitFromData === 'percent')) {
    const inBounds =
      widthUnitFromData === 'percent'
        ? widthFromData >= 5 && widthFromData <= 100
        : widthFromData >= 24 && widthFromData <= 4096
    if (inBounds) {
      width = widthFromData
      widthUnit = widthUnitFromData
    }
  } else {
    const parsedStyleWidth = parseImageWidthFromStyle(imageStyleMap.width)
    if (parsedStyleWidth) {
      width = parsedStyleWidth.width
      widthUnit = parsedStyleWidth.unit
    } else {
      const widthAttr = parseNumberInRange(img?.getAttribute('width') ?? null, 24, 4096)
      if (widthAttr !== undefined) {
        width = widthAttr
        widthUnit = 'px'
      }
    }
  }
  const height = parseNumberInRange(img?.getAttribute('height') ?? null, 24, 4096)
  const alt = img?.getAttribute('alt') || undefined
  const padding =
    parseNumberInRange(node.getAttribute('data-berry-image-padding'), 0, 96) ??
    parseImagePaddingFromStyle(bodyStyleMap.padding)
  const imageAlign = parseImageAlign(node.getAttribute('data-berry-image-align'))
  const wrapText = node.getAttribute('data-berry-image-wrap') === 'true'
  const wrapSide = parseImageWrapSide(node.getAttribute('data-berry-image-wrap-side'))
  const imageLink = img?.closest('a[href]')
  const linkUrl =
    imageLink && node.contains(imageLink) ? imageLink.getAttribute('href') || undefined : undefined
  const linkOpenInNewTab = imageLink?.getAttribute('target') === '_blank'

  return {
    kind: 'attachment',
    id,
    url,
    filename,
    filesize,
    contentType,
    pending,
    ...(previewUrl ? { previewUrl } : {}),
    ...(caption ? { caption } : {}),
    ...(width ? { width } : {}),
    ...(widthUnit ? { widthUnit } : {}),
    ...(height ? { height } : {}),
    ...(alt ? { alt } : {}),
    ...(padding !== undefined ? { padding } : {}),
    ...(imageAlign ? { imageAlign } : {}),
    ...(wrapText ? { wrapText: true } : {}),
    ...(wrapSide ? { wrapSide } : {}),
    ...(linkUrl ? { linkUrl } : {}),
    ...(linkUrl ? { linkOpenInNewTab } : {})
  }
}

function parseInline(node: Node, marks: TextNode['marks']): InlineNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    if (!text) return []
    return [{ kind: 'text', text, marks: { ...marks } }]
  }

  if (!(node instanceof Element)) return []

  if (node.tagName.toLowerCase() === 'br') {
    return [{ kind: 'text', text: '\n', marks: { ...marks } }]
  }

  if (node.tagName.toLowerCase() === 'img' && node.classList.contains('berry-emoji')) {
    const emojiValue = node.getAttribute('data-berry-emoji') || node.getAttribute('alt') || ''
    if (!emojiValue) return []
    return [{ kind: 'text', text: emojiValue, marks: { ...marks } }]
  }

  if (node.tagName.toLowerCase() === 'figure') {
    const attachment = parseAttachment(node)
    return attachment ? [attachment] : []
  }

  const nextMarks = parseMarks(node, marks)
  return Array.from(node.childNodes).flatMap((child) => parseInline(child, nextMarks))
}

function parseTableCell(node: Element): TableCellNode {
  const typographyStyle = parseTypographyStyle(parseStyleMap(node.getAttribute('style')))
  const colspan = Number(node.getAttribute('colspan') || '1')
  const rowspan = Number(node.getAttribute('rowspan') || '1')

  return {
    header: node.tagName.toLowerCase() === 'th',
    ...(colspan > 1 ? { colspan } : {}),
    ...(rowspan > 1 ? { rowspan } : {}),
    ...typographyStyle,
    children: Array.from(node.childNodes).flatMap((child) => parseInline(child, {}))
  }
}

function parseTableRow(row: Element): TableRowNode | null {
  if (row.tagName.toLowerCase() !== 'tr') return null
  const cells = Array.from(row.children)
    .filter((cell) => ['td', 'th'].includes(cell.tagName.toLowerCase()))
    .map(parseTableCell)
  if (!cells.length) return null
  return { cells }
}

function parseTableRows(table: Element): TableRowNode[] {
  const rows: TableRowNode[] = []

  for (const child of Array.from(table.children)) {
    const tag = child.tagName.toLowerCase()
    if (tag === 'tr') {
      const row = parseTableRow(child)
      if (row) rows.push(row)
      continue
    }
    if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') {
      for (const row of Array.from(child.children)) {
        const parsedRow = parseTableRow(row)
        if (parsedRow) rows.push(parsedRow)
      }
    }
  }

  return rows
}

function parseBlock(node: Element): BlockNode[] {
  const tag = node.tagName.toLowerCase()
  const blockStyle = parseBlockStyle(node)

  if (tag === 'figure') {
    const attachment = parseAttachment(node)
    if (attachment) {
      return [{ type: 'paragraph', children: [attachment], ...blockStyle }]
    }
  }

  if (tag === 'hr') {
    return [{ type: 'horizontalRule', ...blockStyle }]
  }

  if (tag === 'table') {
    return [{ type: 'table', rows: parseTableRows(node), ...blockStyle }]
  }

  if (tag === 'ul' || tag === 'ol') {
    const listType = tag === 'ul' ? 'bullet' : 'numbered'
    return Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === 'li')
      .map((li) => ({
        type: 'listItem' as const,
        listType,
        children: Array.from(li.childNodes).flatMap((child) => parseInline(child, {})),
        ...parseBlockStyle(li)
      }))
  }

  const children = Array.from(node.childNodes).flatMap((child) => parseInline(child, {}))

  switch (tag) {
    case 'h1':
      return [{ type: 'heading1', children, ...blockStyle }]
    case 'h2':
      return [{ type: 'heading2', children, ...blockStyle }]
    case 'h3':
      return [{ type: 'heading3', children, ...blockStyle }]
    case 'blockquote':
      return [{ type: 'quote', children, ...blockStyle }]
    default:
      return [{ type: 'paragraph', children, ...blockStyle }]
  }
}

/**
 * Parses sanitized editor HTML into the canonical document model.
 */
export function parseHTML(rawHTML: string): EditorDocument {
  const safeHTML = sanitizeHTML(rawHTML)

  if (typeof window === 'undefined') {
    return { blocks: [] }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<body>${safeHTML}</body>`, 'text/html')
  const body = doc.body
  const blocks: BlockNode[] = []

  for (const node of Array.from(body.children)) {
    blocks.push(...parseBlock(node))
  }

  if (!blocks.length && body.textContent?.trim()) {
    blocks.push({
      type: 'paragraph',
      children: [{ kind: 'text', text: body.textContent, marks: {} }]
    })
  }

  return { blocks }
}
