import {
  isSafeFontFamily,
  isSafeHexColor,
  isSafeLink,
  isSafeLineHeight,
  parseSafeFontSize,
  isSafeTableDimension,
  runBrowserCommand,
  type CommandPayload,
  type EditorCommand
} from './commands'
import { HistoryStack } from './history'
import { getSelectionRange, setSelectionRange } from './selection'
import { sanitizeHTML } from '../html/sanitize'
import type { SelectionRange, UploadResult } from '../react/types'

interface Snapshot {
  html: string
  selection: SelectionRange | null
}

interface EngineOptions {
  onChange?: (html: string) => void
  onSelectionChange?: (range: SelectionRange | null) => void
  onFocus?: () => void
  onBlur?: () => void
}

function snapshotEquals(a: Snapshot, b: Snapshot): boolean {
  if (a.html !== b.html) return false
  if (!a.selection && !b.selection) return true
  if (!a.selection || !b.selection) return false
  return a.selection.anchor === b.selection.anchor && a.selection.focus === b.selection.focus
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function clampImageWidth(value: number, unit: ImageAttachmentWidthUnit): number {
  if (unit === 'percent') {
    return Math.max(IMAGE_WIDTH_MIN_PERCENT, Math.min(IMAGE_WIDTH_MAX_PERCENT, value))
  }
  return Math.max(IMAGE_WIDTH_MIN_PX, Math.min(IMAGE_WIDTH_MAX_PX, value))
}

function isSafeImageWidth(value: number, unit: ImageAttachmentWidthUnit): boolean {
  if (!Number.isFinite(value)) return false
  if (unit === 'percent') {
    return value >= IMAGE_WIDTH_MIN_PERCENT && value <= IMAGE_WIDTH_MAX_PERCENT
  }
  return value >= IMAGE_WIDTH_MIN_PX && value <= IMAGE_WIDTH_MAX_PX
}

function isSafeImagePadding(value: number): boolean {
  if (!Number.isFinite(value)) return false
  return value >= IMAGE_PADDING_MIN && value <= IMAGE_PADDING_MAX
}

function parseNumericValue(value: string | null): number | undefined {
  if (!value) return undefined
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return undefined
  return Math.round(numeric * 100) / 100
}

function parseImageWidthFromStyle(
  value: string | null
): { width: number; unit: ImageAttachmentWidthUnit } | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (normalized.endsWith('%')) {
    const numeric = parseNumericValue(normalized.slice(0, -1).trim())
    if (numeric === undefined || !isSafeImageWidth(numeric, 'percent')) return null
    return { width: numeric, unit: 'percent' }
  }
  const numericText = normalized.endsWith('px') ? normalized.slice(0, -2).trim() : normalized
  const numeric = parseNumericValue(numericText)
  if (numeric === undefined || !isSafeImageWidth(numeric, 'px')) return null
  return { width: numeric, unit: 'px' }
}

function parseImagePaddingFromStyle(value: string | null): number | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (!normalized) return undefined
  const numericText = normalized.endsWith('px') ? normalized.slice(0, -2).trim() : normalized
  const numeric = parseNumericValue(numericText)
  if (numeric === undefined || !isSafeImagePadding(numeric)) return undefined
  return numeric
}

function makeAttachmentHTML(
  id: string,
  opts: {
    filename: string
    filesize: number
    contentType: string
    url?: string
    previewUrl?: string
    caption?: string
    pending?: boolean
    progress?: number
    alt?: string
    width?: number
    widthUnit?: ImageAttachmentWidthUnit
    height?: number
    padding?: number
    imageAlign?: ImageAttachmentAlign
    wrapText?: boolean
    wrapSide?: ImageAttachmentWrapSide
    linkUrl?: string
    linkOpenInNewTab?: boolean
  }
): string {
  const safeFilename = escapeAttribute(opts.filename)
  const safeType = escapeAttribute(opts.contentType)
  const safeUrl = escapeAttribute(opts.url ?? '')
  const safePreview = escapeAttribute(opts.previewUrl ?? '')
  const safeCaption = escapeAttribute(opts.caption ?? '')
  const safeAlt = escapeAttribute(opts.alt ?? opts.filename)
  const pending = opts.pending ? 'true' : 'false'
  const progress = Math.max(0, Math.min(100, opts.progress ?? 0))
  const isImage = opts.contentType.startsWith('image/')
  const hasImageSource = isImage && (opts.previewUrl || opts.url)
  const widthUnit = opts.widthUnit ?? 'px'
  const safeWidth =
    opts.width !== undefined && isSafeImageWidth(opts.width, widthUnit)
      ? Math.round(clampImageWidth(opts.width, widthUnit) * 100) / 100
      : undefined
  const safePadding =
    opts.padding !== undefined && isSafeImagePadding(opts.padding)
      ? Math.round(opts.padding * 100) / 100
      : undefined
  const safeHeight =
    opts.height !== undefined && Number.isFinite(opts.height) && opts.height > 0
      ? Math.round(opts.height)
      : undefined
  const safeLinkUrl =
    opts.linkUrl && isSafeLink(opts.linkUrl) ? escapeAttribute(opts.linkUrl) : undefined
  const linkOpenInNewTab = opts.linkOpenInNewTab !== false
  const safeImageAlign = opts.imageAlign
  const safeWrapSide = opts.wrapSide
  const imageWidthStyle =
    safeWidth === undefined
      ? undefined
      : `width:${safeWidth}${widthUnit === 'percent' ? '%' : 'px'}`
  const imageWidthAttr =
    safeWidth !== undefined && widthUnit === 'px' ? ` width="${Math.round(safeWidth)}"` : ''
  const imageHeightAttr = safeHeight !== undefined ? ` height="${safeHeight}"` : ''
  const imageStyleAttr = imageWidthStyle ? ` style="${imageWidthStyle}"` : ''
  const bodyPaddingStyle = safePadding !== undefined ? ` style="padding:${safePadding}px"` : ''

  const imageMetaAttrs = isImage
    ? `${safeImageAlign ? ` data-berry-image-align="${safeImageAlign}"` : ''}${
        opts.wrapText ? ' data-berry-image-wrap="true"' : ''
      }${safeWrapSide ? ` data-berry-image-wrap-side="${safeWrapSide}"` : ''}${
        safePadding !== undefined ? ` data-berry-image-padding="${safePadding}"` : ''
      }${safeWidth !== undefined ? ` data-berry-image-width="${safeWidth}"` : ''}${
        safeWidth !== undefined ? ` data-berry-image-width-unit="${widthUnit}"` : ''
      }`
    : ''
  const dataAttrs = `data-berry-attachment-id="${id}" data-berry-url="${safeUrl}" data-berry-filename="${safeFilename}" data-berry-filesize="${opts.filesize}" data-berry-content-type="${safeType}" data-berry-preview-url="${safePreview}" data-berry-caption="${safeCaption}" data-berry-pending="${pending}"`
  const imageHTML = hasImageSource
    ? `<img class="berry-attachment-image" ${dataAttrs}${imageMetaAttrs} src="${safePreview || safeUrl}" alt="${safeAlt}"${imageWidthAttr}${imageHeightAttr}${imageStyleAttr} />`
    : ''
  const progressPart = opts.pending
    ? isImage
      ? `<progress max="100" value="${progress}" aria-label="Upload progress"></progress>`
      : `<div class="berry-attachment__meta"><span>${safeFilename}</span><span>${progress}%</span></div><progress max="100" value="${progress}"></progress>`
    : ''

  if (isImage && hasImageSource && !opts.pending) {
    if (safeLinkUrl !== undefined) {
      const linkAttrs = linkOpenInNewTab ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${safeLinkUrl}"${linkAttrs}>${imageHTML}</a>`
    }
    return imageHTML
  }

  const body = isImage
    ? imageHTML
    : `<a href="${safeUrl || '#'}" target="_blank" rel="noopener noreferrer">${safeFilename}</a>`
  const className = `berry-attachment${
    isImage ? ' berry-attachment--image' : ''
  }${opts.pending ? ' berry-attachment--pending' : ''}`
  const captionPart = isImage
    ? ''
    : `<figcaption contenteditable="true">${opts.caption ?? ''}</figcaption>`

  return `<figure class="${className}" ${dataAttrs}${imageMetaAttrs}><div class="berry-attachment__body"${bodyPaddingStyle}>${body}${progressPart}</div>${captionPart}</figure>`
}

