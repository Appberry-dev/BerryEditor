import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  EditorEngine,
  type ImageAttachmentAlign,
  type ImageAttachmentPatch,
  type ImageAttachmentState,
  type ImageAttachmentWidthUnit,
  type ImageAttachmentWrapSide
} from '../core/editor_engine'
import { isSafeLink, type CommandPayload, type EditorCommand } from '../core/commands'
import { sanitizeHTML } from '../html/sanitize'
import { BerryToolbar } from './BerryToolbar'
import { replaceUnicodeEmojiInHTML, replaceUnicodeEmojiInPlainTextAsHTML } from './emojiAutoReplace'
import { appendEmojiRecentToStorage, DEFAULT_EMOJI_RECENT_LIMIT } from './emojiPickerRecents'
import { ImageContextBubble } from './ImageContextBubble'
import { TableContextBubble } from './TableContextBubble'
import { useBerryFontFamilies, useLatest } from './hooks'
import type {
  BerryEditorHandle,
  BerryEditorProps,
  DocumentAdapter,
  EmojiInsertPayload,
  ImageAdapter,
  SelectionRange,
  UploadResult
} from './types'

function htmlHasContent(html: string): boolean {
  if (!html.trim()) return false
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]+>/g, '').trim().length > 0
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const hasText = (doc.body.textContent ?? '').trim().length > 0
  const hasMedia = !!doc.body.querySelector(
    'img, figure, a[data-berry-attachment-id], [data-berry-attachment-id]'
  )
  return hasText || hasMedia
}

async function uploadFile(
  uploadAdapter: ImageAdapter | DocumentAdapter,
  file: File,
  callbacks: { onProgress: (value: number) => void; signal: AbortSignal }
): Promise<UploadResult> {
  return uploadAdapter.upload(file, {
    signal: callbacks.signal,
    setProgress: callbacks.onProgress
  })
}

type AttachmentMode = 'image' | 'document' | 'auto'
type TableBubbleRect = { left: number; top: number }
type ImageHandlesRect = { left: number; top: number; width: number; height: number }
type EditorMode = 'rich' | 'html'
type TableBubbleCommand = Extract<
  EditorCommand,
  | 'tableAddRowAbove'
  | 'tableAddRowBelow'
  | 'tableDeleteRow'
  | 'tableAddColumnLeft'
  | 'tableAddColumnRight'
  | 'tableDeleteColumn'
  | 'tableDelete'
>
type ResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const TABLE_BUBBLE_HORIZONTAL_PADDING = 28
const TABLE_BUBBLE_VERTICAL_OFFSET = 8
const IMAGE_BUBBLE_HORIZONTAL_PADDING = 32
const IMAGE_BUBBLE_VERTICAL_OFFSET = 10
const IMAGE_MIN_WIDTH_PX = 24
const IMAGE_MAX_WIDTH_PX = 4096
const IMAGE_MIN_WIDTH_PERCENT = 5
const IMAGE_MAX_WIDTH_PERCENT = 100
const TABLE_EDIT_COMMANDS = new Set<EditorCommand>([
  'tableAddRowAbove',
  'tableAddRowBelow',
  'tableDeleteRow',
  'tableAddColumnLeft',
  'tableAddColumnRight',
  'tableDeleteColumn',
  'tableDelete'
])
const HTML_SANITIZE_NOTICE = 'Unsafe HTML was removed before applying changes.'

function getImageWidthBounds(unit: ImageAttachmentWidthUnit): { min: number; max: number } {
  if (unit === 'percent') {
    return { min: IMAGE_MIN_WIDTH_PERCENT, max: IMAGE_MAX_WIDTH_PERCENT }
  }
  return { min: IMAGE_MIN_WIDTH_PX, max: IMAGE_MAX_WIDTH_PX }
}

function clampImageWidth(value: number, unit: ImageAttachmentWidthUnit): number {
  const bounds = getImageWidthBounds(unit)
  return Math.max(bounds.min, Math.min(bounds.max, value))
}

function getActiveTableCell(editorRoot: HTMLElement | null): HTMLTableCellElement | null {
  if (!editorRoot) return null
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const anchorNode = selection.anchorNode
  if (!anchorNode) return null
  const anchorElement =
    anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement
  if (!anchorElement || !editorRoot.contains(anchorElement)) return null
  const cell = anchorElement.closest('td,th')
  if (!cell || !editorRoot.contains(cell)) return null
  return cell as HTMLTableCellElement
}

function getActiveAttachmentImage(
  editorRoot: HTMLElement | null
): { attachmentId: string; image: HTMLImageElement } | null {
  if (!editorRoot) return null
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const anchorNode = selection.anchorNode
  if (!anchorNode) return null
  const anchorElement =
    anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement
  if (!anchorElement || !editorRoot.contains(anchorElement)) return null
  const imageSelector =
    'img[data-berry-attachment-id][data-berry-content-type^="image/"]:not(.berry-emoji)'
  const directImage = anchorElement.closest(imageSelector) as HTMLImageElement | null
  if (directImage && editorRoot.contains(directImage)) {
    const attachmentId = directImage.getAttribute('data-berry-attachment-id')
    if (!attachmentId) return null
    return { attachmentId, image: directImage }
  }

  const range = selection.getRangeAt(0)
  if (range.startContainer instanceof Element) {
    const maybeImage = range.startContainer.childNodes[range.startOffset]
    if (maybeImage instanceof HTMLImageElement && maybeImage.matches(imageSelector)) {
      const attachmentId = maybeImage.getAttribute('data-berry-attachment-id')
      if (!attachmentId) return null
      return { attachmentId, image: maybeImage }
    }
  }

  return null
}

