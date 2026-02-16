import * as Popover from '@radix-ui/react-popover'
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement
} from 'react'
import {
  isSafeHexColor,
  isSafeLineHeight,
  parseSafeFontSize,
  type CommandPayload,
  type EditorCommand
} from '../core/commands'
import { ColorPickerAdapterHost } from './ColorPickerAdapterHost'
import { DefaultBerryPickrColorPicker } from './DefaultBerryPickrColorPicker'
import { EmojiPicker } from './EmojiPicker'
import type {
  BerryToolbarCategoryKey,
  BerryToolbarItemKey,
  BerryToolbarItemsConfig,
  BerryToolbarLayout,
  ColorPickerKind,
  ColorPickerOptions,
  ColorPickerRenderProps,
  EmojiInsertPayload,
  EmojiPickerOptions,
  FontFamilyOption,
  LinkPageOption,
  MacroOption
} from './types'

/**
 * Props for the editor toolbar component.
 */
export interface BerryToolbarProps {
  disabled: boolean
  readOnly: boolean
  canUndo: boolean
  canRedo: boolean
  onCommand: (command: EditorCommand, payload?: CommandPayload) => void
  onPrepareInsert?: () => void
  canInsertImage: boolean
  canInsertDocument: boolean
  onPickImage: () => void
  onPickDocument: () => void
  onInsertEmoji: (value: string | EmojiInsertPayload) => void
  emojiPicker?: EmojiPickerOptions
  onSearchMacros?: (query: string) => Promise<MacroOption[]>
  onInsertMacro: (macroId: string) => Promise<void>
  linkPageOptions?: LinkPageOption[]
  linkPageOptions2?: LinkPageOption[]
  linkPageTabLabel?: string
  linkPageTab2Label?: string
  onSearchLinkPages?: (query: string) => Promise<LinkPageOption[]>
  onSearchLinkPages2?: (query: string) => Promise<LinkPageOption[]>
  fontFamilyOptions: FontFamilyOption[]
  colorPicker?: ColorPickerOptions
  showFormattingControls?: boolean
  showCategoryLabels?: boolean
  showHTMLToggle?: boolean
  isHTMLMode?: boolean
  onToggleHTMLMode?: () => void
  toolbarLayout?: BerryToolbarLayout
  toolbarItems?: BerryToolbarItemsConfig
  loading?: boolean
}

const COLOR_SWATCHES = [
  '#111111',
  '#E11D48',
  '#F97316',
  '#FACC15',
  '#22C55E',
  '#0EA5E9',
  '#6366F1',
  '#A855F7'
]

const MAX_TABLE_DIM = 10
const DEFAULT_TABLE_PREVIEW_ROWS = 2
const DEFAULT_TABLE_PREVIEW_COLS = 2
const DEFAULT_TOOLBAR_LAYOUT: Record<BerryToolbarCategoryKey, { row: number; order: number }> = {
  history: { row: 1, order: 1 },
  text: { row: 1, order: 2 },
  formatting: { row: 1, order: 3 },
  styles: { row: 2, order: 1 },
  paragraph: { row: 2, order: 2 },
  insert: { row: 2, order: 3 },
  mode: { row: 2, order: 4 }
}

const TOOLBAR_CATEGORY_ITEMS: Record<
  BerryToolbarCategoryKey,
  ReadonlyArray<BerryToolbarItemKey>
> = {
  history: ['undo', 'redo'],
  text: ['fontFamily', 'fontSize', 'lineSpacing'],
  formatting: [
    'bold',
    'italic',
    'underline',
    'strike',
    'textColor',
    'highlightColor',
    'clearFormatting'
  ],
  styles: ['styleSelect', 'blockQuote'],
  paragraph: [
    'bulletList',
    'numberedList',
    'alignLeft',
    'alignCenter',
    'alignRight',
    'alignJustify'
  ],
  insert: ['link', 'image', 'document', 'table', 'horizontalRule', 'emoji', 'macro'],
  mode: ['htmlToggle']
}

type ToolbarSkeletonBlockKind = 'button' | 'buttonWide' | 'input' | 'select'

const TOOLBAR_SKELETON_BLOCKS: Record<
  BerryToolbarCategoryKey,
  ReadonlyArray<ToolbarSkeletonBlockKind>
> = {
  history: ['button', 'button'],
  text: ['select', 'input', 'input'],
  formatting: ['button', 'button', 'button', 'button', 'button', 'button'],
  styles: ['select'],
  paragraph: ['button', 'button', 'button', 'button'],
  insert: ['button', 'button', 'button', 'button', 'button', 'button', 'button'],
  mode: ['buttonWide']
}

type LinkPageTabKey = 'pages1' | 'pages2'
type LinkTab = LinkPageTabKey | 'url'

interface LinkPageTabConfig {
  key: LinkPageTabKey
  label: string
  options: LinkPageOption[]
  onSearch?: (query: string) => Promise<LinkPageOption[]>
}

interface FlattenedLinkPage {
  id: string
  name: string
  href: string
  depth: number
  ancestorPath: string
}

function flattenLinkPages(
  options: LinkPageOption[],
  ancestors: string[] = [],
  depth = 0
): FlattenedLinkPage[] {
  const out: FlattenedLinkPage[] = []
  for (const option of options) {
    out.push({
      id: option.id,
      name: option.name,
      href: option.href,
      depth,
      ancestorPath: ancestors.join(' / ')
    })
    if (option.children?.length) {
      out.push(...flattenLinkPages(option.children, [...ancestors, option.name], depth + 1))
    }
  }
  return out
}