function generateAttachmentId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

type TableCommand = Extract<
  EditorCommand,
  | 'tableAddRowAbove'
  | 'tableAddRowBelow'
  | 'tableDeleteRow'
  | 'tableAddColumnLeft'
  | 'tableAddColumnRight'
  | 'tableDeleteColumn'
  | 'tableDelete'
>

const BLOCK_SELECTOR = 'p,h1,h2,h3,blockquote,li,td,th'
const IMAGE_WIDTH_MIN_PX = 24
const IMAGE_WIDTH_MAX_PX = 4096
const IMAGE_WIDTH_MIN_PERCENT = 5
const IMAGE_WIDTH_MAX_PERCENT = 100
const IMAGE_PADDING_MIN = 0
const IMAGE_PADDING_MAX = 96

/**
 * Image width units supported by attachment rendering.
 */
export type ImageAttachmentWidthUnit = 'px' | 'percent'
/**
 * Horizontal alignment options for image attachments.
 */
export type ImageAttachmentAlign = 'left' | 'center' | 'right'
/**
 * Text wrap side used when image wrapping is enabled.
 */
export type ImageAttachmentWrapSide = 'left' | 'right'

/**
 * Resolved image attachment settings read from the DOM/editor state.
 */
export interface ImageAttachmentState {
  id: string
  width?: number
  widthUnit: ImageAttachmentWidthUnit
  padding?: number
  imageAlign?: ImageAttachmentAlign
  wrapText: boolean
  wrapSide: ImageAttachmentWrapSide
  linkUrl?: string
  linkOpenInNewTab?: boolean
  naturalWidth?: number
  naturalHeight?: number
}

/**
 * Partial image attachment update payload.
 */
export interface ImageAttachmentPatch {
  width?: number | null
  widthUnit?: ImageAttachmentWidthUnit
  padding?: number | null
  imageAlign?: ImageAttachmentAlign | null
  wrapText?: boolean
  wrapSide?: ImageAttachmentWrapSide
  linkUrl?: string | null
  linkOpenInNewTab?: boolean
  resetSize?: boolean
}

function uniqueElements(elements: HTMLElement[]): HTMLElement[] {
  const seen = new Set<HTMLElement>()
  const result: HTMLElement[] = []
  for (const element of elements) {
    if (seen.has(element)) continue
    seen.add(element)
    result.push(element)
  }
  return result
}

/**
 * Core DOM editing engine backing the React editor component.
 */
export class EditorEngine {
  private element: HTMLElement | null = null
  private html = ''
  private composing = false
  private lastSelection: SelectionRange | null = null
  private lastExpandedSelection: SelectionRange | null = null
  private lastDomSelection: Range | null = null
  private lastExpandedDomSelection: Range | null = null
  private options: EngineOptions
  private history = new HistoryStack<Snapshot>(snapshotEquals)

  constructor(options: EngineOptions = {}) {
    this.options = options
  }

  setCallbacks(options: EngineOptions): void {
    this.options = options
  }

  bind(element: HTMLElement): void {
    this.element = element
    this.element.addEventListener('input', this.handleInput)
    this.element.addEventListener('mouseup', this.handleSelectionChange)
    this.element.addEventListener('keyup', this.handleSelectionChange)
    document.addEventListener('selectionchange', this.handleSelectionChange)
    this.element.addEventListener('compositionstart', this.handleCompositionStart)
    this.element.addEventListener('compositionend', this.handleCompositionEnd)
    this.element.addEventListener('focus', this.handleFocus)
    this.element.addEventListener('blur', this.handleBlur)
  }

  unbind(): void {
    if (!this.element) return
    this.element.removeEventListener('input', this.handleInput)
    this.element.removeEventListener('mouseup', this.handleSelectionChange)
    this.element.removeEventListener('keyup', this.handleSelectionChange)
    document.removeEventListener('selectionchange', this.handleSelectionChange)
    this.element.removeEventListener('compositionstart', this.handleCompositionStart)
    this.element.removeEventListener('compositionend', this.handleCompositionEnd)
    this.element.removeEventListener('focus', this.handleFocus)
    this.element.removeEventListener('blur', this.handleBlur)
    this.element = null
  }

  focus(): void {
    this.element?.focus()
  }

  rememberSelectionForCommand(): void {
    const selectionToRemember = this.resolveSelectionForCommand()
    if (!selectionToRemember) return
    this.lastSelection = selectionToRemember
    if (selectionToRemember.anchor !== selectionToRemember.focus) {
      this.lastExpandedSelection = selectionToRemember
    }
  }

  focusForCommand(): void {
    if (!this.element) return
    const selectionToRestore = this.resolveSelectionForCommand()
    this.element.focus()
    if (selectionToRestore) {
      setSelectionRange(this.element, selectionToRestore)
      this.lastSelection = selectionToRestore
      if (selectionToRestore.anchor !== selectionToRestore.focus) {
        this.lastExpandedSelection = selectionToRestore
      }
    }
  }

  blur(): void {
    this.element?.blur()
  }

  getHTML(): string {
    return this.html
  }

  loadHTML(nextHTML: string): void {
    this.history.clear()
    this.setHTML(nextHTML, false)
  }

  setHTML(nextHTML: string, addToHistory = true): void {
    if (!this.element) return
    const safeHTML = sanitizeHTML(nextHTML || '')
    const prevSnapshot = this.snapshot()
    this.element.innerHTML = safeHTML
    this.html = safeHTML
    if (addToHistory) {
      this.history.push(prevSnapshot)
    }
    this.options.onChange?.(this.html)
    this.handleSelectionChange()
  }

  getSelection(): SelectionRange | null {
    if (!this.element) return null
    return getSelectionRange(this.element)
  }

  setSelection(range: SelectionRange): void {
    if (!this.element) return
    setSelectionRange(this.element, range)
    this.lastSelection = range
    if (range.anchor !== range.focus) {
      this.lastExpandedSelection = range
    }
    this.options.onSelectionChange?.(this.getSelection())
  }

  canUndo(): boolean {
    return this.history.canUndo()
  }

  canRedo(): boolean {
    return this.history.canRedo()
  }

  undo(): void {
    if (!this.element) return
    const current = this.snapshot()
    const prev = this.history.undo(current)
    if (!prev) return
    this.element.innerHTML = prev.html
    this.html = prev.html
    if (prev.selection) {
      setSelectionRange(this.element, prev.selection)
    }
    this.options.onChange?.(this.html)
    this.options.onSelectionChange?.(prev.selection)
  }

  redo(): void {
    if (!this.element) return
    const current = this.snapshot()
    const next = this.history.redo(current)
    if (!next) return
    this.element.innerHTML = next.html
    this.html = next.html
    if (next.selection) {
      setSelectionRange(this.element, next.selection)
    }
    this.options.onChange?.(this.html)
    this.options.onSelectionChange?.(next.selection)
  }