function getImageByAttachmentId(
  editorRoot: HTMLElement,
  attachmentId: string
): HTMLImageElement | null {
  return editorRoot.querySelector<HTMLImageElement>(
    `img[data-berry-attachment-id="${attachmentId}"][data-berry-content-type^="image/"]:not(.berry-emoji)`
  )
}

function getImageResizeContainerWidth(editorRoot: HTMLElement, image: HTMLImageElement): number {
  const anchor = image.closest('a')
  const containerElement = anchor?.parentElement ?? image.parentElement ?? editorRoot
  const width = containerElement.getBoundingClientRect().width
  if (Number.isFinite(width) && width > 0) return width
  const editorWidth = editorRoot.getBoundingClientRect().width
  return Number.isFinite(editorWidth) && editorWidth > 0
    ? editorWidth
    : image.getBoundingClientRect().width
}

function getImageAttachmentIdFromPointerTarget(target: Element): string | null {
  const image = target.closest(
    'img[data-berry-attachment-id][data-berry-content-type^="image/"]:not(.berry-emoji)'
  ) as HTMLImageElement | null
  if (!image) return null
  const attachmentId = image.getAttribute('data-berry-attachment-id')
  if (!attachmentId) return null
  return attachmentId
}

function pickAdapter(
  mode: AttachmentMode,
  file: File,
  adapters: { imageAdapter: ImageAdapter | undefined; documentAdapter: DocumentAdapter | undefined }
): ImageAdapter | DocumentAdapter | null {
  if (mode === 'image') return adapters.imageAdapter ?? null
  if (mode === 'document') return adapters.documentAdapter ?? null
  if (file.type.startsWith('image/')) {
    return adapters.imageAdapter ?? null
  }
  return adapters.documentAdapter ?? null
}

/**
 * React rich-text editor component with attachment, emoji, macro, and HTML mode support.
 */