function dedupeFlattenedLinkPages(options: FlattenedLinkPage[]): FlattenedLinkPage[] {
  const seen = new Set<string>()
  const out: FlattenedLinkPage[] = []
  for (const option of options) {
    const key = option.id || `${option.href}|${option.name}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(option)
  }
  return out
}

function formatLinkPageSelectLabel(option: FlattenedLinkPage): string {
  const prefix = option.depth > 0 ? `${'-- '.repeat(option.depth)}` : ''
  const path = option.ancestorPath ? `${option.ancestorPath} / ` : ''
  return `${prefix}${option.name} (${path}${option.href})`
}

function clampTableDimension(value: number): number {
  return Math.max(1, Math.min(MAX_TABLE_DIM, Math.round(value)))
}

function resolveLayoutNumber(value: number | undefined, fallback: number, minimum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(minimum, Math.floor(value))
}

function ToolbarButton({
  icon,
  label,
  command,
  disabled,
  title,
  onClick
}: {
  icon: string
  label?: string
  command: EditorCommand
  disabled?: boolean
  title: string
  onClick: (command: EditorCommand) => void
}): ReactElement {
  return (
    <button
      type="button"
      className={`berry-toolbar__button${label ? ' berry-toolbar__button--with-text' : ''}`}
      aria-label={title}
      title={title}
      data-command={command}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onClick={() => onClick(command)}
    >
      <span className="berry-toolbar__material-icon" aria-hidden="true">
        {icon}
      </span>
      {label ? <span className="berry-toolbar__button-text">{label}</span> : null}
    </button>
  )
}

function BerryToolbarSkeletonGroup({
  categoryKey,
  showCategoryLabels
}: {
  categoryKey: BerryToolbarCategoryKey
  showCategoryLabels: boolean
}): ReactElement {
  return (
    <div className="berry-toolbar__group berry-toolbar__group--loading">
      <div className="berry-toolbar__group-controls berry-toolbar__group-controls--loading">
        {TOOLBAR_SKELETON_BLOCKS[categoryKey].map((kind, index) => (
          <span
            key={`${categoryKey}-skeleton-${kind}-${index}`}
            className={`berry-toolbar__skeleton-block berry-toolbar__skeleton-block--${kind}`}
          />
        ))}
      </div>
      {showCategoryLabels ? <span className="berry-toolbar__skeleton-label" /> : null}
    </div>
  )
}

/**
 * Rich-text toolbar with formatting, insert, and optional HTML mode controls.
 */
export function BerryToolbar({
  disabled,
  readOnly,
  canUndo,
  canRedo,
  onCommand,
  onPrepareInsert,
  canInsertImage,
  canInsertDocument,
  onPickImage,
  onPickDocument,
  onInsertEmoji,
  emojiPicker,
  onSearchMacros,
  onInsertMacro,
  linkPageOptions = [],
  linkPageOptions2 = [],
  linkPageTabLabel = 'Pages',
  linkPageTab2Label = 'Pages 2',
  onSearchLinkPages,
  onSearchLinkPages2,
  fontFamilyOptions,
  colorPicker,
  showFormattingControls = true,
  showCategoryLabels = true,
  showHTMLToggle = false,
  isHTMLMode = false,
  onToggleHTMLMode,
  toolbarLayout,
  toolbarItems,
  loading = false
}: BerryToolbarProps): ReactElement {
  const blocked = !!disabled || !!readOnly
  const emojiDisabled = blocked
  const macroDisabled = blocked || !onSearchMacros
  const htmlToggleDisabled = blocked || !onToggleHTMLMode

  const [showLinkInput, setShowLinkInput] = useState(false)
  const [showTextColor, setShowTextColor] = useState(false)
  const [showHighlightColor, setShowHighlightColor] = useState(false)
  const [showTableFlyout, setShowTableFlyout] = useState(false)
  const [showEmojiFlyout, setShowEmojiFlyout] = useState(false)
  const [showMacroFlyout, setShowMacroFlyout] = useState(false)

  const [linkValue, setLinkValue] = useState('')
  const [linkTextValue, setLinkTextValue] = useState('')
  const [linkOpenInNewTab, setLinkOpenInNewTab] = useState(false)
  const [linkTab, setLinkTab] = useState<LinkTab>('url')
  const [linkPageQuery, setLinkPageQuery] = useState('')
  const [linkPageAsyncOptionsByTab, setLinkPageAsyncOptionsByTab] = useState<
    Partial<Record<LinkPageTabKey, LinkPageOption[]>>
  >({})
  const [linkPageLoadingTab, setLinkPageLoadingTab] = useState<LinkPageTabKey | null>(null)
  const [selectedLinkPageKey, setSelectedLinkPageKey] = useState<string | null>(null)
  const linkInitialTextRef = useRef('')
  const linkHadExpandedSelectionRef = useRef(false)
  const [textColorValue, setTextColorValue] = useState('#111111')
  const [highlightColorValue, setHighlightColorValue] = useState('#FACC15')
  const [fontFamilyValue, setFontFamilyValue] = useState(fontFamilyOptions[0]?.value ?? '')
  const [fontSizeValue, setFontSizeValue] = useState('16')
  const [lineSpacingValue, setLineSpacingValue] = useState('1.5')

  const tableMatrixRef = useRef<HTMLDivElement | null>(null)
  const tableSkipClickRef = useRef(false)
  const fontSizeSelectionRef = useRef<Range | null>(null)
  const lineSpacingSelectionRef = useRef<Range | null>(null)
  const [tablePreviewRows, setTablePreviewRows] = useState(DEFAULT_TABLE_PREVIEW_ROWS)
  const [tablePreviewCols, setTablePreviewCols] = useState(DEFAULT_TABLE_PREVIEW_COLS)
  const [tableKeyboardRow, setTableKeyboardRow] = useState(DEFAULT_TABLE_PREVIEW_ROWS)
  const [tableKeyboardCol, setTableKeyboardCol] = useState(DEFAULT_TABLE_PREVIEW_COLS)
  const [tablePointerActive, setTablePointerActive] = useState(false)
  const [tableBordersEnabled, setTableBordersEnabled] = useState(false)

  useEffect(() => {
    if (fontFamilyOptions.some((option) => option.value === fontFamilyValue)) return
    setFontFamilyValue(fontFamilyOptions[0]?.value ?? '')
  }, [fontFamilyOptions, fontFamilyValue])

  const [macroQuery, setMacroQuery] = useState('')
  const [macroOptions, setMacroOptions] = useState<MacroOption[]>([])
  const [macroLoading, setMacroLoading] = useState(false)
  const [macroInsertingId, setMacroInsertingId] = useState<string | null>(null)
  const linkPageTabs = useMemo(() => {
    const tabs: LinkPageTabConfig[] = []
    if (linkPageOptions.length) {
      tabs.push({
        key: 'pages1',
        label: linkPageTabLabel,
        options: linkPageOptions,
        ...(onSearchLinkPages ? { onSearch: onSearchLinkPages } : {})
      })
    }
    if (linkPageOptions2.length) {
      tabs.push({
        key: 'pages2',
        label: linkPageTab2Label,
        options: linkPageOptions2,
        ...(onSearchLinkPages2 ? { onSearch: onSearchLinkPages2 } : {})
      })
    }
    return tabs
  }, [
    linkPageOptions,
    linkPageOptions2,
    linkPageTab2Label,
    linkPageTabLabel,
    onSearchLinkPages,
    onSearchLinkPages2
  ])
  const activeLinkPageTab =
    linkTab === 'url' ? null : (linkPageTabs.find((tab) => tab.key === linkTab) ?? null)

  useEffect(() => {
    if (!showMacroFlyout || !onSearchMacros) return
    let canceled = false
    setMacroLoading(true)
    void onSearchMacros(macroQuery)
      .then((options) => {
        if (canceled) return
        setMacroOptions(options)
      })
      .catch(() => {
        if (canceled) return
        setMacroOptions([])
      })
      .finally(() => {
        if (canceled) return
        setMacroLoading(false)
      })

    return () => {
      canceled = true
    }
  }, [macroQuery, onSearchMacros, showMacroFlyout])

  useEffect(() => {
    if (!showLinkInput || !activeLinkPageTab || !activeLinkPageTab.onSearch) {
      setLinkPageLoadingTab(null)
      return
    }
    let canceled = false
    const tabKey = activeLinkPageTab.key
    setLinkPageLoadingTab(tabKey)
    void activeLinkPageTab
      .onSearch(linkPageQuery)
      .then((options) => {
        if (canceled) return
        setLinkPageAsyncOptionsByTab((current) => ({ ...current, [tabKey]: options }))
      })
      .catch(() => {
        if (canceled) return
        setLinkPageAsyncOptionsByTab((current) => ({ ...current, [tabKey]: [] }))
      })
      .finally(() => {
        if (canceled) return
        setLinkPageLoadingTab((current) => (current === tabKey ? null : current))
      })

    return () => {
      canceled = true
    }
  }, [activeLinkPageTab, linkPageQuery, showLinkInput])

  const flattenedStaticLinkPages = useMemo(
    () => flattenLinkPages(activeLinkPageTab?.options ?? []),
    [activeLinkPageTab]
  )
  const flattenedAsyncLinkPages = useMemo(
    () =>
      activeLinkPageTab
        ? flattenLinkPages(linkPageAsyncOptionsByTab[activeLinkPageTab.key] ?? [])
        : [],
    [activeLinkPageTab, linkPageAsyncOptionsByTab]
  )
  const normalizedLinkPageQuery = linkPageQuery.trim().toLowerCase()
  const filteredLinkPageResults = useMemo(() => {
    if (!normalizedLinkPageQuery) return [] as FlattenedLinkPage[]
    const matchesQuery = (option: FlattenedLinkPage): boolean =>
      option.name.toLowerCase().includes(normalizedLinkPageQuery) ||
      option.href.toLowerCase().includes(normalizedLinkPageQuery) ||
      option.ancestorPath.toLowerCase().includes(normalizedLinkPageQuery)

    const local = flattenedStaticLinkPages.filter(matchesQuery)
    const remote = flattenedAsyncLinkPages.filter(matchesQuery)
    return dedupeFlattenedLinkPages([...local, ...remote])
  }, [flattenedAsyncLinkPages, flattenedStaticLinkPages, normalizedLinkPageQuery])
  const visibleLinkPageOptions = useMemo(
    () => (normalizedLinkPageQuery ? filteredLinkPageResults : flattenedStaticLinkPages),
    [filteredLinkPageResults, flattenedStaticLinkPages, normalizedLinkPageQuery]
  )
  const linkPageLoading = activeLinkPageTab ? linkPageLoadingTab === activeLinkPageTab.key : false

  const exec = (command: EditorCommand, payload?: CommandPayload): void => {
    onCommand(command, payload)
  }

  const resetLinkFlyoutState = (): void => {
    setLinkValue('')
    setLinkTextValue('')
    setLinkOpenInNewTab(false)
    setLinkTab('url')
    setLinkPageQuery('')
    setLinkPageAsyncOptionsByTab({})
    setLinkPageLoadingTab(null)
    setSelectedLinkPageKey(null)
    linkInitialTextRef.current = ''
    linkHadExpandedSelectionRef.current = false
  }

  const handleLinkPopoverChange = (open: boolean): void => {
    setShowLinkInput(open)
    if (!open) {
      resetLinkFlyoutState()
      return
    }

    onPrepareInsert?.()
    const selection = window.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    const hasExpandedSelection = !!range && !range.collapsed
    const selectedText = hasExpandedSelection ? (selection?.toString() ?? '').trim() : ''
    linkHadExpandedSelectionRef.current = hasExpandedSelection
    linkInitialTextRef.current = selectedText
    setLinkValue('')
    setLinkTextValue(selectedText)
    setLinkOpenInNewTab(false)
    setLinkTab(linkPageTabs[0]?.key ?? 'url')
    setLinkPageQuery('')
    setSelectedLinkPageKey(null)
    setLinkPageAsyncOptionsByTab({})
    setLinkPageLoadingTab(null)
  }

  const submitLink = (): void => {
    const url = linkValue.trim()
    if (!url) return

    const nextText = linkTextValue.trim()
    const initialText = linkInitialTextRef.current.trim()
    const hasExpandedSelection = linkHadExpandedSelectionRef.current
    const linkTextPayload =
      nextText.length > 0
        ? !hasExpandedSelection || nextText !== initialText
          ? nextText
          : undefined
        : hasExpandedSelection
          ? undefined
          : url

    exec('link', {
      url,
      openInNewTab: linkOpenInNewTab,
      ...(linkTextPayload ? { text: linkTextPayload } : {})
    })
    setShowLinkInput(false)
    resetLinkFlyoutState()
  }

  const switchLinkTab = (nextTab: LinkTab): void => {
    if (nextTab === linkTab) return
    setLinkTab(nextTab)
    setLinkPageQuery('')
  }

  const selectLinkPage = (tabKey: LinkPageTabKey, option: FlattenedLinkPage): void => {
    setSelectedLinkPageKey(`${tabKey}:${option.id}`)
    setLinkValue(option.href)
    setLinkTextValue(option.name)
    switchLinkTab(tabKey)
  }

  const applyTextColor = (value: string): boolean => {
    const color = value.trim()
    if (!isSafeHexColor(color)) return false
    exec('textColor', { color })
    setTextColorValue(color)
    setShowTextColor(false)
    return true
  }

  const applyHighlightColor = (value: string): boolean => {
    const color = value.trim()
    if (!isSafeHexColor(color)) return false
    exec('highlightColor', { color })
    setHighlightColorValue(color)
    setShowHighlightColor(false)
    return true
  }

  const applyLineSpacing = (value: string): void => {
    const nextValue = value.trim()
    if (!nextValue || !isSafeLineHeight(nextValue)) return
    exec('lineSpacing', { lineHeight: nextValue })
    setLineSpacingValue(nextValue)
  }

  const applyFontFamily = (value: string): void => {
    exec('fontFamily', { fontFamily: value })
    setFontFamilyValue(value)
  }

  const applyFontSize = (value: string): void => {
    const normalized = parseSafeFontSize(value)
    if (normalized === null) return
    const formatted = String(normalized)
    exec('fontSize', { fontSize: formatted })
    setFontSizeValue(formatted)
  }

  const rememberFontSizeSelection = (): void => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    fontSizeSelectionRef.current = range.cloneRange()
  }

  const restoreRememberedFontSizeSelection = (): void => {
    const rememberedRange = fontSizeSelectionRef.current
    if (!rememberedRange) return
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(rememberedRange.cloneRange())
    document.dispatchEvent(new Event('selectionchange'))
  }

  const rememberLineSpacingSelection = (): void => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    lineSpacingSelectionRef.current = range.cloneRange()
  }

  const restoreRememberedLineSpacingSelection = (): void => {
    const rememberedRange = lineSpacingSelectionRef.current
    if (!rememberedRange) return
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(rememberedRange.cloneRange())
    document.dispatchEvent(new Event('selectionchange'))
  }

  const resetTablePreview = (): void => {
    setTablePreviewRows(DEFAULT_TABLE_PREVIEW_ROWS)
    setTablePreviewCols(DEFAULT_TABLE_PREVIEW_COLS)
    setTableKeyboardRow(DEFAULT_TABLE_PREVIEW_ROWS)
    setTableKeyboardCol(DEFAULT_TABLE_PREVIEW_COLS)
    setTablePointerActive(false)
    tableSkipClickRef.current = false
  }

  const previewTableSize = (rows: number, cols: number): void => {
    const nextRows = clampTableDimension(rows)
    const nextCols = clampTableDimension(cols)
    setTablePreviewRows(nextRows)
    setTablePreviewCols(nextCols)
    setTableKeyboardRow(nextRows)
    setTableKeyboardCol(nextCols)
  }

  const focusTableCell = (row: number, col: number): void => {
    const matrix = tableMatrixRef.current
    if (!matrix) return
    const nextCell = matrix.querySelector<HTMLButtonElement>(
      `button[data-table-row="${row}"][data-table-col="${col}"]`
    )
    nextCell?.focus()
  }

  const insertTableWithSize = (rows: number, cols: number): void => {
    const nextRows = clampTableDimension(rows)
    const nextCols = clampTableDimension(cols)
    exec('insertTable', { rows: nextRows, cols: nextCols, bordered: tableBordersEnabled })
    setTablePointerActive(false)
    setShowTableFlyout(false)
  }

  const handleTableCellPointerDown = (
    rows: number,
    cols: number,
    event: PointerEvent<HTMLButtonElement>
  ): void => {
    if (blocked) return
    event.preventDefault()
    setTablePointerActive(true)
    previewTableSize(rows, cols)
  }

  const handleTableCellPointerEnter = (rows: number, cols: number): void => {
    if (!tablePointerActive || blocked) return
    previewTableSize(rows, cols)
  }

  const handleTableCellPointerUp = (
    rows: number,
    cols: number,
    event: PointerEvent<HTMLButtonElement>
  ): void => {
    if (!tablePointerActive || blocked) return
    setTablePointerActive(false)
    if (event.pointerType !== 'touch') return
    event.preventDefault()
    tableSkipClickRef.current = true
    insertTableWithSize(rows, cols)
  }

  const handleTableCellKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    rows: number,
    cols: number
  ): void => {
    if (blocked) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      insertTableWithSize(rows, cols)
      return
    }

    const offsetByKey: Record<string, { row: number; col: number }> = {
      ArrowUp: { row: -1, col: 0 },
      ArrowDown: { row: 1, col: 0 },
      ArrowLeft: { row: 0, col: -1 },
      ArrowRight: { row: 0, col: 1 }
    }
    const offset = offsetByKey[event.key]
    if (!offset) return

    event.preventDefault()
    const nextRows = clampTableDimension(rows + offset.row)
    const nextCols = clampTableDimension(cols + offset.col)
    previewTableSize(nextRows, nextCols)
    focusTableCell(nextRows, nextCols)
  }

  const handleMacroInsert = async (macroId: string): Promise<void> => {
    setMacroInsertingId(macroId)
    try {
      await onInsertMacro(macroId)
      setShowMacroFlyout(false)
      setMacroQuery('')
    } finally {
      setMacroInsertingId(null)
    }
  }

  const closeFormattingFlyouts = (): void => {
    setShowTextColor(false)
    setShowHighlightColor(false)
  }

  const colorSwatches = colorPicker?.swatches ?? COLOR_SWATCHES

  const createColorPickerRenderProps = (kind: ColorPickerKind): ColorPickerRenderProps => ({
    kind,
    value: kind === 'text' ? textColorValue : highlightColorValue,
    disabled: blocked,
    swatches: colorSwatches,
    onCommit: (hex: string) => {
      if (kind === 'text') {
        applyTextColor(hex)
      } else {
        applyHighlightColor(hex)
      }
    },
    ...(kind === 'highlight'
      ? {
          onClear: () => {
            exec('clearHighlight')
            setShowHighlightColor(false)
          }
        }
      : {}),
    onClose: () => {
      if (kind === 'text') {
        setShowTextColor(false)
      } else {
        setShowHighlightColor(false)
      }
    }
  })

  const renderDefaultColorPicker = (props: ColorPickerRenderProps): ReactElement => (
    <DefaultBerryPickrColorPicker
      value={props.value}
      disabled={props.disabled}
      swatches={props.swatches}
      onCommit={props.onCommit}
      onClear={props.onClear}
      onClose={props.onClose}
    />
  )

  const renderCategoryLabel = (label: string): ReactElement | null =>
    showCategoryLabels ? <span className="berry-toolbar__group-label">{label}</span> : null

  const resolveColorPickerNode = (kind: ColorPickerKind): ReactElement => {
    const pickerProps = createColorPickerRenderProps(kind)

    if (colorPicker?.render) {
      try {
        const customNode = colorPicker.render(pickerProps)
        if (customNode) return customNode
      } catch {
        // Fall back to built-in color picker UI.
      }
    }

    const fallbackNode = renderDefaultColorPicker(pickerProps)
    if (colorPicker?.adapter) {
      return (
        <ColorPickerAdapterHost
          adapter={colorPicker.adapter}
          fallback={fallbackNode}
          {...pickerProps}
        />
      )
    }

    return fallbackNode
  }

  const showOnlyItemSet = useMemo(() => {
    if (!toolbarItems?.showOnly?.length) return null
    return new Set(toolbarItems.showOnly)
  }, [toolbarItems?.showOnly])

  const hideOnlyItemSet = useMemo(
    () => new Set(toolbarItems?.hideOnly ?? []),
    [toolbarItems?.hideOnly]
  )

  const isToolbarItemVisible = (itemKey: BerryToolbarItemKey): boolean => {
    if (showOnlyItemSet && !showOnlyItemSet.has(itemKey)) return false
    if (hideOnlyItemSet.has(itemKey)) return false
    return true
  }

  const categoryHasVisibleItems = (categoryKey: BerryToolbarCategoryKey): boolean =>
    TOOLBAR_CATEGORY_ITEMS[categoryKey].some((itemKey) => isToolbarItemVisible(itemKey))

  const loadingCategories: Array<{ key: BerryToolbarCategoryKey; available: boolean }> = [
    { key: 'history', available: showFormattingControls && categoryHasVisibleItems('history') },
    { key: 'text', available: showFormattingControls && categoryHasVisibleItems('text') },
    {
      key: 'formatting',
      available: showFormattingControls && categoryHasVisibleItems('formatting')
    },
    { key: 'styles', available: showFormattingControls && categoryHasVisibleItems('styles') },
    {
      key: 'paragraph',
      available: showFormattingControls && categoryHasVisibleItems('paragraph')
    },
    { key: 'insert', available: showFormattingControls && categoryHasVisibleItems('insert') },
    { key: 'mode', available: showHTMLToggle && categoryHasVisibleItems('mode') }
  ]

  const loadingSortedCategories = loadingCategories
    .filter((category) => category.available)
    .map((category, index) => {
      const defaults = DEFAULT_TOOLBAR_LAYOUT[category.key]
      const override = toolbarLayout?.[category.key]
      return {
        ...category,
        index,
        visible: override?.visible !== false,
        row: resolveLayoutNumber(override?.row, defaults.row, 1),
        order: resolveLayoutNumber(override?.order, defaults.order, 0)
      }
    })
    .filter((category) => category.visible)
    .sort((a, b) => a.row - b.row || a.order - b.order || a.index - b.index)

  const loadingCategoriesByRow = new Map<number, typeof loadingSortedCategories>()
  loadingSortedCategories.forEach((category) => {
    const existing = loadingCategoriesByRow.get(category.row)
    if (existing) {
      existing.push(category)
      return
    }
    loadingCategoriesByRow.set(category.row, [category])
  })

  if (loading) {
    return (
      <div className="berry-toolbar berry-toolbar--loading" aria-hidden="true">
        {Array.from(loadingCategoriesByRow.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([row, rowCategories]) => (
            <div key={`toolbar-loading-row-${row}`} className="berry-toolbar__row" data-row={row}>
              {rowCategories.map((category) => (
                <BerryToolbarSkeletonGroup
                  key={`toolbar-loading-group-${category.key}`}
                  categoryKey={category.key}
                  showCategoryLabels={showCategoryLabels}
                />
              ))}
            </div>
          ))}
      </div>
    )
  }

  const historyCategory =
    isToolbarItemVisible('undo') || isToolbarItemVisible('redo') ? (
      <div className="berry-toolbar__group" aria-label="History controls">
        <div className="berry-toolbar__group-controls">
          {isToolbarItemVisible('undo') ? (
            <ToolbarButton
              icon="undo"
              label=""
              title="Undo"
              command="undo"
              disabled={blocked || !canUndo}
              onClick={exec}
            />
          ) : null}
          {isToolbarItemVisible('redo') ? (
            <ToolbarButton
              icon="redo"
              label=""
              title="Redo"
              command="redo"
              disabled={blocked || !canRedo}
              onClick={exec}
            />
          ) : null}
        </div>
        {renderCategoryLabel('History')}
      </div>
    ) : null

  const textCategory =
    isToolbarItemVisible('fontFamily') ||
    isToolbarItemVisible('fontSize') ||
    isToolbarItemVisible('lineSpacing') ? (
      <div className="berry-toolbar__group" aria-label="Text controls">
        <div className="berry-toolbar__group-controls">
          {isToolbarItemVisible('fontFamily') ? (
            <div className="berry-toolbar__input-with-icon">
              <span
                className="berry-toolbar__material-icon berry-toolbar__control-icon"
                aria-hidden="true"
              >
                font_download
              </span>
              <select
                className="berry-toolbar__select berry-toolbar__select--font-family berry-toolbar__select--with-icon"
                value={fontFamilyValue}
                disabled={blocked}
                onChange={(event) => applyFontFamily(event.target.value)}
                aria-label="Font family"
              >
                {fontFamilyOptions.map((option) => (
                  <option key={`${option.label}-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {isToolbarItemVisible('fontSize') ? (
            <div className="berry-toolbar__input-with-icon">
              <span
                className="berry-toolbar__material-icon berry-toolbar__control-icon"
                aria-hidden="true"
              >
                format_size
              </span>
              <input
                className="berry-toolbar__numeric-input berry-toolbar__numeric-input--with-icon"
                type="number"
                inputMode="decimal"
                min={8}
                max={96}
                step={1}
                value={fontSizeValue}
                onMouseDown={rememberFontSizeSelection}
                onFocus={rememberFontSizeSelection}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setFontSizeValue(nextValue)
                  restoreRememberedFontSizeSelection()
                  applyFontSize(nextValue)
                }}
                onBlur={() => {
                  fontSizeSelectionRef.current = null
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  restoreRememberedFontSizeSelection()
                  applyFontSize(fontSizeValue)
                }}
                disabled={blocked}
                aria-label="Font size in pixels"
                title="Font size"
              />
            </div>
          ) : null}
          {isToolbarItemVisible('lineSpacing') ? (
            <div className="berry-toolbar__input-with-icon">
              <span
                className="berry-toolbar__material-icon berry-toolbar__control-icon"
                aria-hidden="true"
              >
                format_line_spacing
              </span>
              <input
                className="berry-toolbar__numeric-input berry-toolbar__numeric-input--with-icon"
                type="number"
                inputMode="decimal"
                min={1}
                max={3}
                step={0.05}
                value={lineSpacingValue}
                onMouseDown={rememberLineSpacingSelection}
                onFocus={rememberLineSpacingSelection}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setLineSpacingValue(nextValue)
                  restoreRememberedLineSpacingSelection()
                  applyLineSpacing(nextValue)
                }}
                onBlur={() => {
                  lineSpacingSelectionRef.current = null
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  restoreRememberedLineSpacingSelection()
                  applyLineSpacing(lineSpacingValue)
                }}
                disabled={blocked}
                aria-label="Line spacing"
                title="Line spacing"
              />
            </div>
          ) : null}
        </div>
        {renderCategoryLabel('Text')}
      </div>
    ) : null

  const formattingCategory =
    isToolbarItemVisible('bold') ||
    isToolbarItemVisible('italic') ||
    isToolbarItemVisible('underline') ||
    isToolbarItemVisible('strike') ||
    isToolbarItemVisible('textColor') ||
    isToolbarItemVisible('highlightColor') ||
    isToolbarItemVisible('clearFormatting') ? (
      <div className="berry-toolbar__group" aria-label="Formatting controls">
        <div className="berry-toolbar__group-controls">
          {isToolbarItemVisible('bold') ? (
            <ToolbarButton
              icon="format_bold"
              label=""
              title="Bold"
              command="bold"
              disabled={blocked}
              onClick={exec}
            />
          ) : null}
          {isToolbarItemVisible('italic') ? (
            <ToolbarButton
              icon="format_italic"
              label=""
              title="Italic"
              command="italic"
              disabled={blocked}
              onClick={exec}
            />
          ) : null}
          {isToolbarItemVisible('underline') ? (
            <ToolbarButton
              icon="format_underlined"
              label=""
              title="Underline"
              command="underline"
              disabled={blocked}
              onClick={exec}
            />
          ) : null}
          {isToolbarItemVisible('strike') ? (
            <ToolbarButton
              icon="strikethrough_s"
              label=""
              title="Strikethrough"
              command="strike"
              disabled={blocked}
              onClick={exec}
            />
          ) : null}
          {isToolbarItemVisible('textColor') ? (
            <Popover.Root
              open={showTextColor}
              onOpenChange={(open) => {
                setShowTextColor(open)
                if (open) {
                  setShowHighlightColor(false)
                }
              }}
            >
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="berry-toolbar__button"
                  disabled={blocked}
                  aria-expanded={showTextColor}
                  aria-label="Text color"
                  title="Text color"
                  onMouseDown={(event) => {
                    event.preventDefault()
                  }}
                >
                  <span className="berry-toolbar__material-icon" aria-hidden="true">
                    format_color_text
                  </span>
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="berry-toolbar__flyout berry-toolbar__popover-content"
                  side="bottom"
                  align="start"
                  sideOffset={8}
                >
                  {showTextColor ? resolveColorPickerNode('text') : null}
                  <Popover.Arrow className="berry-toolbar__popover-arrow" />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          ) : null}
          {isToolbarItemVisible('highlightColor') ? (
            <Popover.Root
              open={showHighlightColor}
              onOpenChange={(open) => {
                setShowHighlightColor(open)
                if (open) {
                  setShowTextColor(false)
                }
              }}
            >
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="berry-toolbar__button"
                  disabled={blocked}
                  aria-expanded={showHighlightColor}
                  aria-label="Highlight color"
                  title="Highlight color"
                  onMouseDown={(event) => {
                    event.preventDefault()
                  }}
                >
                  <span className="berry-toolbar__material-icon" aria-hidden="true">
                    format_color_fill
                  </span>
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="berry-toolbar__flyout berry-toolbar__popover-content"
                  side="bottom"
                  align="start"
                  sideOffset={8}
                >
                  {showHighlightColor ? resolveColorPickerNode('highlight') : null}
                  <Popover.Arrow className="berry-toolbar__popover-arrow" />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          ) : null}
          {isToolbarItemVisible('clearFormatting') ? (
            <ToolbarButton
              icon="ink_eraser"
              label=""
              title="Clear formatting"
              command="removeFormat"
              disabled={blocked}
              onClick={exec}
            />
          ) : null}
        </div>
        {renderCategoryLabel('Formatting')}
      </div>
    ) : null

  const stylesCategory =
    isToolbarItemVisible('styleSelect') || isToolbarItemVisible('blockQuote') ? (
      <div
        className="berry-toolbar__group berry-toolbar__group--select"
        aria-label="Paragraph styles"
      >
        <div className="berry-toolbar__group-controls">
          {isToolbarItemVisible('styleSelect') ? (
            <div className="berry-toolbar__input-with-icon">
              <span
                className="berry-toolbar__material-icon berry-toolbar__control-icon"
                aria-hidden="true"
              >
                style
              </span>
              <select
                className="berry-toolbar__select berry-toolbar__select--with-icon"
                defaultValue="paragraph"
                disabled={blocked}
                onChange={(event) => {
                  const value = event.target.value as EditorCommand
                  exec(value)
                }}
                aria-label="Paragraph and headings"
              >
                <option value="paragraph">Normal</option>
                <option value="heading1">Heading 1</option>
                <option value="heading2">Heading 2</option>
                <option value="heading3">Heading 3</option>
                <option value="quote">Quote</option>
              </select>
            </div>
          ) : null}
          {isToolbarItemVisible('blockQuote') ? (
            <ToolbarButton
              icon="format_quote"
              label=""
              title="Block quote"
              command="quote"
              disabled={blocked}
              onClick={exec}
            />
          ) : null}
        </div>
        {renderCategoryLabel('Styles')}
      </div>
    ) : null

  const paragraphCategory =
    isToolbarItemVisible('bulletList') ||
    isToolbarItemVisible('numberedList') ||
    isToolbarItemVisible('alignLeft') ||
    isToolbarItemVisible('alignCenter') ||
    isToolbarItemVisible('alignRight') ||
    isToolbarItemVisible('alignJustify') ? (
      <div
        className="berry-toolbar__group berry-toolbar__group--select"
        aria-label="Paragraph layout"
      >
        <div className="berry-toolbar__group-controls">
          {isToolbarItemVisible('bulletList') ? (
            <ToolbarButton
              icon="format_list_bulleted"
              label=""
              title="Bulleted list"
              command="bullet"
              disabled={blocked}
              onClick={exec}
            />
          ) : null}
          {isToolbarItemVisible('numberedList') ? (
            <ToolbarButton
              icon="format_list_numbered"
              label=""
              title="Numbered list"
              command="number"
              disabled={blocked}
              onClick={exec}
            />
          ) : null}
          {isToolbarItemVisible('alignLeft') ? (
            <ToolbarButton
              icon="format_align_left"
              label=""
              title="Align left"
              command="alignLeft"
              disabled={blocked}
              onClick={exec}
            />
          ) : null}
          {isToolbarItemVisible('alignCenter') ? (
            <ToolbarButton
              icon="format_align_center"
              label=""
              title="Align center"
              command="alignCenter"
              disabled={blocked}
              onClick={exec}
            />
          ) : null}
          {isToolbarItemVisible('alignRight') ? (
            <ToolbarButton
              icon="format_align_right"
              label=""
              title="Align right"
              command="alignRight"
              disabled={blocked}
              onClick={exec}
            />
          ) : null}
          {isToolbarItemVisible('alignJustify') ? (
            <ToolbarButton
              icon="format_align_justify"
              label=""
              title="Justify"
              command="alignJustify"
              disabled={blocked}
              onClick={exec}
            />
          ) : null}
        </div>
        {renderCategoryLabel('Paragraph')}
      </div>
    ) : null

  const hasInsertItems =
    isToolbarItemVisible('link') ||
    isToolbarItemVisible('image') ||
    isToolbarItemVisible('document') ||
    isToolbarItemVisible('table') ||
    isToolbarItemVisible('horizontalRule') ||
    isToolbarItemVisible('emoji') ||
    isToolbarItemVisible('macro')

  const insertCategory = hasInsertItems ? (
    <div className="berry-toolbar__group" aria-label="Insert tools">
      <div className="berry-toolbar__group-controls">
        {isToolbarItemVisible('link') ? (
          <Popover.Root open={showLinkInput} onOpenChange={handleLinkPopoverChange}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="berry-toolbar__button"
                disabled={blocked}
                aria-expanded={showLinkInput}
                aria-label="Insert or edit link"
                title="Insert or edit link"
                onMouseDown={(event) => {
                  onPrepareInsert?.()
                  event.preventDefault()
                }}
              >
                <span className="berry-toolbar__material-icon" aria-hidden="true">
                  link
                </span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="berry-toolbar__flyout berry-toolbar__popover-content berry-toolbar__flyout--link"
                side="bottom"
                align="start"
                sideOffset={8}
              >
                <div className="berry-toolbar__tabs" role="tablist" aria-label="Link source">
                  {linkPageTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      className={`berry-toolbar__tab${linkTab === tab.key ? ' is-active' : ''}`}
                      aria-selected={linkTab === tab.key}
                      onClick={() => switchLinkTab(tab.key)}
                      disabled={blocked}
                    >
                      {tab.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="tab"
                    className={`berry-toolbar__tab${linkTab === 'url' ? ' is-active' : ''}`}
                    aria-selected={linkTab === 'url'}
                    onClick={() => switchLinkTab('url')}
                    disabled={blocked}
                  >
                    URL
                  </button>
                </div>

                {linkTab === 'url' || !activeLinkPageTab ? (
                  <input
                    type="url"
                    value={linkValue}
                    onChange={(event) => {
                      setLinkValue(event.target.value)
                      setSelectedLinkPageKey(null)
                    }}
                    placeholder="https://example.com"
                    aria-label="Link URL"
                    disabled={blocked}
                  />
                ) : (
                  <div className="berry-toolbar__link-pages">
                    <input
                      type="text"
                      value={linkPageQuery}
                      onChange={(event) => setLinkPageQuery(event.target.value)}
                      placeholder={`Search ${activeLinkPageTab.label}`}
                      aria-label="Search pages"
                      disabled={blocked}
                    />
                    {linkPageLoading ? <p className="berry-toolbar__empty">Loading...</p> : null}
                    {visibleLinkPageOptions.length ? (
                      <select
                        className="berry-toolbar__link-page-select"
                        size={8}
                        value={
                          selectedLinkPageKey?.startsWith(`${activeLinkPageTab.key}:`)
                            ? selectedLinkPageKey
                            : ''
                        }
                        onChange={(event) => {
                          const selectedKey = event.target.value
                          const selectedOption = visibleLinkPageOptions.find(
                            (option) => `${activeLinkPageTab.key}:${option.id}` === selectedKey
                          )
                          if (!selectedOption) return
                          selectLinkPage(activeLinkPageTab.key, selectedOption)
                        }}
                        aria-label="Page links"
                        disabled={blocked}
                      >
                        {visibleLinkPageOptions.map((option) => (
                          <option
                            key={`${activeLinkPageTab.key}:${option.id}`}
                            value={`${activeLinkPageTab.key}:${option.id}`}
                          >
                            {formatLinkPageSelectLabel(option)}
                          </option>
                        ))}
                      </select>
                    ) : normalizedLinkPageQuery ? (
                      <p className="berry-toolbar__empty">No pages found.</p>
                    ) : (
                      <p className="berry-toolbar__empty">No pages available.</p>
                    )}
                  </div>
                )}

                <input
                  type="text"
                  value={linkTextValue}
                  onChange={(event) => setLinkTextValue(event.target.value)}
                  placeholder="Link text"
                  aria-label="Link text"
                  disabled={blocked}
                />
                <label className="berry-toolbar__checkbox">
                  <input
                    type="checkbox"
                    checked={linkOpenInNewTab}
                    onChange={(event) => setLinkOpenInNewTab(event.target.checked)}
                    disabled={blocked}
                  />
                  <span>Open in new tab</span>
                </label>
                <button type="button" onClick={submitLink} disabled={blocked || !linkValue.trim()}>
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exec('unlink')
                    setShowLinkInput(false)
                    resetLinkFlyoutState()
                  }}
                  disabled={blocked}
                >
                  Unlink
                </button>
                <Popover.Arrow className="berry-toolbar__popover-arrow" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : null}
        {isToolbarItemVisible('image') ? (
          <button
            type="button"
            className="berry-toolbar__button"
            onClick={onPickImage}
            onMouseDown={(event) => {
              onPrepareInsert?.()
              event.preventDefault()
            }}
            disabled={blocked || !canInsertImage}
            aria-label="Image"
            title="Image"
          >
            <span className="berry-toolbar__material-icon" aria-hidden="true">
              image
            </span>
          </button>
        ) : null}
        {isToolbarItemVisible('document') ? (
          <button
            type="button"
            className="berry-toolbar__button"
            onClick={onPickDocument}
            onMouseDown={(event) => {
              onPrepareInsert?.()
              event.preventDefault()
            }}
            disabled={blocked || !canInsertDocument}
            aria-label="Document"
            title="Document"
          >
            <span className="berry-toolbar__material-icon" aria-hidden="true">
              description
            </span>
          </button>
        ) : null}
        {isToolbarItemVisible('table') ? (
          <Popover.Root
            open={showTableFlyout}
            onOpenChange={(open) => {
              setShowTableFlyout(open)
              if (open) {
                resetTablePreview()
              } else {
                setTablePointerActive(false)
              }
            }}
          >
            <Popover.Trigger asChild>
              <button
                type="button"
                className="berry-toolbar__button"
                disabled={blocked}
                aria-expanded={showTableFlyout}
                aria-label="Table"
                title="Table"
                onMouseDown={(event) => {
                  event.preventDefault()
                }}
              >
                <span className="berry-toolbar__material-icon" aria-hidden="true">
                  table_chart
                </span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="berry-toolbar__flyout berry-toolbar__popover-content berry-toolbar__flyout--table"
                side="bottom"
                align="start"
                sideOffset={8}
              >
                <div className="berry-toolbar__table-dimensions" aria-live="polite">
                  {tablePreviewRows} x {tablePreviewCols}
                </div>
                <label className="berry-toolbar__checkbox">
                  <input
                    type="checkbox"
                    checked={tableBordersEnabled}
                    onChange={(event) => setTableBordersEnabled(event.target.checked)}
                    disabled={blocked}
                  />
                  <span>Borders</span>
                </label>
                <div
                  ref={tableMatrixRef}
                  className="berry-toolbar__table-matrix"
                  role="grid"
                  aria-label="Table size picker"
                  onPointerLeave={() => setTablePointerActive(false)}
                >
                  {Array.from({ length: MAX_TABLE_DIM }, (_, rowIndex) => {
                    const rows = rowIndex + 1
                    return Array.from({ length: MAX_TABLE_DIM }, (_, colIndex) => {
                      const cols = colIndex + 1
                      const isActive = rows <= tablePreviewRows && cols <= tablePreviewCols
                      const isPreview = rows === tableKeyboardRow && cols === tableKeyboardCol
                      return (
                        <button
                          key={`table-cell-${rows}-${cols}`}
                          type="button"
                          className={`berry-toolbar__table-cell${isActive ? ' is-active' : ''}${isPreview ? ' is-preview' : ''}`}
                          role="gridcell"
                          aria-label={`Insert ${rows} by ${cols} table`}
                          aria-selected={isActive}
                          data-table-row={rows}
                          data-table-col={cols}
                          disabled={blocked}
                          onFocus={() => previewTableSize(rows, cols)}
                          onMouseEnter={() => previewTableSize(rows, cols)}
                          onMouseDown={(event) => event.preventDefault()}
                          onPointerDown={(event) => handleTableCellPointerDown(rows, cols, event)}
                          onPointerEnter={() => handleTableCellPointerEnter(rows, cols)}
                          onPointerUp={(event) => handleTableCellPointerUp(rows, cols, event)}
                          onClick={() => {
                            if (blocked) return
                            if (tableSkipClickRef.current) {
                              tableSkipClickRef.current = false
                              return
                            }
                            insertTableWithSize(rows, cols)
                          }}
                          onKeyDown={(event) => handleTableCellKeyDown(event, rows, cols)}
                        />
                      )
                    })
                  })}
                </div>
                <p className="berry-toolbar__table-help">
                  Drag to choose size. Press Enter to insert.
                </p>
                <Popover.Arrow className="berry-toolbar__popover-arrow" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : null}
        {isToolbarItemVisible('horizontalRule') ? (
          <ToolbarButton
            icon="horizontal_rule"
            label=""
            title="Horizontal rule"
            command="insertHorizontalRule"
            disabled={blocked}
            onClick={exec}
          />
        ) : null}
        {isToolbarItemVisible('emoji') ? (
          <Popover.Root open={showEmojiFlyout} onOpenChange={setShowEmojiFlyout}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="berry-toolbar__button"
                disabled={emojiDisabled}
                aria-expanded={showEmojiFlyout}
                aria-label="Emoji"
                title="Emoji"
                onMouseDown={(event) => {
                  event.preventDefault()
                }}
              >
                <span className="berry-toolbar__material-icon" aria-hidden="true">
                  mood
                </span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="berry-toolbar__flyout berry-toolbar__popover-content berry-toolbar__flyout--emoji"
                side="bottom"
                align="start"
                sideOffset={8}
                onCloseAutoFocus={(event) => {
                  event.preventDefault()
                }}
              >
                <EmojiPicker
                  disabled={emojiDisabled}
                  onInsert={(payload) => {
                    onInsertEmoji(payload)
                    setShowEmojiFlyout(false)
                    closeFormattingFlyouts()
                  }}
                  onClose={() => setShowEmojiFlyout(false)}
                  {...(emojiPicker ? { options: emojiPicker } : {})}
                />
                <Popover.Arrow className="berry-toolbar__popover-arrow" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : null}
        {isToolbarItemVisible('macro') ? (
          <Popover.Root
            open={showMacroFlyout}
            onOpenChange={(open) => {
              if (open) {
                onPrepareInsert?.()
              }
              setShowMacroFlyout(open)
            }}
          >
            <Popover.Trigger asChild>
              <button
                type="button"
                className="berry-toolbar__button"
                disabled={macroDisabled}
                aria-expanded={showMacroFlyout}
                aria-label="Macro"
                title="Macro"
                onMouseDown={(event) => {
                  onPrepareInsert?.()
                  event.preventDefault()
                }}
              >
                <span className="berry-toolbar__material-icon" aria-hidden="true">
                  auto_awesome
                </span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="berry-toolbar__flyout berry-toolbar__popover-content berry-toolbar__flyout--list"
                side="bottom"
                align="start"
                sideOffset={8}
              >
                <input
                  type="text"
                  value={macroQuery}
                  onChange={(event) => setMacroQuery(event.target.value)}
                  placeholder="Search macros"
                  disabled={macroDisabled}
                />
                {macroLoading ? <p className="berry-toolbar__empty">Loading...</p> : null}
                {!macroLoading && macroOptions.length === 0 ? (
                  <p className="berry-toolbar__empty">No macros found.</p>
                ) : null}
                {!macroLoading ? (
                  <div className="berry-toolbar__list">
                    {macroOptions.slice(0, 20).map((option) => (
                      <button
                        type="button"
                        key={option.id}
                        disabled={macroDisabled || macroInsertingId === option.id}
                        onClick={() => {
                          void handleMacroInsert(option.id)
                        }}
                      >
                        <span>{option.label}</span>
                        {option.description ? <small>{option.description}</small> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
                <Popover.Arrow className="berry-toolbar__popover-arrow" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : null}
      </div>
      {renderCategoryLabel('Insert')}
    </div>
  ) : null

  const modeCategory = isToolbarItemVisible('htmlToggle') ? (
    <div className="berry-toolbar__group" aria-label="Editor mode controls">
      <div className="berry-toolbar__group-controls">
        <button
          type="button"
          className="berry-toolbar__button berry-toolbar__button--with-text"
          aria-label={isHTMLMode ? 'Switch to rich text mode' : 'Switch to HTML mode'}
          title={isHTMLMode ? 'Switch to rich text mode' : 'Switch to HTML mode'}
          aria-pressed={isHTMLMode}
          disabled={htmlToggleDisabled}
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={() => onToggleHTMLMode?.()}
        >
          <span className="berry-toolbar__material-icon" aria-hidden="true">
            {isHTMLMode ? 'text_fields' : 'code'}
          </span>
          <span className="berry-toolbar__button-text">{isHTMLMode ? 'Rich Text' : 'HTML'}</span>
        </button>
      </div>
      {renderCategoryLabel('Mode')}
    </div>
  ) : null

  const categories: Array<{
    key: BerryToolbarCategoryKey
    node: ReactElement | null
    available: boolean
  }> = [
    {
      key: 'history',
      node: historyCategory,
      available: showFormattingControls && !!historyCategory
    },
    { key: 'text', node: textCategory, available: showFormattingControls && !!textCategory },
    {
      key: 'formatting',
      node: formattingCategory,
      available: showFormattingControls && !!formattingCategory
    },
    { key: 'styles', node: stylesCategory, available: showFormattingControls && !!stylesCategory },
    {
      key: 'paragraph',
      node: paragraphCategory,
      available: showFormattingControls && !!paragraphCategory
    },
    { key: 'insert', node: insertCategory, available: showFormattingControls && !!insertCategory },
    { key: 'mode', node: modeCategory, available: showHTMLToggle && !!modeCategory }
  ]

  const sortedVisibleCategories = categories
    .filter((category) => category.available)
    .map((category, index) => {
      const defaults = DEFAULT_TOOLBAR_LAYOUT[category.key]
      const override = toolbarLayout?.[category.key]
      return {
        ...category,
        index,
        visible: override?.visible !== false,
        row: resolveLayoutNumber(override?.row, defaults.row, 1),
        order: resolveLayoutNumber(override?.order, defaults.order, 0)
      }
    })
    .filter((category) => category.visible)
    .sort((a, b) => a.row - b.row || a.order - b.order || a.index - b.index)

  const categoriesByRow = new Map<number, typeof sortedVisibleCategories>()
  sortedVisibleCategories.forEach((category) => {
    const existing = categoriesByRow.get(category.row)
    if (existing) {
      existing.push(category)
      return
    }
    categoriesByRow.set(category.row, [category])
  })

  return (
    <div className="berry-toolbar" role="toolbar" aria-label="Editor formatting tools">
      {Array.from(categoriesByRow.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([row, rowCategories]) => (
          <div key={`toolbar-row-${row}`} className="berry-toolbar__row" data-row={row}>
            {rowCategories.map((category) => (
              <Fragment key={category.key}>{category.node}</Fragment>
            ))}
          </div>
        ))}
    </div>
  )
}