  exec(command: EditorCommand, payload?: CommandPayload): void {
    if (!this.element) return

    if (command === 'undo') {
      this.undo()
      return
    }
    if (command === 'redo') {
      this.redo()
      return
    }

    this.focusForCommand()
    const before = this.snapshot()
    const handled = this.runCommand(command, payload)
    if (!handled) return
    this.commit(before)
  }

  insertAttachmentPlaceholder(file: File, options?: { previewUrl?: string }): string {
    const id = generateAttachmentId()
    const html = makeAttachmentHTML(id, {
      filename: file.name,
      filesize: file.size,
      contentType: file.type || 'application/octet-stream',
      ...(options?.previewUrl ? { previewUrl: options.previewUrl } : {}),
      pending: true,
      progress: 0
    })

    this.exec('insertHTML', { html })
    return id
  }

  setAttachmentProgress(id: string, progress: number): void {
    if (!this.element) return
    const figure = this.element.querySelector<HTMLElement>(`[data-berry-attachment-id="${id}"]`)
    if (!figure) return

    const safe = Math.max(0, Math.min(100, Math.round(progress)))
    const progressEl = figure.querySelector('progress')
    if (progressEl) {
      progressEl.value = safe
    }

    const labels = figure.querySelectorAll('.berry-attachment__meta span')
    if (labels[1]) {
      labels[1].textContent = `${safe}%`
    }
  }

  resolveAttachment(id: string, result: UploadResult): void {
    if (!this.element) return
    const figure = this.element.querySelector<HTMLElement>(`[data-berry-attachment-id="${id}"]`)
    if (!figure) return

    const html = makeAttachmentHTML(id, {
      filename: result.filename,
      filesize: result.filesize,
      contentType: result.contentType,
      url: result.url,
      pending: false,
      ...(result.previewUrl ? { previewUrl: result.previewUrl } : {}),
      ...(result.alt ? { alt: result.alt } : {})
    })

    const before = this.snapshot()
    figure.outerHTML = html
    this.commit(before)
  }

  failAttachment(id: string): void {
    if (!this.element) return
    const figure = this.element.querySelector<HTMLElement>(`[data-berry-attachment-id="${id}"]`)
    if (!figure) return
    figure.classList.remove('berry-attachment--pending')
    figure.classList.add('berry-attachment--error')
    const body = figure.querySelector('.berry-attachment__body')
    if (body) {
      body.insertAdjacentHTML(
        'beforeend',
        '<div class="berry-attachment__error">Upload failed</div>'
      )
    }
  }

  removeAttachment(id: string): void {
    if (!this.element) return
    const figure = this.element.querySelector<HTMLElement>(`[data-berry-attachment-id="${id}"]`)
    if (!figure) return
    const before = this.snapshot()
    figure.remove()
    this.commit(before)
  }

  getImageAttachmentState(attachmentId: string): ImageAttachmentState | null {
    const container = this.findImageAttachmentContainer(attachmentId)
    if (!container) return null
    return this.readImageAttachmentState(container)
  }

  updateImageAttachment(attachmentId: string, patch: ImageAttachmentPatch): boolean {
    const container = this.findImageAttachmentContainer(attachmentId)
    if (!container) return false
    const current = this.readImageAttachmentState(container)
    if (!current) return false

    const next: ImageAttachmentState = { ...current }

    if (patch.resetSize) {
      delete next.width
    }

    if (patch.widthUnit !== undefined) {
      next.widthUnit = patch.widthUnit
    }

    if (patch.width !== undefined) {
      if (patch.width === null) {
        delete next.width
      } else {
        if (!isSafeImageWidth(patch.width, next.widthUnit)) return false
        next.width = Math.round(clampImageWidth(patch.width, next.widthUnit) * 100) / 100
      }
    }

    if (patch.padding !== undefined) {
      if (patch.padding === null) {
        delete next.padding
      } else {
        if (!isSafeImagePadding(patch.padding)) return false
        next.padding = Math.round(patch.padding * 100) / 100
      }
    }

    if (patch.imageAlign !== undefined) {
      if (patch.imageAlign === null) {
        delete next.imageAlign
      } else {
        next.imageAlign = patch.imageAlign
      }
    }

    if (patch.wrapText !== undefined) {
      next.wrapText = patch.wrapText
    }

    if (patch.wrapSide !== undefined) {
      next.wrapSide = patch.wrapSide
    }

    if (next.wrapText && !next.wrapSide) {
      next.wrapSide = 'left'
    }
    if (!next.wrapText) {
      next.wrapSide = next.wrapSide || 'left'
    }

    if (patch.linkUrl !== undefined) {
      if (patch.linkUrl === null || !patch.linkUrl.trim()) {
        delete next.linkUrl
        delete next.linkOpenInNewTab
      } else {
        const normalizedLink = patch.linkUrl.trim()
        if (!isSafeLink(normalizedLink)) return false
        next.linkUrl = normalizedLink
        if (patch.linkOpenInNewTab === undefined && next.linkOpenInNewTab === undefined) {
          next.linkOpenInNewTab = true
        }
      }
    }

    if (patch.linkOpenInNewTab !== undefined) {
      next.linkOpenInNewTab = patch.linkOpenInNewTab
    }

    const before = this.snapshot()
    this.applyImageAttachmentState(container, next)
    this.commit(before)
    return true
  }

  isCommandActive(
    command: Extract<
      EditorCommand,
      'bold' | 'italic' | 'underline' | 'strike' | 'bullet' | 'number'
    >
  ): boolean {
    const map: Record<typeof command, string> = {
      bold: 'bold',
      italic: 'italic',
      underline: 'underline',
      strike: 'strikeThrough',
      bullet: 'insertUnorderedList',
      number: 'insertOrderedList'
    }
    const query = document.queryCommandState as ((name: string) => boolean) | undefined
    if (typeof query !== 'function') return false
    return query.call(document, map[command])
  }

  private snapshot(): Snapshot {
    return {
      html: this.html,
      selection: this.getSelection()
    }
  }

  private findImageAttachmentContainer(attachmentId: string): HTMLElement | null {
    if (!this.element) return null
    return this.element.querySelector<HTMLElement>(
      `[data-berry-attachment-id="${attachmentId}"][data-berry-content-type^="image/"]`
    )
  }

  private findAttachmentBody(container: HTMLElement): HTMLElement | null {
    for (const child of Array.from(container.children)) {
      if (child instanceof HTMLElement && child.classList.contains('berry-attachment__body')) {
        return child
      }
    }
    return null
  }

  private ensureAttachmentBody(container: HTMLElement): HTMLElement {
    const existing = this.findAttachmentBody(container)
    if (existing) return existing

    const body = document.createElement('div')
    body.className = 'berry-attachment__body'

    const figcaption = Array.from(container.children).find(
      (child) => child instanceof HTMLElement && child.tagName.toLowerCase() === 'figcaption'
    )

    const nodesToMove = Array.from(container.childNodes).filter((node) => node !== figcaption)
    for (const node of nodesToMove) {
      body.append(node)
    }

    if (figcaption) {
      container.insertBefore(body, figcaption)
    } else {
      container.append(body)
    }

    return body
  }

