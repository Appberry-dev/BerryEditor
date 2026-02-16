import type {
  AttachmentNode,
  BlockNode,
  EditorDocument,
  InlineNode,
  TableBlockNode,
  TableCellNode,
  TextBlockNode
} from '../model/types'

function escapeHTML(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function styleAttr(attrs: Array<[string, string | number | undefined]>): string {
  const declarations = attrs
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([name, value]) => `${name}:${String(value)}`)
  if (!declarations.length) return ''
  return ` style="${escapeHTML(declarations.join(';'))}"`
}

function serializeAttachment(node: AttachmentNode): string {
  const dataAttrs = [
    `data-berry-attachment-id="${escapeHTML(node.id)}"`,
    `data-berry-url="${escapeHTML(node.url)}"`,
    `data-berry-filename="${escapeHTML(node.filename)}"`,
    `data-berry-filesize="${String(node.filesize)}"`,
    `data-berry-content-type="${escapeHTML(node.contentType)}"`
  ]

  if (node.previewUrl) dataAttrs.push(`data-berry-preview-url="${escapeHTML(node.previewUrl)}"`)
  if (node.caption) dataAttrs.push(`data-berry-caption="${escapeHTML(node.caption)}"`)
  if (node.pending) dataAttrs.push(`data-berry-pending="true"`)
  if (node.imageAlign) dataAttrs.push(`data-berry-image-align="${node.imageAlign}"`)
  if (node.wrapText) dataAttrs.push('data-berry-image-wrap="true"')
  if (node.wrapSide) dataAttrs.push(`data-berry-image-wrap-side="${node.wrapSide}"`)
  if (node.padding !== undefined) dataAttrs.push(`data-berry-image-padding="${String(node.padding)}"`)
  if (node.width !== undefined) dataAttrs.push(`data-berry-image-width="${String(node.width)}"`)
  if (node.widthUnit) dataAttrs.push(`data-berry-image-width-unit="${node.widthUnit}"`)

  const imageURL = node.previewUrl || node.url
  const isImage = node.contentType.startsWith('image/')
  const className = isImage ? 'berry-attachment berry-attachment--image' : 'berry-attachment'
  const widthUnit = node.widthUnit ?? 'px'
  const imageWidthStyle =
    node.width === undefined ? undefined : widthUnit === 'percent' ? `${node.width}%` : `${node.width}px`
  const bodyStyle = styleAttr([['padding', node.padding !== undefined ? `${node.padding}px` : undefined]])
  const image = `<img src="${escapeHTML(imageURL)}" alt="${escapeHTML(node.alt ?? node.filename)}"${
    node.width !== undefined && widthUnit === 'px' ? ` width="${Math.round(node.width)}"` : ''
  }${node.height ? ` height="${Math.round(node.height)}"` : ''}${styleAttr([['width', imageWidthStyle]])}>`
  const linkAttrs =
    node.linkOpenInNewTab === false ? '' : ' target="_blank" rel="noopener noreferrer"'
  const imageWithLink =
    isImage && node.linkUrl
      ? `<a href="${escapeHTML(node.linkUrl)}"${linkAttrs}>${image}</a>`
      : image
  const body = isImage
    ? imageWithLink
    : `<a href="${escapeHTML(node.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(node.filename)}</a>`

  const caption = node.caption ? `<figcaption>${escapeHTML(node.caption)}</figcaption>` : '<figcaption></figcaption>'
  return `<figure class="${className}" ${dataAttrs.join(' ')}><div class="berry-attachment__body"${bodyStyle}>${body}</div>${caption}</figure>`
}

