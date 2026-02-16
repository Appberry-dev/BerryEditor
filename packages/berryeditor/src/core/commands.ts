import {
  parseSafeFontFamily,
  parseSafeFontSizeValue,
  parseSafeLineHeightValue
} from './styleGuards'

/**
 * Editor actions supported by the browser command fallback layer.
 */
export type EditorCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'link'
  | 'unlink'
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'quote'
  | 'bullet'
  | 'number'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  | 'fontFamily'
  | 'fontSize'
  | 'textColor'
  | 'highlightColor'
  | 'clearHighlight'
  | 'lineSpacing'
  | 'insertHorizontalRule'
  | 'insertTable'
  | 'tableAddRowAbove'
  | 'tableAddRowBelow'
  | 'tableDeleteRow'
  | 'tableAddColumnLeft'
  | 'tableAddColumnRight'
  | 'tableDeleteColumn'
  | 'tableDelete'
  | 'insertText'
  | 'insertHTML'
  | 'removeFormat'
  | 'undo'
  | 'redo'

/**
 * Optional payload used by specific editor commands.
 */
export interface CommandPayload {
  url?: string
  openInNewTab?: boolean
  color?: string
  fontFamily?: string
  fontSize?: string
  lineHeight?: string
  rows?: number
  cols?: number
  bordered?: boolean
  text?: string
  html?: string
}

/**
 * Validates that a link uses an allowlisted protocol.
 */
export function isSafeLink(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://example.invalid')
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Validates a 3- or 6-digit hex color.
 */
export function isSafeHexColor(color: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)
}

/**
 * Validates line-height used by toolbar input.
 */
export function isSafeLineHeight(lineHeight: string): boolean {
  return parseSafeLineHeightValue(lineHeight) !== null
}

/**
 * Validates a font-family string against sanitizer constraints.
 */
export function isSafeFontFamily(fontFamily: string): boolean {
  const trimmed = fontFamily.trim()
  if (!trimmed) return true
  return parseSafeFontFamily(trimmed) !== null
}

/**
 * Parses a font-size string and returns the numeric px value when valid.
 */
export function parseSafeFontSize(fontSize: string): number | null {
  return parseSafeFontSizeValue(fontSize)
}

/**
 * Validates font-size input used by toolbar controls.
 */
export function isSafeFontSize(fontSize: string): boolean {
  return parseSafeFontSize(fontSize) !== null
}

/**
 * Validates table dimensions accepted by the toolbar matrix.
 */
export function isSafeTableDimension(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 10
}

/**
 * Executes an editor command via `document.execCommand` when available.
 */
export function runBrowserCommand(command: EditorCommand, payload?: CommandPayload): boolean {
  const exec = (name: string, showUI?: boolean, value?: string): boolean => {
    const commandFn = document.execCommand as
      | ((commandId: string, showUI?: boolean, value?: string) => boolean)
      | undefined
    if (typeof commandFn !== 'function') return false
    return commandFn.call(document, name, showUI, value)
  }

  switch (command) {
    case 'bold':
      return exec('bold')
    case 'italic':
      return exec('italic')
    case 'underline':
      return exec('underline')
    case 'strike':
      return exec('strikeThrough')
    case 'code':
      return exec('formatBlock', false, 'pre')
    case 'paragraph':
      return exec('formatBlock', false, 'p')
    case 'heading1':
      return exec('formatBlock', false, 'h1')
    case 'heading2':
      return exec('formatBlock', false, 'h2')
    case 'heading3':
      return exec('formatBlock', false, 'h3')
    case 'quote':
      return exec('formatBlock', false, 'blockquote')
    case 'bullet':
      return exec('insertUnorderedList')
    case 'number':
      return exec('insertOrderedList')
    case 'alignLeft':
      return exec('justifyLeft')
    case 'alignCenter':
      return exec('justifyCenter')
    case 'alignRight':
      return exec('justifyRight')
    case 'alignJustify':
      return exec('justifyFull')
    case 'fontFamily': {
      const fontFamily = payload?.fontFamily?.trim() ?? ''
      if (!fontFamily || !isSafeFontFamily(fontFamily)) return false
      exec('styleWithCSS', false, 'true')
      return exec('fontName', false, fontFamily)
    }
    case 'fontSize': {
      const fontSize = payload?.fontSize?.trim() ?? ''
      const numeric = parseSafeFontSize(fontSize)
      if (numeric === null) return false
      exec('styleWithCSS', false, 'true')
      return exec('fontSize', false, String(Math.max(1, Math.min(7, Math.round(numeric / 8)))))
    }
    case 'insertHorizontalRule':
      return exec('insertHorizontalRule')
    case 'removeFormat':
      return exec('removeFormat')
    case 'unlink':
      return exec('unlink')
    case 'link': {
      const url = payload?.url?.trim() ?? ''
      if (!url || !isSafeLink(url)) return false
      const linked = exec('createLink', false, url)
      if (!linked) return false
      const selection = window.getSelection()
      const anchorNode = selection?.anchorNode ?? null
      const anchorElement =
        anchorNode?.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode?.parentElement
      const link = anchorElement?.closest('a[href]') ?? null
      if (!link) return true
      if (payload?.openInNewTab) {
        link.setAttribute('target', '_blank')
        link.setAttribute('rel', 'noopener noreferrer')
      } else {
        link.removeAttribute('target')
        link.removeAttribute('rel')
      }
      return true
    }
    case 'textColor': {
      const color = payload?.color?.trim() ?? ''
      if (!isSafeHexColor(color)) return false
      exec('styleWithCSS', false, 'true')
      return exec('foreColor', false, color)
    }
    case 'highlightColor': {
      const color = payload?.color?.trim() ?? ''
      if (!isSafeHexColor(color)) return false
      exec('styleWithCSS', false, 'true')
      return exec('hiliteColor', false, color) || exec('backColor', false, color)
    }
    case 'insertText': {
      const text = payload?.text ?? ''
      if (!text) return false
      return exec('insertText', false, text)
    }
    case 'insertHTML': {
      const html = payload?.html ?? ''
      if (!html) return false
      return exec('insertHTML', false, html)
    }
    default:
      return false
  }
}