  private readImageAttachmentState(container: HTMLElement): ImageAttachmentState | null {
    const id = container.getAttribute('data-berry-attachment-id')
    if (!id) return null
    const image =
      container.tagName.toLowerCase() === 'img'
        ? (container as HTMLImageElement)
        : container.querySelector<HTMLImageElement>('img:not(.berry-emoji)')
    if (!image) return null

    const metadataTarget = container.tagName.toLowerCase() === 'figure' ? container : image
    const body =
      container.tagName.toLowerCase() === 'figure' ? this.findAttachmentBody(container) : null
    const widthAttr = parseNumericValue(metadataTarget.getAttribute('data-berry-image-width'))
    const widthUnitAttr = metadataTarget.getAttribute('data-berry-image-width-unit')
    let width: number | undefined
    let widthUnit: ImageAttachmentWidthUnit = 'px'

    if (widthAttr !== undefined && (widthUnitAttr === 'px' || widthUnitAttr === 'percent')) {
      if (isSafeImageWidth(widthAttr, widthUnitAttr)) {
        width = widthAttr
        widthUnit = widthUnitAttr
      }
    } else {
      const parsedStyle = parseImageWidthFromStyle(image.getAttribute('style'))
      if (parsedStyle) {
        width = parsedStyle.width
        widthUnit = parsedStyle.unit
      } else {
        const widthProp = parseNumericValue(image.getAttribute('width'))
        if (widthProp !== undefined && isSafeImageWidth(widthProp, 'px')) {
          width = widthProp
          widthUnit = 'px'
        }
      }
    }

    const paddingAttr = parseNumericValue(metadataTarget.getAttribute('data-berry-image-padding'))
    const paddingStyle = parseImagePaddingFromStyle(
      body?.style.padding ?? image.style.padding ?? null
    )
    const padding =
      paddingAttr !== undefined && isSafeImagePadding(paddingAttr)
        ? paddingAttr
        : paddingStyle !== undefined
          ? paddingStyle
          : undefined

    const imageAlignAttr = metadataTarget.getAttribute('data-berry-image-align')
    const imageAlign =
      imageAlignAttr === 'left' || imageAlignAttr === 'center' || imageAlignAttr === 'right'
        ? imageAlignAttr
        : undefined

    const wrapText = metadataTarget.getAttribute('data-berry-image-wrap') === 'true'
    const wrapSideAttr = metadataTarget.getAttribute('data-berry-image-wrap-side')
    const wrapSide: ImageAttachmentWrapSide = wrapSideAttr === 'right' ? 'right' : 'left'

    const anchor = image.closest('a')
    const linkUrl =
      anchor && (container.tagName.toLowerCase() !== 'figure' || container.contains(anchor))
        ? (anchor.getAttribute('href') ?? undefined)
        : undefined

    const naturalWidth = image.naturalWidth > 0 ? image.naturalWidth : undefined
    const naturalHeight = image.naturalHeight > 0 ? image.naturalHeight : undefined

    return {
      id,
      ...(width !== undefined ? { width } : {}),
      widthUnit,
      ...(padding !== undefined ? { padding } : {}),
      ...(imageAlign ? { imageAlign } : {}),
      wrapText,
      wrapSide,
      ...(linkUrl ? { linkUrl } : {}),
      ...(linkUrl ? { linkOpenInNewTab: anchor?.getAttribute('target') === '_blank' } : {}),
      ...(naturalWidth ? { naturalWidth } : {}),
      ...(naturalHeight ? { naturalHeight } : {})
    }
  }

  private setDataAttribute(
    element: HTMLElement,
    name: string,
    value: string | null | undefined
  ): void {
    if (value === undefined || value === null || value === '') {
      element.removeAttribute(name)
      return
    }
    element.setAttribute(name, value)
  }

  private applyImageAttachmentState(container: HTMLElement, state: ImageAttachmentState): void {
    const isFigure = container.tagName.toLowerCase() === 'figure'
    const body = isFigure ? this.ensureAttachmentBody(container) : null
    const image =
      container.tagName.toLowerCase() === 'img'
        ? (container as HTMLImageElement)
        : (body?.querySelector<HTMLImageElement>('img:not(.berry-emoji)') ??
          container.querySelector<HTMLImageElement>('img:not(.berry-emoji)'))
    if (!image) return
    if (isFigure) {
      container.classList.add('berry-attachment--image')
    } else {
      image.classList.add('berry-attachment-image')
    }

    const metadataTarget = isFigure ? container : image

    this.setDataAttribute(metadataTarget, 'data-berry-image-align', state.imageAlign ?? null)
    this.setDataAttribute(metadataTarget, 'data-berry-image-wrap', state.wrapText ? 'true' : null)
    this.setDataAttribute(metadataTarget, 'data-berry-image-wrap-side', state.wrapSide)

    if (state.padding !== undefined) {
      if (body) {
        body.style.padding = `${state.padding}px`
      } else {
        image.style.padding = `${state.padding}px`
      }
      this.setDataAttribute(metadataTarget, 'data-berry-image-padding', String(state.padding))
    } else {
      if (body) {
        body.style.removeProperty('padding')
      } else {
        image.style.removeProperty('padding')
      }
      this.setDataAttribute(metadataTarget, 'data-berry-image-padding', null)
    }

    if (state.width !== undefined) {
      const safeWidth = Math.round(clampImageWidth(state.width, state.widthUnit) * 100) / 100
      image.style.width = `${safeWidth}${state.widthUnit === 'percent' ? '%' : 'px'}`
      if (state.widthUnit === 'px') {
        image.setAttribute('width', String(Math.round(safeWidth)))
      } else {
        image.removeAttribute('width')
      }
      this.setDataAttribute(metadataTarget, 'data-berry-image-width', String(safeWidth))
      this.setDataAttribute(metadataTarget, 'data-berry-image-width-unit', state.widthUnit)
    } else {
      image.style.removeProperty('width')
      image.removeAttribute('width')
      this.setDataAttribute(metadataTarget, 'data-berry-image-width', null)
      this.setDataAttribute(metadataTarget, 'data-berry-image-width-unit', null)
    }

    const anchor = image.closest('a')
    const anchorInScope = anchor !== null && (!isFigure || container.contains(anchor))
    if (state.linkUrl) {
      const openInNewTab = state.linkOpenInNewTab !== false
      if (anchorInScope && anchor) {
        anchor.setAttribute('href', state.linkUrl)
        if (openInNewTab) {
          anchor.setAttribute('target', '_blank')
          anchor.setAttribute('rel', 'noopener noreferrer')
        } else {
          anchor.removeAttribute('target')
          anchor.removeAttribute('rel')
        }
      } else {
        const nextAnchor = document.createElement('a')
        nextAnchor.href = state.linkUrl
        if (openInNewTab) {
          nextAnchor.target = '_blank'
          nextAnchor.rel = 'noopener noreferrer'
        }
        image.replaceWith(nextAnchor)
        nextAnchor.append(image)
      }
    } else if (anchorInScope && anchor) {
      anchor.replaceWith(image)
    }
  }