function wrapMarks(text: string, marks: Record<string, true | string | undefined>): string {
  let out = text
  if (marks.code) out = `<code>${out}</code>`
  if (marks.underline) out = `<u>${out}</u>`
  if (marks.strike) out = `<s>${out}</s>`
  if (marks.italic) out = `<em>${out}</em>`
  if (marks.bold) out = `<strong>${out}</strong>`
  if (typeof marks.fontSize === 'string') out = `<span style="font-size:${escapeHTML(marks.fontSize)}">${out}</span>`
  if (typeof marks.fontFamily === 'string') out = `<span style="font-family:${escapeHTML(marks.fontFamily)}">${out}</span>`
  if (typeof marks.textColor === 'string') out = `<span style="color:${escapeHTML(marks.textColor)}">${out}</span>`
  if (typeof marks.highlightColor === 'string') {
    out = `<span style="background-color:${escapeHTML(marks.highlightColor)}">${out}</span>`
  }
  if (typeof marks.link === 'string') {
    const attrs =
      marks.linkTarget === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : ''
    out = `<a href="${escapeHTML(marks.link)}"${attrs}>${out}</a>`
  }
  return out
}

function serializeInline(node: InlineNode): string {
  if (node.kind === 'attachment') {
    return serializeAttachment(node)
  }

  const segments = node.text.split('\n').map((part) => wrapMarks(escapeHTML(part), node.marks))
  return segments.join('<br>')
}

function serializeTextBlock(block: TextBlockNode): string {
  const content = block.children.map(serializeInline).join('')
  const style = styleAttr([
    ['text-align', block.align],
    ['line-height', block.lineHeight],
    ['font-size', block.fontSize ? `${block.fontSize}px` : undefined],
    ['font-family', block.fontFamily]
  ])

  switch (block.type) {
    case 'heading1':
      return `<h1${style}>${content}</h1>`
    case 'heading2':
      return `<h2${style}>${content}</h2>`
    case 'heading3':
      return `<h3${style}>${content}</h3>`
    case 'quote':
      return `<blockquote${style}>${content}</blockquote>`
    case 'listItem':
      return `<li${style}>${content}</li>`
    default:
      return `<p${style}>${content}</p>`
  }
}

function serializeTableCell(cell: TableCellNode): string {
  const tag = cell.header ? 'th' : 'td'
  const attrs: string[] = []
  if (cell.colspan && cell.colspan > 1) {
    attrs.push(`colspan="${cell.colspan}"`)
  }
  if (cell.rowspan && cell.rowspan > 1) {
    attrs.push(`rowspan="${cell.rowspan}"`)
  }
  const style = styleAttr([
    ['text-align', cell.align],
    ['line-height', cell.lineHeight],
    ['font-size', cell.fontSize ? `${cell.fontSize}px` : undefined],
    ['font-family', cell.fontFamily]
  ])
  const content = cell.children.map(serializeInline).join('') || '<br>'
  return `<${tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}${style}>${content}</${tag}>`
}

function serializeTable(block: TableBlockNode): string {
  const style = styleAttr([
    ['text-align', block.align],
    ['line-height', block.lineHeight],
    ['font-size', block.fontSize ? `${block.fontSize}px` : undefined],
    ['font-family', block.fontFamily]
  ])
  const rows = block.rows
    .map((row) => `<tr>${row.cells.map((cell) => serializeTableCell(cell)).join('')}</tr>`)
    .join('')
  return `<table${style}><tbody>${rows}</tbody></table>`
}

function serializeBlock(block: BlockNode): string {
  if (block.type === 'horizontalRule') {
    return '<hr>'
  }
  if (block.type === 'table') {
    return serializeTable(block)
  }
  return serializeTextBlock(block)
}

/**
 * Serializes the canonical document model to editor HTML.
 */
export function serializeHTML(documentModel: EditorDocument): string {
  const blocks = documentModel.blocks
  const html: string[] = []
  let listBuffer: { kind: 'bullet' | 'numbered'; items: string[] } | null = null

  const flushList = () => {
    if (!listBuffer) return
    const tag = listBuffer.kind === 'bullet' ? 'ul' : 'ol'
    html.push(`<${tag}>${listBuffer.items.join('')}</${tag}>`)
    listBuffer = null
  }

  for (const block of blocks) {
    if (block.type === 'listItem' && block.listType) {
      if (!listBuffer || listBuffer.kind !== block.listType) {
        flushList()
        listBuffer = { kind: block.listType, items: [] }
      }
      listBuffer.items.push(serializeBlock(block))
      continue
    }

    flushList()
    html.push(serializeBlock(block))
  }

  flushList()
  return html.join('')
}