export const BerryEditor = forwardRef<BerryEditorHandle, BerryEditorProps>(function BerryEditor(
  {
    value,
    defaultValue = '',
    onChange,
    onHTMLSanitizeNotice,
    onSelectionChange,
    onFocus,
    onBlur,
    disabled,
    readOnly,
    required,
    name,
    placeholder = 'Start writing...',
    imageAdapter,
    documentAdapter,
    macroAdapter,
    linkPageOptions,
    linkPageOptions2,
    linkPageTabLabel,
    linkPageTab2Label,
    onSearchLinkPages,
    onSearchLinkPages2,
    emojiPicker,
    fontFamilyOptions,
    colorPicker,
    enableHTMLMode = true,
    showCategoryLabels = true,
    toolbarLayout,
    toolbarItems,
    toolbarLoading = false
  },
  ref
) {
  const editorElementRef = useRef<HTMLDivElement | null>(null)
  const editorFrameRef = useRef<HTMLDivElement | null>(null)
  const htmlEditorRef = useRef<HTMLTextAreaElement | null>(null)
  const formProxyRef = useRef<HTMLTextAreaElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const documentInputRef = useRef<HTMLInputElement | null>(null)
  const uploadAbortControllers = useRef<Map<string, AbortController>>(new Map())
  const engineRef = useRef<EditorEngine | null>(null)
  const blurFrameRef = useRef<number | null>(null)
  const resizeSessionRef = useRef<{
    attachmentId: string
    pointerId: number
    direction: 1 | -1
    widthUnit: ImageAttachmentWidthUnit
    startX: number
    startWidthPx: number
    containerWidthPx: number
    image: HTMLImageElement
  } | null>(null)
  const controlled = value !== undefined
  const [internalHTML, setInternalHTML] = useState(() => sanitizeHTML(defaultValue))
  const [mode, setMode] = useState<EditorMode>('rich')
  const [htmlDraft, setHTMLDraft] = useState('')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [isInTable, setIsInTable] = useState(false)
  const [tableBubbleRect, setTableBubbleRect] = useState<TableBubbleRect | null>(null)
  const [activeImageAttachmentId, setActiveImageAttachmentId] = useState<string | null>(null)
  const [activeImageState, setActiveImageState] = useState<ImageAttachmentState | null>(null)
  const [imageBubbleRect, setImageBubbleRect] = useState<TableBubbleRect | null>(null)
  const [imageHandlesRect, setImageHandlesRect] = useState<ImageHandlesRect | null>(null)
  const latestOnChange = useLatest(onChange)
  const latestOnHTMLSanitizeNotice = useLatest(onHTMLSanitizeNotice)
  const latestOnSelectionChange = useLatest(onSelectionChange)
  const latestOnFocus = useLatest(onFocus)
  const latestOnBlur = useLatest(onBlur)

  const sanitizedControlledValue = useMemo(
    () => (controlled ? sanitizeHTML(value ?? '') : ''),
    [controlled, value]
  )
  const currentHTML = controlled ? sanitizedControlledValue : internalHTML
  const initialHTMLRef = useRef(currentHTML)
  const htmlModeEnabled = enableHTMLMode !== false
  const isHTMLMode = htmlModeEnabled && mode === 'html'
  const blocked = !!disabled || !!readOnly

  const clearImageContext = useCallback(() => {
    setActiveImageAttachmentId(null)
    setActiveImageState(null)
    setImageBubbleRect(null)
    setImageHandlesRect(null)
  }, [])

  const updateImageContext = useCallback(
    (preferredAttachmentId?: string | null) => {
      if (blocked || isHTMLMode) {
        clearImageContext()
        return
      }

      const editorRoot = editorElementRef.current
      const frame = editorFrameRef.current
      if (!editorRoot || !frame) {
        clearImageContext()
        return
      }

      let target = getActiveAttachmentImage(editorRoot)
      if (!target) {
        const activeElement = document.activeElement
        const controlsFocused =
          activeElement instanceof Element &&
          !!activeElement.closest(
            '.berry-image-bubble, .berry-image-resize-box, .berry-toolbar, .berry-toolbar__flyout, .berry-toolbar__popover-content'
          )
        const fallbackId =
          preferredAttachmentId ?? (controlsFocused ? activeImageAttachmentId : null)
        if (fallbackId) {
          const image = getImageByAttachmentId(editorRoot, fallbackId)
          if (image) {
            target = { attachmentId: fallbackId, image }
          }
        }
      }

      if (!target) {
        clearImageContext()
        return
      }

      const imageState = engineRef.current?.getImageAttachmentState(target.attachmentId) ?? null
      if (!imageState) {
        clearImageContext()
        return
      }

      const frameRect = frame.getBoundingClientRect()
      const imageRect = target.image.getBoundingClientRect()
      const centerX = imageRect.left - frameRect.left + imageRect.width / 2
      const minLeft = IMAGE_BUBBLE_HORIZONTAL_PADDING
      const maxLeft = Math.max(minLeft, frame.clientWidth - IMAGE_BUBBLE_HORIZONTAL_PADDING)
      const left = Math.max(minLeft, Math.min(centerX, maxLeft))
      const top = Math.max(0, imageRect.top - frameRect.top - IMAGE_BUBBLE_VERTICAL_OFFSET)

      setActiveImageAttachmentId(target.attachmentId)
      setActiveImageState(imageState)
      setImageBubbleRect({ left, top })
      setImageHandlesRect({
        left: imageRect.left - frameRect.left,
        top: imageRect.top - frameRect.top,
        width: imageRect.width,
        height: imageRect.height
      })
    },
    [activeImageAttachmentId, blocked, clearImageContext, isHTMLMode]
  )

  const updateTableContext = useCallback(() => {
    if (blocked || isHTMLMode) {
      setIsInTable(false)
      setTableBubbleRect(null)
      return
    }

    const editorRoot = editorElementRef.current
    const frame = editorFrameRef.current
    const activeCell = getActiveTableCell(editorRoot)
    if (!editorRoot || !frame || !activeCell) {
      setIsInTable(false)
      setTableBubbleRect(null)
      return
    }

    const frameRect = frame.getBoundingClientRect()
    const cellRect = activeCell.getBoundingClientRect()
    const centerX = cellRect.left - frameRect.left + cellRect.width / 2
    const minLeft = TABLE_BUBBLE_HORIZONTAL_PADDING
    const maxLeft = Math.max(minLeft, frame.clientWidth - TABLE_BUBBLE_HORIZONTAL_PADDING)
    const left = Math.max(minLeft, Math.min(centerX, maxLeft))
    const top = Math.max(0, cellRect.top - frameRect.top - TABLE_BUBBLE_VERTICAL_OFFSET)

    setIsInTable(true)
    setTableBubbleRect({ left, top })
  }, [blocked, isHTMLMode])

  const engine = useMemo(() => {
    const engineInstance = new EditorEngine({
      onChange: (nextHTML) => {
        if (!controlled) {
          setInternalHTML(nextHTML)
        }
        latestOnChange.current?.(nextHTML)
        setCanUndo(engineInstance.canUndo())
        setCanRedo(engineInstance.canRedo())
      },
      onSelectionChange: (range) => {
        latestOnSelectionChange.current?.(range)
      },
      onFocus: () => {
        latestOnFocus.current?.()
      },
      onBlur: () => {
        if (!readOnly && !disabled) {
          const configuredEmojiInsertMode = emojiPicker?.insertMode ?? 'twemojiImage'
          const isTwemojiEnabled = emojiPicker?.useTwemoji !== false
          if (configuredEmojiInsertMode === 'twemojiImage' && isTwemojiEnabled) {
            const current = engineInstance.getHTML()
            if (current) {
              const twemojiBaseUrl = emojiPicker?.twemojiBaseUrl
              const emojiReplaceOptions = twemojiBaseUrl ? { twemojiBaseUrl } : undefined
              const transformed = replaceUnicodeEmojiInHTML(current, emojiReplaceOptions)
              if (transformed.replaced && transformed.html !== current) {
                engineInstance.setHTML(transformed.html, false)
                setCanUndo(engineInstance.canUndo())
                setCanRedo(engineInstance.canRedo())
              }
            }
          }
        }
        latestOnBlur.current?.()
        if (blurFrameRef.current !== null) {
          window.cancelAnimationFrame(blurFrameRef.current)
        }
        blurFrameRef.current = window.requestAnimationFrame(() => {
          blurFrameRef.current = null
          const activeElement = document.activeElement
          const keepImageContext =
            activeElement instanceof Element &&
            !!activeElement.closest(
              '.berry-image-bubble, .berry-image-resize-box, .berry-toolbar, .berry-toolbar__flyout, .berry-toolbar__popover-content'
            )
          if (keepImageContext) return
          setIsInTable(false)
          setTableBubbleRect(null)
          clearImageContext()
        })
      }
    })
    return engineInstance
  }, [
    clearImageContext,
    controlled,
    latestOnBlur,
    latestOnChange,
    latestOnFocus,
    latestOnSelectionChange,
    disabled,
    readOnly,
    emojiPicker?.insertMode,
    emojiPicker?.useTwemoji,
    emojiPicker?.twemojiBaseUrl
  ])

  useEffect(() => {
    engineRef.current = engine
    return () => {
      engineRef.current = null
    }
  }, [engine])

  useEffect(() => {
    const element = editorElementRef.current
    if (!element) return

    const controllers = uploadAbortControllers.current
    engine.bind(element)
    engine.loadHTML(initialHTMLRef.current)
    setCanUndo(engine.canUndo())
    setCanRedo(engine.canRedo())

    return () => {
      engine.unbind()
      controllers.forEach((controller) => controller.abort())
      controllers.clear()
    }
  }, [engine])

  useEffect(() => {
    if (!controlled) return
    if (isHTMLMode) return
    if (engine.getHTML() !== currentHTML) {
      engine.setHTML(currentHTML, false)
    }
  }, [controlled, currentHTML, engine, isHTMLMode])

  const commitHTMLDraft = useCallback((): string => {
    const safeHTML = sanitizeHTML(htmlDraft)
    const wasSanitized = safeHTML !== htmlDraft

    engine.setHTML(safeHTML, true)
    setCanUndo(engine.canUndo())
    setCanRedo(engine.canRedo())

    if (wasSanitized) {
      latestOnHTMLSanitizeNotice.current?.({
        changed: true,
        message: HTML_SANITIZE_NOTICE
      })
    }

    return safeHTML
  }, [engine, htmlDraft, latestOnHTMLSanitizeNotice])

  const toggleHTMLMode = useCallback(() => {
    if (!htmlModeEnabled) return
    if (blocked && !isHTMLMode) return

    if (!isHTMLMode) {
      setHTMLDraft(engine.getHTML())
      setMode('html')
      setIsInTable(false)
      setTableBubbleRect(null)
      clearImageContext()
      return
    }

    const safeHTML = commitHTMLDraft()
    setHTMLDraft(safeHTML)
    setMode('rich')
    updateTableContext()
    updateImageContext(activeImageAttachmentId)
    requestAnimationFrame(() => {
      engine.focusForCommand()
    })
  }, [
    activeImageAttachmentId,
    blocked,
    clearImageContext,
    commitHTMLDraft,
    engine,
    htmlModeEnabled,
    isHTMLMode,
    updateImageContext,
    updateTableContext
  ])

  useEffect(() => {
    const handleSelectionChange = () => {
      updateTableContext()
      updateImageContext()
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [updateImageContext, updateTableContext])

  useEffect(() => {
    if (!isInTable && !activeImageAttachmentId) return

    const handleViewportChange = () => {
      updateTableContext()
      updateImageContext(activeImageAttachmentId)
    }

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [activeImageAttachmentId, isInTable, updateImageContext, updateTableContext])

  useEffect(() => {
    if (!isHTMLMode) return
    htmlEditorRef.current?.focus()
  }, [isHTMLMode])

  useEffect(() => {
    if (!isHTMLMode) return
    if (htmlModeEnabled && !blocked) return

    const safeHTML = commitHTMLDraft()
    setHTMLDraft(safeHTML)
    setMode('rich')
    setIsInTable(false)
    setTableBubbleRect(null)
    clearImageContext()
  }, [blocked, clearImageContext, commitHTMLDraft, htmlModeEnabled, isHTMLMode])

  const runImagePatch = useCallback(
    (patch: ImageAttachmentPatch) => {
      if (!activeImageAttachmentId) return false
      const changed = engine.updateImageAttachment(activeImageAttachmentId, patch)
      if (!changed) return false
      setCanUndo(engine.canUndo())
      setCanRedo(engine.canRedo())
      engine.focus()
      updateImageContext(activeImageAttachmentId)
      return true
    },
    [activeImageAttachmentId, engine, updateImageContext]
  )

  const runImageToolbarCommand = useCallback(
    (command: EditorCommand, payload?: CommandPayload): boolean => {
      if (!activeImageAttachmentId || !activeImageState) return false

      if (command === 'alignLeft' || command === 'alignCenter' || command === 'alignRight') {
        const alignMap: Record<'alignLeft' | 'alignCenter' | 'alignRight', ImageAttachmentAlign> = {
          alignLeft: 'left',
          alignCenter: 'center',
          alignRight: 'right'
        }
        const align = alignMap[command]
        if (align === 'center') {
          return runImagePatch({ wrapText: false, imageAlign: 'center' })
        }
        if (activeImageState.wrapText) {
          const side: ImageAttachmentWrapSide = align === 'right' ? 'right' : 'left'
          return runImagePatch({ wrapText: true, wrapSide: side, imageAlign: align })
        }
        return runImagePatch({ imageAlign: align })
      }

      if (command === 'link') {
        const url = payload?.url?.trim() ?? ''
        if (!url || !isSafeLink(url)) return false
        const openInNewTab = payload?.openInNewTab
        return runImagePatch({
          linkUrl: url,
          ...(openInNewTab !== undefined ? { linkOpenInNewTab: openInNewTab } : {})
        })
      }

      if (command === 'unlink') {
        return runImagePatch({ linkUrl: null })
      }

      return false
    },
    [activeImageAttachmentId, activeImageState, runImagePatch]
  )

  const runCommand = useCallback(
    (command: EditorCommand, payload?: CommandPayload) => {
      if (runImageToolbarCommand(command, payload)) {
        return
      }

      engine.exec(command, payload)
      setCanUndo(engine.canUndo())
      setCanRedo(engine.canRedo())
      if (command === 'insertTable' || TABLE_EDIT_COMMANDS.has(command)) {
        updateTableContext()
      }
      updateImageContext(activeImageAttachmentId)
    },
    [
      activeImageAttachmentId,
      engine,
      runImageToolbarCommand,
      updateImageContext,
      updateTableContext
    ]
  )

  const handleTableCommand = useCallback(
    (command: TableBubbleCommand) => {
      runCommand(command)
    },
    [runCommand]
  )

  const handleImageWrapToggle = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        runImagePatch({ wrapText: false })
        return
      }
      const side: ImageAttachmentWrapSide =
        activeImageState?.wrapSide ?? (activeImageState?.imageAlign === 'right' ? 'right' : 'left')
      runImagePatch({ wrapText: true, wrapSide: side })
    },
    [activeImageState, runImagePatch]
  )

  const handleImageDelete = useCallback(() => {
    if (!activeImageAttachmentId) return
    engine.removeAttachment(activeImageAttachmentId)
    setCanUndo(engine.canUndo())
    setCanRedo(engine.canRedo())
    clearImageContext()
    engine.focus()
  }, [activeImageAttachmentId, clearImageContext, engine])

  const handleResizePointerMove = useCallback((event: PointerEvent) => {
    const session = resizeSessionRef.current
    if (!session) return
    if (event.pointerId !== session.pointerId) return

    event.preventDefault()
    const delta = (event.clientX - session.startX) * session.direction
    const widthPx = Math.round(clampImageWidth(session.startWidthPx + delta, 'px') * 100) / 100
    session.image.style.width = `${widthPx}px`

    const frame = editorFrameRef.current
    if (!frame) return
    const frameRect = frame.getBoundingClientRect()
    const imageRect = session.image.getBoundingClientRect()
    setImageHandlesRect({
      left: imageRect.left - frameRect.left,
      top: imageRect.top - frameRect.top,
      width: imageRect.width,
      height: imageRect.height
    })
    const centerX = imageRect.left - frameRect.left + imageRect.width / 2
    const minLeft = IMAGE_BUBBLE_HORIZONTAL_PADDING
    const maxLeft = Math.max(minLeft, frame.clientWidth - IMAGE_BUBBLE_HORIZONTAL_PADDING)
    const left = Math.max(minLeft, Math.min(centerX, maxLeft))
    const top = Math.max(0, imageRect.top - frameRect.top - IMAGE_BUBBLE_VERTICAL_OFFSET)
    setImageBubbleRect({ left, top })
  }, [])

  const handleResizePointerUp = useCallback(
    (event: PointerEvent) => {
      const session = resizeSessionRef.current
      if (!session) return
      if (event.pointerId !== session.pointerId) return

      event.preventDefault()
      window.removeEventListener('pointermove', handleResizePointerMove)
      resizeSessionRef.current = null

      const widthPx = session.image.getBoundingClientRect().width
      if (!Number.isFinite(widthPx) || widthPx <= 0) {
        updateImageContext(session.attachmentId)
        return
      }

      if (session.widthUnit === 'percent') {
        const percent =
          session.containerWidthPx > 0
            ? Math.round(
                clampImageWidth((widthPx / session.containerWidthPx) * 100, 'percent') * 100
              ) / 100
            : undefined
        if (percent !== undefined) {
          engine.updateImageAttachment(session.attachmentId, { width: percent })
        }
      } else {
        const width = Math.round(clampImageWidth(widthPx, 'px') * 100) / 100
        engine.updateImageAttachment(session.attachmentId, { width })
      }

      setCanUndo(engine.canUndo())
      setCanRedo(engine.canRedo())
      updateImageContext(session.attachmentId)
    },
    [engine, handleResizePointerMove, updateImageContext]
  )

  const handleImageResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, handle: ResizeHandle) => {
      if (blocked || isHTMLMode || !activeImageAttachmentId || !activeImageState) return
      const editorRoot = editorElementRef.current
      if (!editorRoot) return
      const image = getImageByAttachmentId(editorRoot, activeImageAttachmentId)
      if (!image) return

      const rect = image.getBoundingClientRect()
      if (!Number.isFinite(rect.width) || rect.width <= 0) return
      const containerWidth = getImageResizeContainerWidth(editorRoot, image)
      const direction: 1 | -1 = handle === 'top-left' || handle === 'bottom-left' ? -1 : 1

      event.preventDefault()
      event.stopPropagation()
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)

      resizeSessionRef.current = {
        attachmentId: activeImageAttachmentId,
        pointerId: event.pointerId,
        direction,
        widthUnit: activeImageState.widthUnit,
        startX: event.clientX,
        startWidthPx: rect.width,
        containerWidthPx: containerWidth,
        image
      }

      window.addEventListener('pointermove', handleResizePointerMove, { passive: false })
      window.addEventListener('pointerup', handleResizePointerUp, { passive: false, once: true })
      window.addEventListener('pointercancel', handleResizePointerUp, {
        passive: false,
        once: true
      })
    },
    [
      activeImageAttachmentId,
      activeImageState,
      blocked,
      handleResizePointerMove,
      handleResizePointerUp,
      isHTMLMode
    ]
  )

  useEffect(() => {
    return () => {
      if (blurFrameRef.current !== null) {
        window.cancelAnimationFrame(blurFrameRef.current)
      }
      window.removeEventListener('pointermove', handleResizePointerMove)
      window.removeEventListener('pointerup', handleResizePointerUp)
      window.removeEventListener('pointercancel', handleResizePointerUp)
    }
  }, [handleResizePointerMove, handleResizePointerUp])

  const handleEditorPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (blocked || isHTMLMode) return
      const target = event.target
      if (!(target instanceof Element)) return
      const attachmentId = getImageAttachmentIdFromPointerTarget(target)
      if (!attachmentId) return

      setActiveImageAttachmentId(attachmentId)
      requestAnimationFrame(() => {
        updateImageContext(attachmentId)
      })
    },
    [blocked, isHTMLMode, updateImageContext]
  )

  const prepareInsertAtCursor = useCallback(() => {
    engine.rememberSelectionForCommand()
  }, [engine])

  const pickImageFiles = useCallback(() => {
    engine.focusForCommand()
    imageInputRef.current?.click()
  }, [engine])

  const pickDocumentFiles = useCallback(() => {
    engine.focusForCommand()
    documentInputRef.current?.click()
  }, [engine])

  const attachFiles = useCallback(
    async (files: FileList | File[], mode: AttachmentMode): Promise<number> => {
      const list = Array.from(files)
      let uploadedCount = 0
      for (const file of list) {
        const adapter = pickAdapter(mode, file, { imageAdapter, documentAdapter })
        if (!adapter) continue

        uploadedCount += 1
        const placeholderPreviewUrl =
          file.type.startsWith('image/') &&
          typeof URL !== 'undefined' &&
          typeof URL.createObjectURL === 'function'
            ? URL.createObjectURL(file)
            : undefined
        const placeholderId = engine.insertAttachmentPlaceholder(file, {
          ...(placeholderPreviewUrl ? { previewUrl: placeholderPreviewUrl } : {})
        })
        const controller = new AbortController()
        uploadAbortControllers.current.set(placeholderId, controller)
        try {
          const result = await uploadFile(adapter, file, {
            signal: controller.signal,
            onProgress: (value) => engine.setAttachmentProgress(placeholderId, value)
          })
          engine.resolveAttachment(placeholderId, result)
        } catch {
          engine.failAttachment(placeholderId)
        } finally {
          uploadAbortControllers.current.delete(placeholderId)
          if (
            placeholderPreviewUrl &&
            typeof URL !== 'undefined' &&
            typeof URL.revokeObjectURL === 'function'
          ) {
            URL.revokeObjectURL(placeholderPreviewUrl)
          }
        }
      }
      setCanUndo(engine.canUndo())
      setCanRedo(engine.canRedo())
      return uploadedCount
    },
    [documentAdapter, engine, imageAdapter]
  )

  const handleImageInput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) return
      await attachFiles(event.target.files, 'image')
      event.target.value = ''
    },
    [attachFiles]
  )

  const handleDocumentInput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) return
      await attachFiles(event.target.files, 'document')
      event.target.value = ''
    },
    [attachFiles]
  )

  const handlePaste = useCallback(
    async (event: ClipboardEvent<HTMLDivElement>) => {
      if (readOnly || disabled) return
      const configuredEmojiInsertMode = emojiPicker?.insertMode ?? 'twemojiImage'
      const isTwemojiEnabled = emojiPicker?.useTwemoji !== false
      const shouldReplaceUnicodeEmoji =
        configuredEmojiInsertMode === 'twemojiImage' && isTwemojiEnabled
      const twemojiBaseUrl = emojiPicker?.twemojiBaseUrl
      const emojiReplaceOptions = twemojiBaseUrl ? { twemojiBaseUrl } : undefined
      const files = event.clipboardData.files
      if (files?.length) {
        const uploadedCount = await attachFiles(files, 'auto')
        if (uploadedCount > 0) {
          event.preventDefault()
          return
        }
      }

      const html = event.clipboardData.getData('text/html')
      if (html) {
        event.preventDefault()
        const safeHTML = sanitizeHTML(html)
        const transformedHTML = shouldReplaceUnicodeEmoji
          ? replaceUnicodeEmojiInHTML(safeHTML, emojiReplaceOptions).html
          : safeHTML
        engine.exec('insertHTML', { html: transformedHTML })
        return
      }

      if (!shouldReplaceUnicodeEmoji) return
      const text = event.clipboardData.getData('text/plain')
      if (!text) return

      const transformedText = replaceUnicodeEmojiInPlainTextAsHTML(text, emojiReplaceOptions)
      if (!transformedText.replaced) return

      event.preventDefault()
      engine.exec('insertHTML', { html: transformedText.html })
    },
    [
      attachFiles,
      disabled,
      emojiPicker?.insertMode,
      emojiPicker?.useTwemoji,
      emojiPicker?.twemojiBaseUrl,
      engine,
      readOnly
    ]
  )

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      if (readOnly || disabled) return
      if (event.dataTransfer.files.length) {
        const uploadedCount = await attachFiles(event.dataTransfer.files, 'auto')
        if (uploadedCount > 0) {
          event.preventDefault()
        }
      }
    },
    [attachFiles, disabled, readOnly]
  )

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }, [])

  const handleMacroInsert = useCallback(
    async (macroId: string): Promise<void> => {
      if (!macroAdapter) return
      const result = await macroAdapter.resolve(macroId)
      engine.exec('insertHTML', { html: sanitizeHTML(result.html) })
      setCanUndo(engine.canUndo())
      setCanRedo(engine.canRedo())
    },
    [engine, macroAdapter]
  )

  const trackInsertedEmoji = useCallback(
    (unicode: string): void => {
      if (emojiPicker?.persistRecents === false) return
      appendEmojiRecentToStorage(unicode, {
        recentLimit: Math.max(1, emojiPicker?.recentLimit ?? DEFAULT_EMOJI_RECENT_LIMIT)
      })
    },
    [emojiPicker?.persistRecents, emojiPicker?.recentLimit]
  )

  const handleEmojiInsert = useCallback(
    (value: string | EmojiInsertPayload) => {
      const configuredInsertMode = emojiPicker?.insertMode ?? 'twemojiImage'
      engine.focusForCommand()

      if (typeof value === 'string') {
        engine.exec('insertText', { text: value })
        setCanUndo(engine.canUndo())
        setCanRedo(engine.canRedo())
        trackInsertedEmoji(value)
        return
      }

      const insertMode = value.insertMode ?? configuredInsertMode
      if (insertMode === 'unicode' || !value.twemojiUrl) {
        engine.exec('insertText', { text: value.unicode })
        setCanUndo(engine.canUndo())
        setCanRedo(engine.canRedo())
        trackInsertedEmoji(value.unicode)
        return
      }

      const safeUnicode = value.unicode
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
      const safeSrc = value.twemojiUrl
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
      const html = `<img class="berry-emoji" draggable="false" alt="${safeUnicode}" data-berry-emoji="${safeUnicode}" src="${safeSrc}" />`
      engine.exec('insertHTML', { html })

      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        let nextNode: Node | null = null
        if (range.startContainer instanceof Text) {
          nextNode = range.startContainer.nextSibling
        } else if (range.startContainer instanceof Element) {
          nextNode = range.startContainer.childNodes[range.startOffset] ?? null
        }

        if (
          nextNode instanceof HTMLImageElement &&
          nextNode.classList.contains('berry-emoji') &&
          nextNode.getAttribute('data-berry-emoji') === value.unicode
        ) {
          const afterEmoji = document.createRange()
          afterEmoji.setStartAfter(nextNode)
          afterEmoji.collapse(true)
          selection.removeAllRanges()
          selection.addRange(afterEmoji)
        }
      }

      setCanUndo(engine.canUndo())
      setCanRedo(engine.canRedo())
      trackInsertedEmoji(value.unicode)
    },
    [emojiPicker?.insertMode, engine, trackInsertedEmoji]
  )

  const macroSearch = macroAdapter ? (query: string) => macroAdapter.search(query) : null
  const resolvedFontFamilyOptions = useBerryFontFamilies(fontFamilyOptions)
  const formHTML = useMemo(
    () => (isHTMLMode ? sanitizeHTML(htmlDraft) : currentHTML),
    [currentHTML, htmlDraft, isHTMLMode]
  )
  const hasFormContent = useMemo(() => htmlHasContent(formHTML), [formHTML])

  useEffect(() => {
    const proxy = formProxyRef.current
    if (!proxy) return

    if (!!required && !blocked && !hasFormContent) {
      proxy.setCustomValidity('Please fill out this field.')
      return
    }

    proxy.setCustomValidity('')
  }, [blocked, disabled, formHTML, hasFormContent, isHTMLMode, readOnly, required])

  useImperativeHandle(
    ref,
    (): BerryEditorHandle => ({
      focus: () => engine.focus(),
      blur: () => engine.blur(),
      getHTML: () => {
        if (!isHTMLMode) return engine.getHTML()
        const safeHTML = commitHTMLDraft()
        setHTMLDraft(safeHTML)
        setMode('rich')
        updateTableContext()
        updateImageContext(activeImageAttachmentId)
        return safeHTML
      },
      setHTML: (html: string) => {
        engine.setHTML(html)
        setCanUndo(engine.canUndo())
        setCanRedo(engine.canRedo())
        setIsInTable(false)
        setTableBubbleRect(null)
        clearImageContext()
        if (isHTMLMode) {
          setMode('rich')
          setHTMLDraft('')
        }
      },
      getSelection: (): SelectionRange | null => engine.getSelection(),
      setSelection: (range: SelectionRange) => engine.setSelection(range),
      exec: (command: string, payload?: unknown) =>
        engine.exec(command as EditorCommand, payload as CommandPayload),
      undo: () => engine.undo(),
      redo: () => engine.redo()
    }),
    [
      activeImageAttachmentId,
      clearImageContext,
      commitHTMLDraft,
      engine,
      isHTMLMode,
      updateImageContext,
      updateTableContext
    ]
  )

  return (
    <div
      className={`berry-shell${disabled ? ' is-disabled' : ''}${readOnly ? ' is-readonly' : ''}`}
    >
      <BerryToolbar
        disabled={!!disabled}
        readOnly={!!readOnly}
        canUndo={canUndo}
        canRedo={canRedo}
        onCommand={runCommand}
        onPrepareInsert={prepareInsertAtCursor}
        canInsertImage={!!imageAdapter}
        canInsertDocument={!!documentAdapter}
        onPickImage={pickImageFiles}
        onPickDocument={pickDocumentFiles}
        onInsertEmoji={handleEmojiInsert}
        onInsertMacro={handleMacroInsert}
        fontFamilyOptions={resolvedFontFamilyOptions}
        showFormattingControls={!isHTMLMode}
        showCategoryLabels={showCategoryLabels}
        showHTMLToggle={htmlModeEnabled}
        isHTMLMode={isHTMLMode}
        loading={toolbarLoading}
        onToggleHTMLMode={toggleHTMLMode}
        {...(colorPicker ? { colorPicker } : {})}
        {...(linkPageOptions !== undefined ? { linkPageOptions } : {})}
        {...(linkPageOptions2 !== undefined ? { linkPageOptions2 } : {})}
        {...(linkPageTabLabel !== undefined ? { linkPageTabLabel } : {})}
        {...(linkPageTab2Label !== undefined ? { linkPageTab2Label } : {})}
        {...(onSearchLinkPages ? { onSearchLinkPages } : {})}
        {...(onSearchLinkPages2 ? { onSearchLinkPages2 } : {})}
        {...(emojiPicker ? { emojiPicker } : {})}
        {...(macroSearch ? { onSearchMacros: macroSearch } : {})}
        {...(toolbarLayout ? { toolbarLayout } : {})}
        {...(toolbarItems ? { toolbarItems } : {})}
      />

      <div ref={editorFrameRef} className="berry-editor-frame">
        <div
          ref={editorElementRef}
          className="berry-editor"
          role="textbox"
          aria-multiline="true"
          aria-label="Rich text editor"
          data-placeholder={placeholder}
          contentEditable={!disabled && !readOnly}
          hidden={isHTMLMode}
          aria-hidden={isHTMLMode}
          suppressContentEditableWarning
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onPointerDown={handleEditorPointerDown}
        />
        {isHTMLMode ? (
          <textarea
            ref={htmlEditorRef}
            className="berry-html-editor"
            aria-label="HTML editor"
            value={htmlDraft}
            onChange={(event) => setHTMLDraft(event.target.value)}
            readOnly={blocked}
            spellCheck={false}
          />
        ) : null}
        <TableContextBubble
          visible={!blocked && !isHTMLMode && isInTable && !!tableBubbleRect}
          left={tableBubbleRect?.left ?? 0}
          top={tableBubbleRect?.top ?? 0}
          disabled={blocked}
          onCommand={handleTableCommand}
        />
        {!blocked && !isHTMLMode && activeImageState && imageHandlesRect ? (
          <div
            className="berry-image-resize-box"
            style={{
              left: imageHandlesRect.left,
              top: imageHandlesRect.top,
              width: imageHandlesRect.width,
              height: imageHandlesRect.height
            }}
          >
            {(
              [
                ['top-left', 'Resize image from top left corner'],
                ['top-right', 'Resize image from top right corner'],
                ['bottom-left', 'Resize image from bottom left corner'],
                ['bottom-right', 'Resize image from bottom right corner']
              ] as const
            ).map(([handle, label]) => (
              <button
                key={handle}
                type="button"
                className={`berry-image-resize-handle berry-image-resize-handle--${handle}`}
                aria-label={label}
                onPointerDown={(event) => handleImageResizeStart(event, handle)}
              />
            ))}
          </div>
        ) : null}
        <ImageContextBubble
          visible={!blocked && !isHTMLMode && !!activeImageState && !!imageBubbleRect}
          left={imageBubbleRect?.left ?? 0}
          top={imageBubbleRect?.top ?? 0}
          disabled={blocked}
          isWrapped={activeImageState?.wrapText ?? false}
          onToggleWrap={handleImageWrapToggle}
          onDelete={handleImageDelete}
        />
      </div>

      <input
        ref={imageInputRef}
        className="berry-hidden-input"
        type="file"
        accept={imageAdapter?.accept ?? 'image/*'}
        onChange={handleImageInput}
        multiple
        tabIndex={-1}
        aria-hidden="true"
      />

      <input
        ref={documentInputRef}
        className="berry-hidden-input"
        type="file"
        accept={documentAdapter?.accept ?? '.pdf,.doc,.docx,.txt,.rtf,.xlsx,.xls,.ppt,.pptx'}
        onChange={handleDocumentInput}
        multiple
        tabIndex={-1}
        aria-hidden="true"
      />

      {name ? (
        <textarea
          ref={formProxyRef}
          className="berry-form-proxy"
          name={name}
          value={formHTML}
          onChange={() => undefined}
          required={required}
          aria-hidden="true"
          tabIndex={-1}
          disabled={disabled}
          data-has-content={String(hasFormContent)}
        />
      ) : null}
    </div>
  )
})