  private runCommand(command: EditorCommand, payload?: CommandPayload): boolean {
    switch (command) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strike':
        return this.runInlineMarkCommand(command)
      case 'fontFamily': {
        const fontFamily = payload?.fontFamily?.trim() ?? ''
        if (!isSafeFontFamily(fontFamily)) return false
        return this.applyStyleToSelectedBlocks('font-family', fontFamily || null)
      }
      case 'fontSize': {
        const parsedSize = parseSafeFontSize(payload?.fontSize?.trim() ?? '')
        if (parsedSize === null) return false
        return this.applyStyleToCurrentBlockWithFallback('font-size', `${parsedSize}px`, {
          preferExpandedSelection: true
        })
      }
      case 'textColor':
      case 'highlightColor': {
        const isHighlightCommand = command === 'highlightColor'
        const color = payload?.color?.trim() ?? ''
        if (!isSafeHexColor(color)) return false
        const domRangeBeforeCommand = this.getSelectionRangeInEditor()?.cloneRange() ?? null
        const domFallbackRange =
          domRangeBeforeCommand && !domRangeBeforeCommand.collapsed
            ? domRangeBeforeCommand
            : this.lastExpandedDomSelection?.cloneRange() ?? null
        const selectionBeforeCommand = this.getSelection()
        const expandedSelectionBeforeCommand =
          selectionBeforeCommand && selectionBeforeCommand.anchor !== selectionBeforeCommand.focus
            ? selectionBeforeCommand
            : null
        const fallbackSelection = expandedSelectionBeforeCommand ?? this.lastExpandedSelection
        const finalizeHighlightCommand = (): void => {
          if (isHighlightCommand) {
            this.moveCaretOutsideHighlight()
          }
        }
        const restoreAndApplyInlineFallback = (): boolean => {
          this.restoreExpandedSelectionForInlineCommand(domFallbackRange, fallbackSelection)

          return this.applyInlineStyleToSelection(
            isHighlightCommand ? 'background-color' : 'color',
            color,
            { placeCaretOutsideStyle: isHighlightCommand }
          )
        }

        const beforeHTML = this.element?.innerHTML ?? ''
        const beforeSanitizedHTML = sanitizeHTML(beforeHTML)
        const executed = runBrowserCommand(command, payload)
        if (executed) {
          const afterHTML = this.element?.innerHTML ?? ''
          if (afterHTML !== beforeHTML) {
            const afterSanitizedHTML = sanitizeHTML(afterHTML)
            if (afterSanitizedHTML !== beforeSanitizedHTML) {
              finalizeHighlightCommand()
              return true
            }
            // Browser command changed markup, but sanitization strips it (e.g. <font color>).
            // Re-apply as safe inline style so color/highlight persists.
            if (!isHighlightCommand && this.convertLegacyColorFontsToSpans()) {
              finalizeHighlightCommand()
              return true
            }
            const restored = restoreAndApplyInlineFallback()
            if (restored) {
              finalizeHighlightCommand()
            }
            return restored
          }

          if (fallbackSelection) {
            const restored = restoreAndApplyInlineFallback()
            if (restored) {
              finalizeHighlightCommand()
            }
            return restored
          }

          const selection = window.getSelection()
          const collapsed = selection?.rangeCount ? selection.getRangeAt(0).collapsed : false
          if (collapsed) {
            finalizeHighlightCommand()
            return true
          }
        }

        const restored = restoreAndApplyInlineFallback()
        if (restored) {
          finalizeHighlightCommand()
        }
        return restored
      }
      case 'clearHighlight': {
        const domRangeBeforeCommand =
          this.getSelectionRangeInEditor()?.cloneRange() ?? this.lastDomSelection?.cloneRange() ?? null
        const selectionBeforeCommand = this.getSelection()
        const fallbackSelection = selectionBeforeCommand ?? this.lastSelection
        this.restoreExpandedSelectionForInlineCommand(domRangeBeforeCommand, fallbackSelection)
        return this.clearNearestHighlightAncestorAtCursor()
      }
      case 'link':
        return this.applyLink(payload)
      case 'lineSpacing': {
        const lineHeight = payload?.lineHeight?.trim() ?? ''
        if (!isSafeLineHeight(lineHeight)) return false
        return this.applyStyleToCurrentBlockWithFallback('line-height', lineHeight, {
          preferExpandedSelection: true
        })
      }
      case 'insertTable': {
        const rows = payload?.rows ?? 0
        const cols = payload?.cols ?? 0
        const bordered = payload?.bordered === true
        if (!isSafeTableDimension(rows) || !isSafeTableDimension(cols)) return false
        return this.insertTable(rows, cols, bordered)
      }
      case 'tableAddRowAbove':
      case 'tableAddRowBelow':
      case 'tableDeleteRow':
      case 'tableAddColumnLeft':
      case 'tableAddColumnRight':
      case 'tableDeleteColumn':
      case 'tableDelete':
        return this.runTableCommand(command)
      case 'insertText': {
        const executed = runBrowserCommand(command, payload)
        if (executed) return true
        const text = payload?.text ?? ''
        if (!text) return false
        this.insertTextFallback(text)
        return true
      }
      case 'insertHTML': {
        const html = payload?.html ?? ''
        if (!html) return false
        this.insertHTMLFallback(html)
        return true
      }
      case 'alignLeft':
      case 'alignCenter':
      case 'alignRight':
      case 'alignJustify': {
        const executed = runBrowserCommand(command, payload)
        if (executed) return true
        const styleValueByCommand: Record<typeof command, string> = {
          alignLeft: 'left',
          alignCenter: 'center',
          alignRight: 'right',
          alignJustify: 'justify'
        }
        return this.applyStyleToSelectedBlocks('text-align', styleValueByCommand[command])
      }
      default: {
        const executed = runBrowserCommand(command, payload)
        if (executed) return true
        return false
      }
    }
  }

  private runInlineMarkCommand(
    command: Extract<EditorCommand, 'bold' | 'italic' | 'underline' | 'strike'>
  ): boolean {
    if (!this.element) return false

    const domRangeBeforeCommand = this.getSelectionRangeInEditor()?.cloneRange() ?? null
    const domFallbackRange =
      domRangeBeforeCommand && !domRangeBeforeCommand.collapsed
        ? domRangeBeforeCommand
        : this.lastExpandedDomSelection?.cloneRange() ?? null
    const selectionBeforeCommand = this.getSelection()
    const expandedSelectionBeforeCommand =
      selectionBeforeCommand && selectionBeforeCommand.anchor !== selectionBeforeCommand.focus
        ? selectionBeforeCommand
        : null
    const fallbackSelection = expandedSelectionBeforeCommand ?? this.lastExpandedSelection
    const fallbackTagByCommand: Record<typeof command, 'strong' | 'em' | 'u' | 's'> = {
      bold: 'strong',
      italic: 'em',
      underline: 'u',
      strike: 's'
    }
    const restoreAndApplyInlineTagFallback = (): boolean => {
      this.restoreExpandedSelectionForInlineCommand(domFallbackRange, fallbackSelection)
      return this.applyInlineTagToSelection(fallbackTagByCommand[command])
    }

    const beforeHTML = this.element.innerHTML
    const beforeSanitizedHTML = sanitizeHTML(beforeHTML)
    const executed = runBrowserCommand(command)
    if (executed) {
      const afterHTML = this.element.innerHTML
      if (afterHTML !== beforeHTML) {
        const afterSanitizedHTML = sanitizeHTML(afterHTML)
        if (afterSanitizedHTML !== beforeSanitizedHTML) {
          return true
        }
        // Browser command changed markup, but sanitization strips it (e.g. span styles).
        const restored = restoreAndApplyInlineTagFallback()
        if (restored) {
          return true
        }
      }

      if (fallbackSelection) {
        const restored = restoreAndApplyInlineTagFallback()
        if (restored) {
          return true
        }
      }

      const selection = window.getSelection()
      const collapsed = selection?.rangeCount ? selection.getRangeAt(0).collapsed : false
      if (collapsed && this.isCommandActive(command)) {
        return true
      }
    }
    return restoreAndApplyInlineTagFallback()
  }

  private commit(before: Snapshot): void {
    if (!this.element) return
    const selectionBeforeSanitize = this.getSelection() ?? this.lastSelection
    const currentHTML = sanitizeHTML(this.element.innerHTML)
    if (currentHTML !== this.element.innerHTML) {
      this.element.innerHTML = currentHTML
      if (selectionBeforeSanitize) {
        setSelectionRange(this.element, selectionBeforeSanitize)
      }
    }

    if (before.html !== currentHTML) {
      this.history.push(before)
      this.html = currentHTML
      this.options.onChange?.(this.html)
    } else {
      this.html = currentHTML
    }

    this.handleSelectionChange()
  }

  private restoreSelectionIfNeeded(): void {
    if (!this.element) return
    const currentSelection = this.getSelection()
    if (currentSelection) {
      this.lastSelection = currentSelection
      return
    }

    if (!this.lastSelection) return
    this.focus()
    setSelectionRange(this.element, this.lastSelection)
  }

  private resolveSelectionForCommand(): SelectionRange | null {
    if (!this.element) return null
    const activeElement = document.activeElement
    const focusedInsideEditor =
      activeElement instanceof Node ? this.element.contains(activeElement) : false
    const liveSelection = this.getSelection()
    if (focusedInsideEditor) {
      return liveSelection ?? this.lastSelection
    }
    return this.lastSelection ?? liveSelection
  }

  private insertHTMLFallback(html: string): void {
    if (!this.element) return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    range.deleteContents()
    const fragment = range.createContextualFragment(html)
    const lastInsertedNode = fragment.lastChild
    range.insertNode(fragment)
    if (!lastInsertedNode) {
      selection.collapseToEnd()
      return
    }

    range.setStartAfter(lastInsertedNode)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  private insertTextFallback(text: string): void {
    if (!this.element) return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    range.deleteContents()
    const node = document.createTextNode(text)
    range.insertNode(node)
    range.setStartAfter(node)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  private getSelectionRangeInEditor(): Range | null {
    if (!this.element) return null
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const anchorNode = selection.anchorNode
    const focusNode = selection.focusNode
    if (!anchorNode || !focusNode) return null
    if (!this.element.contains(anchorNode) || !this.element.contains(focusNode)) return null
    return selection.getRangeAt(0)
  }

  private setSelectionAfterNode(node: Node): void {
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.setStartAfter(node)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  private setSelectionInsideTextNode(node: Text, offset: number): void {
    const selection = window.getSelection()
    if (!selection) return
    const clampedOffset = Math.max(0, Math.min(offset, node.data.length))
    const range = document.createRange()
    range.setStart(node, clampedOffset)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  private ensureWhitespaceAfterNodeAndPlaceCaret(node: Node): void {
    const parent = node.parentNode
    if (!parent) return

    const nextSibling = node.nextSibling
    if (nextSibling instanceof Text) {
      const leadingWhitespace = nextSibling.data.match(/^[\s\u00A0]+/)
      if (leadingWhitespace) {
        this.setSelectionInsideTextNode(nextSibling, leadingWhitespace[0].length)
        return
      }
    }

    const spacer = document.createTextNode('\u00A0')
    parent.insertBefore(spacer, nextSibling)
    this.setSelectionAfterNode(spacer)
  }

  private restoreExpandedSelectionForInlineCommand(
    domFallbackRange: Range | null,
    fallbackSelection: SelectionRange | null
  ): void {
    if (!this.element) return

    let restored = false
    if (domFallbackRange) {
      const selection = window.getSelection()
      if (selection) {
        try {
          selection.removeAllRanges()
          selection.addRange(domFallbackRange.cloneRange())
          const anchorNode = selection.anchorNode
          const focusNode = selection.focusNode
          restored =
            !!anchorNode &&
            !!focusNode &&
            this.element.contains(anchorNode) &&
            this.element.contains(focusNode)
        } catch {
          restored = false
        }
      }
    }

    if (!restored && fallbackSelection) {
      setSelectionRange(this.element, fallbackSelection)
    }
  }

  private moveCaretOutsideHighlight(): boolean {
    if (!this.element) return false
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    let moved = false
    let lastMovedHighlightedAncestor: Element | null = null
    for (let index = 0; index < 8; index += 1) {
      if (selection.rangeCount === 0) break
      const range = selection.getRangeAt(0)
      if (!range.collapsed) {
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      }

      const anchorNode = selection.anchorNode
      if (!anchorNode || !this.element.contains(anchorNode)) break
      const anchorElement =
        anchorNode.nodeType === Node.ELEMENT_NODE
          ? (anchorNode as Element)
          : anchorNode.parentElement
      if (!anchorElement) break

      const highlightedAncestor = anchorElement.closest('mark,[style*="background-color"]')
      if (!highlightedAncestor || !this.element.contains(highlightedAncestor)) break

      this.setSelectionAfterNode(highlightedAncestor)
      lastMovedHighlightedAncestor = highlightedAncestor
      moved = true
    }

    if (lastMovedHighlightedAncestor) {
      this.ensureWhitespaceAfterNodeAndPlaceCaret(lastMovedHighlightedAncestor)
    }

    return moved
  }

  private clearNearestHighlightAncestorAtCursor(): boolean {
    if (!this.element) return false
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const cursorRange = selection.getRangeAt(0).cloneRange()
    cursorRange.collapse(false)
    selection.removeAllRanges()
    selection.addRange(cursorRange)

    const marker = document.createTextNode('\u200B')
    cursorRange.insertNode(marker)

    try {
      const markerParent = marker.parentElement
      if (!markerParent || !this.element.contains(markerParent)) return false
      const highlightedAncestor = markerParent.closest('mark,[style*="background-color"]')
      if (!highlightedAncestor || !this.element.contains(highlightedAncestor)) return false
      return this.removeHighlightFromElement(highlightedAncestor)
    } finally {
      const activeSelection = window.getSelection()
      if (marker.isConnected && activeSelection) {
        const restoreRange = document.createRange()
        restoreRange.setStartBefore(marker)
        restoreRange.collapse(true)
        activeSelection.removeAllRanges()
        activeSelection.addRange(restoreRange)
      }
      marker.remove()
    }
  }

  private removeHighlightFromElement(element: Element): boolean {
    if (element.tagName.toLowerCase() === 'mark') {
      this.unwrapElementPreserveChildren(element)
      return true
    }
    if (!(element instanceof HTMLElement)) return false

    const hadBackgroundColor = element.style.getPropertyValue('background-color') !== ''
    if (hadBackgroundColor) {
      element.style.removeProperty('background-color')
    }
    const styleAttribute = element.getAttribute('style')
    if (styleAttribute !== null && styleAttribute.trim() === '') {
      element.removeAttribute('style')
    }
    if (element.tagName.toLowerCase() === 'span' && element.attributes.length === 0) {
      this.unwrapElementPreserveChildren(element)
      return true
    }

    return hadBackgroundColor
  }

  private unwrapElementPreserveChildren(element: Element): void {
    const parent = element.parentNode
    if (!parent) return
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element)
    }
    element.remove()
  }

  private applyLinkTarget(anchor: HTMLAnchorElement, openInNewTab: boolean): void {
    if (openInNewTab) {
      anchor.setAttribute('target', '_blank')
      anchor.setAttribute('rel', 'noopener noreferrer')
      return
    }
    anchor.removeAttribute('target')
    anchor.removeAttribute('rel')
  }

  private applyLink(payload?: CommandPayload): boolean {
    const url = payload?.url?.trim() ?? ''
    if (!url || !isSafeLink(url)) return false
    const openInNewTab = payload?.openInNewTab === true
    const providedText = payload?.text
    const hasCustomText = typeof providedText === 'string' && providedText.length > 0

    const range = this.getSelectionRangeInEditor()
    if (!range) return false

    if (hasCustomText) {
      const anchor = document.createElement('a')
      anchor.setAttribute('href', url)
      this.applyLinkTarget(anchor, openInNewTab)
      anchor.append(document.createTextNode(providedText))
      range.deleteContents()
      range.insertNode(anchor)
      this.setSelectionAfterNode(anchor)
      return true
    }

    const executed = runBrowserCommand('link', { url, openInNewTab })
    if (executed) return true
    if (range.collapsed) return false

    const anchor = document.createElement('a')
    anchor.setAttribute('href', url)
    this.applyLinkTarget(anchor, openInNewTab)

    try {
      range.surroundContents(anchor)
    } catch {
      const fragment = range.extractContents()
      if (!fragment.childNodes.length) return false
      anchor.append(fragment)
      range.insertNode(anchor)
    }

    this.setSelectionAfterNode(anchor)
    return true
  }

  private convertLegacyColorFontsToSpans(): boolean {
    if (!this.element) return false
    const legacyFonts = Array.from(this.element.querySelectorAll('font[color]'))
    if (!legacyFonts.length) return false

    let changed = false
    for (const font of legacyFonts) {
      const color = font.getAttribute('color')?.trim() ?? ''
      if (!isSafeHexColor(color)) continue

      const span = document.createElement('span')
      span.style.color = color
      while (font.firstChild) {
        span.append(font.firstChild)
      }
      font.replaceWith(span)
      changed = true
    }

    return changed
  }

  private applyInlineTagToSelection(tagName: 'strong' | 'em' | 'u' | 's'): boolean {
    if (!this.element) return false

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false
    if (!this.element.contains(selection.anchorNode) || !this.element.contains(selection.focusNode))
      return false

    const range = selection.getRangeAt(0)
    if (range.collapsed) return false

    const segments = this.collectTextSegmentsInRange(range)
    if (!segments.length) return false

    let endElement: HTMLElement | null = null

    // Process from end to start so DOM mutations do not invalidate earlier offsets.
    for (const seg of segments.slice().reverse()) {
      const { node, start, end } = seg

      const subRange = document.createRange()
      subRange.setStart(node, start)
      subRange.setEnd(node, end)

      const wrapper = document.createElement(tagName)
      try {
        subRange.surroundContents(wrapper)
      } catch {
        const fragment = subRange.extractContents()
        wrapper.append(fragment)
        subRange.insertNode(wrapper)
      }

      endElement ??= wrapper
    }

    if (!endElement) return false

    selection.removeAllRanges()
    const next = document.createRange()
    next.selectNodeContents(endElement)
    next.collapse(false)
    selection.addRange(next)

    return true
  }

  private applyInlineStyleToSelection(
    styleName: 'color' | 'background-color',
    value: string,
    options?: { placeCaretOutsideStyle?: boolean }
  ): boolean {
    if (!this.element) return false

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false
    if (!this.element.contains(selection.anchorNode) || !this.element.contains(selection.focusNode))
      return false

    const range = selection.getRangeAt(0)
    if (range.collapsed) return false

    const segments = this.collectTextSegmentsInRange(range)
    if (!segments.length) return false

    let endSpan: HTMLSpanElement | null = null

    // Process from end to start so DOM mutations do not invalidate earlier offsets.
    for (const seg of segments.slice().reverse()) {
      const { node, start, end } = seg

      const subRange = document.createRange()
      subRange.setStart(node, start)
      subRange.setEnd(node, end)

      const span = document.createElement('span')
      span.style.setProperty(styleName, value)

      try {
        subRange.surroundContents(span)
      } catch {
        const fragment = subRange.extractContents()
        span.append(fragment)
        subRange.insertNode(span)
      }

      endSpan ??= span
    }

    if (options?.placeCaretOutsideStyle) {
      this.ensureWhitespaceAfterNodeAndPlaceCaret(endSpan!)
      return true
    }

    selection.removeAllRanges()
    const next = document.createRange()
    next.selectNodeContents(endSpan!)
    next.collapse(false)
    selection.addRange(next)

    return true
  }

  private collectTextSegmentsInRange(
    range: Range
  ): Array<{ node: Text; start: number; end: number }> {
    if (!this.element) return []

    const root =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentNode
        : range.commonAncestorContainer

    if (!root) return []

    const segments: Array<{ node: Text; start: number; end: number }> = []

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!this.element || !this.element.contains(node)) return NodeFilter.FILTER_REJECT
        const text = node as Text
        if (!text.data || text.data.length === 0) return NodeFilter.FILTER_REJECT

        if (text.parentElement?.closest('[contenteditable="false"]'))
          return NodeFilter.FILTER_REJECT

        try {
          return range.intersectsNode(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        } catch {
          return NodeFilter.FILTER_REJECT
        }
      }
    })

    let current = walker.nextNode()
    while (current) {
      const text = current as Text
      let start = 0
      let end = text.data.length

      if (range.startContainer === text) start = range.startOffset
      if (range.endContainer === text) end = range.endOffset

      if (start < end) segments.push({ node: text, start, end })

      current = walker.nextNode()
    }

    return segments
  }

  private collectSelectedBlocks(): HTMLElement[] {
    if (!this.element) return []
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return []

    const range = selection.getRangeAt(0)
    const candidates = Array.from(this.element.querySelectorAll<HTMLElement>(BLOCK_SELECTOR))
    const intersected = candidates.filter((node) => {
      try {
        return range.intersectsNode(node)
      } catch {
        return false
      }
    })

    if (intersected.length) return uniqueElements(intersected)

    const anchor = selection.anchorNode
    if (!anchor) return []
    const element =
      anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement
    if (!element) return []
    const nearest = element.closest<HTMLElement>(BLOCK_SELECTOR)
    if (!nearest) return []
    if (!this.element.contains(nearest)) return []
    return [nearest]
  }

  private applyStyleToSelectedBlocks(
    styleName: 'text-align' | 'line-height' | 'font-size' | 'font-family',
    value: string | null
  ): boolean {
    const blocks = this.collectSelectedBlocks()
    if (!blocks.length) return false
    for (const block of blocks) {
      if (value === null || value === '') {
        block.style.removeProperty(styleName)
      } else {
        block.style.setProperty(styleName, value)
      }
    }
    return true
  }

  private getCurrentBlockFromSelection(): HTMLElement | null {
    if (!this.element) return null
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const node = selection.focusNode ?? selection.anchorNode
    if (!node || !this.element.contains(node)) return null
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
    if (!element) return null
    const nearest = element.closest<HTMLElement>(BLOCK_SELECTOR)
    if (!nearest || !this.element.contains(nearest)) return null
    return nearest
  }

  private applyStyleToCurrentBlock(
    styleName: 'text-align' | 'line-height' | 'font-size' | 'font-family',
    value: string | null
  ): boolean {
    const block = this.getCurrentBlockFromSelection()
    if (!block) return false
    if (value === null || value === '') {
      block.style.removeProperty(styleName)
    } else {
      block.style.setProperty(styleName, value)
    }
    return true
  }

  private applyStyleToCurrentBlockWithFallback(
    styleName: 'text-align' | 'line-height' | 'font-size' | 'font-family',
    value: string | null,
    options?: { preferExpandedSelection?: boolean }
  ): boolean {
    if (this.applyStyleToCurrentBlock(styleName, value)) {
      return true
    }
    if (!this.element) return false

    const fallbackSelection =
      (options?.preferExpandedSelection ? this.lastExpandedSelection : null) ?? this.lastSelection
    if (!fallbackSelection) return false

    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const shouldRestoreFocus =
      !!activeElement && activeElement !== this.element && !this.element.contains(activeElement)

    setSelectionRange(this.element, fallbackSelection)
    const applied = this.applyStyleToCurrentBlock(styleName, value)

    if (shouldRestoreFocus && activeElement && document.contains(activeElement)) {
      activeElement.focus()
    }

    return applied
  }

  private insertTable(rows: number, cols: number, bordered = false): boolean {
    const tableStyle = bordered ? ' style="border-collapse:collapse"' : ''
    const cellStyle = bordered ? ' style="border:1px solid #000000"' : ''
    const tableRows = Array.from(
      { length: rows },
      () => `<tr>${Array.from({ length: cols }, () => `<td${cellStyle}><br></td>`).join('')}</tr>`
    ).join('')
    const html = `<table${tableStyle}><tbody>${tableRows}</tbody></table><p><br></p>`
    const inserted = runBrowserCommand('insertHTML', { html })
    if (!inserted) {
      this.insertHTMLFallback(html)
    }
    return true
  }

  private runTableCommand(command: TableCommand): boolean {
    const cell = this.getCurrentTableCell()
    const table = cell?.closest('table')
    if (!table) return false
    const row = cell?.parentElement as HTMLTableRowElement | null
    if (!cell || !row) return false

    switch (command) {
      case 'tableAddRowAbove':
        return this.insertTableRow(row, cell.cellIndex, true)
      case 'tableAddRowBelow':
        return this.insertTableRow(row, cell.cellIndex, false)
      case 'tableDeleteRow':
        return this.deleteTableRow(row, table)
      case 'tableAddColumnLeft':
        return this.insertTableColumn(table, row, cell.cellIndex, true)
      case 'tableAddColumnRight':
        return this.insertTableColumn(table, row, cell.cellIndex, false)
      case 'tableDeleteColumn':
        return this.deleteTableColumn(table, row, cell.cellIndex)
      case 'tableDelete':
        return this.deleteTable(table)
      default:
        return false
    }
  }

  private getCurrentTableCell(): HTMLTableCellElement | null {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const anchor = selection.anchorNode
    if (!anchor) return null
    const element =
      anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement
    if (!element) return null
    const cell = element.closest('td,th')
    if (!cell) return null
    return cell as HTMLTableCellElement
  }

  private createTableCell(
    tagName: 'td' | 'th',
    options?: {
      border?: string
    }
  ): HTMLTableCellElement {
    const cell = document.createElement(tagName)
    const border = options?.border?.trim() ?? ''
    if (border) {
      cell.style.border = border
    }
    cell.append(document.createElement('br'))
    return cell
  }

  private insertTableRow(
    referenceRow: HTMLTableRowElement,
    activeCellIndex: number,
    insertAbove: boolean
  ): boolean {
    const section = referenceRow.parentElement
    if (!section) return false
    const localIndex = Array.from(section.children).indexOf(referenceRow)
    const cellCount = referenceRow.cells.length || 1
    const tagName = (referenceRow.cells[0]?.tagName.toLowerCase() ?? 'td') as 'td' | 'th'
    const row = document.createElement('tr')
    for (let i = 0; i < cellCount; i += 1) {
      const referenceCell =
        referenceRow.cells[Math.min(i, referenceRow.cells.length - 1)] ?? referenceRow.cells[0] ?? null
      const border = referenceCell?.style.border
      row.append(this.createTableCell(tagName, border ? { border } : undefined))
    }
    const targetIndex = insertAbove ? localIndex : localIndex + 1
    section.insertBefore(row, section.children[targetIndex] ?? null)

    const selectedCell = row.cells[Math.min(activeCellIndex, row.cells.length - 1)] ?? row.cells[0]
    if (selectedCell) {
      this.placeCursorInCell(selectedCell)
    }
    return true
  }

  private deleteTableRow(row: HTMLTableRowElement, table: HTMLTableElement): boolean {
    const section = row.parentElement
    if (!section) return false
    const localIndex = Array.from(section.children).indexOf(row)
    row.remove()

    const remainingRows = table.querySelectorAll('tr')
    if (!remainingRows.length) {
      return this.deleteTable(table)
    }

    const nextRow = section.children[localIndex] as HTMLTableRowElement | undefined
    const fallbackRow =
      (section.children[Math.max(0, localIndex - 1)] as HTMLTableRowElement | undefined) ?? nextRow
    const cell = fallbackRow?.cells[0]
    if (cell) {
      this.placeCursorInCell(cell)
    }
    return true
  }

  private insertTableColumn(
    table: HTMLTableElement,
    activeRow: HTMLTableRowElement,
    cellIndex: number,
    insertLeft: boolean
  ): boolean {
    const rows = Array.from(table.querySelectorAll('tr'))
    if (!rows.length) return false

    for (const row of rows) {
      const referenceIndex = insertLeft ? cellIndex : cellIndex + 1
      const referenceCell = row.cells[referenceIndex] ?? null
      const basisCell = row.cells[Math.min(cellIndex, row.cells.length - 1)]
      const tagName = (basisCell?.tagName.toLowerCase() ?? 'td') as 'td' | 'th'
      const border = basisCell?.style.border
      const nextCell = this.createTableCell(tagName, border ? { border } : undefined)
      row.insertBefore(nextCell, referenceCell)
    }

    const targetCellIndex = insertLeft ? cellIndex : cellIndex + 1
    const target = activeRow.cells[targetCellIndex] ?? activeRow.cells[activeRow.cells.length - 1]
    if (target) {
      this.placeCursorInCell(target)
    }
    return true
  }

  private deleteTableColumn(
    table: HTMLTableElement,
    activeRow: HTMLTableRowElement,
    cellIndex: number
  ): boolean {
    const rows = Array.from(table.querySelectorAll('tr'))
    if (!rows.length) return false

    for (const row of rows) {
      const cell = row.cells[cellIndex]
      if (cell) {
        cell.remove()
      }
    }

    const hasCells = rows.some((row) => row.cells.length > 0)
    if (!hasCells) {
      return this.deleteTable(table)
    }

    const nextIndex = Math.max(0, cellIndex - 1)
    const target = activeRow.cells[nextIndex] ?? activeRow.cells[0]
    if (target) {
      this.placeCursorInCell(target)
    }
    return true
  }

  private deleteTable(table: HTMLTableElement): boolean {
    const paragraph = document.createElement('p')
    paragraph.append(document.createElement('br'))
    table.insertAdjacentElement('afterend', paragraph)
    table.remove()
    this.placeCursorAtStart(paragraph)
    return true
  }

  private placeCursorInCell(cell: HTMLTableCellElement): void {
    const target = cell.firstChild ?? cell
    const range = document.createRange()
    range.selectNodeContents(target)
    range.collapse(true)
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(range)
  }

  private placeCursorAtStart(node: Node): void {
    const range = document.createRange()
    range.selectNodeContents(node)
    range.collapse(true)
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(range)
  }

  private handleInput = (): void => {
    if (this.composing) return
    this.commit(this.snapshot())
  }

  private handleSelectionChange = (): void => {
    const domRange = this.getSelectionRangeInEditor()
    if (domRange) {
      this.lastDomSelection = domRange.cloneRange()
      if (!domRange.collapsed) {
        this.lastExpandedDomSelection = domRange.cloneRange()
      }
    }

    const selection = this.getSelection()
    if (selection) {
      this.lastSelection = selection
      if (selection.anchor !== selection.focus) {
        this.lastExpandedSelection = selection
      }
    }
    this.options.onSelectionChange?.(selection)
  }

  private handleCompositionStart = (): void => {
    this.composing = true
  }

  private handleCompositionEnd = (): void => {
    this.composing = false
    this.commit(this.snapshot())
  }

  private handleFocus = (): void => {
    this.options.onFocus?.()
  }

  private handleBlur = (): void => {
    this.options.onBlur?.()
  }
}
