import type { ReactElement } from 'react'

/**
 * Text-offset based selection relative to editor content.
 */
export type SelectionRange = { anchor: number; focus: number }

/**
 * Metadata returned by upload adapters.
 */
export interface UploadResult {
  id: string
  url: string
  filename: string
  filesize: number
  contentType: string
  previewUrl?: string
  width?: number
  height?: number
  alt?: string
}

/**
 * Runtime context provided to upload adapters.
 */
export interface UploadContext {
  signal: AbortSignal
  setProgress: (value: number) => void
}

/**
 * Image upload adapter used by the editor.
 */
export interface ImageAdapter {
  accept?: string
  upload(file: File, ctx: UploadContext): Promise<UploadResult>
  remove?: (attachmentId: string) => Promise<void>
}

/**
 * Document upload adapter used by the editor.
 */
export interface DocumentAdapter {
  accept?: string
  upload(file: File, ctx: UploadContext): Promise<UploadResult>
  remove?: (attachmentId: string) => Promise<void>
}

/**
 * Macro option displayed in the macro picker.
 */
export interface MacroOption {
  id: string
  label: string
  description?: string
}

/**
 * Selectable page/link option for link insertion UI.
 */
export interface LinkPageOption {
  id: string
  name: string
  href: string
  children?: LinkPageOption[]
}

/**
 * Macro provider used by toolbar search and insertion.
 */
export interface MacroAdapter {
  search(query: string): Promise<MacroOption[]>
  resolve(macroId: string): Promise<{ html: string }>
}

export type EmojiInsertMode = 'twemojiImage' | 'unicode'
export type EmojiTone = 'default' | 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark'
export type EmojiGender = 'auto' | 'person' | 'woman' | 'man'

/**
 * Payload emitted when inserting an emoji from the modern picker.
 */
export interface EmojiInsertPayload {
  unicode: string
  twemojiUrl?: string
  insertMode?: EmojiInsertMode
  label?: string
}

/**
 * Configuration for the built-in emoji picker.
 */
export interface EmojiPickerOptions {
  insertMode?: EmojiInsertMode
  twemojiBaseUrl?: string
  useTwemoji?: boolean
  readonly unicodeVersion?: '17.0'
  searchMaxResults?: number
  recentLimit?: number
  persistPreferences?: boolean
  persistRecents?: boolean
  showCategories?: boolean
}

/**
 * Toolbar font family option.
 */
export interface FontFamilyOption {
  label: string
  value: string
}

export type BerryToolbarCategoryKey =
  | 'history'
  | 'text'
  | 'formatting'
  | 'styles'
  | 'paragraph'
  | 'insert'
  | 'mode'

export interface BerryToolbarCategoryLayout {
  visible?: boolean
  order?: number
  row?: number
}

/**
 * Optional per-category toolbar layout overrides.
 */
export type BerryToolbarLayout = Partial<
  Record<BerryToolbarCategoryKey, BerryToolbarCategoryLayout>
>

export type BerryToolbarItemKey =
  | 'undo'
  | 'redo'
  | 'fontFamily'
  | 'fontSize'
  | 'lineSpacing'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'textColor'
  | 'highlightColor'
  | 'clearFormatting'
  | 'styleSelect'
  | 'blockQuote'
  | 'bulletList'
  | 'numberedList'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  | 'link'
  | 'image'
  | 'document'
  | 'table'
  | 'horizontalRule'
  | 'emoji'
  | 'macro'
  | 'htmlToggle'

export interface BerryToolbarItemsConfig {
  showOnly?: BerryToolbarItemKey[]
  hideOnly?: BerryToolbarItemKey[]
}

export type ColorPickerKind = 'text' | 'highlight'

/**
 * Props passed to color-picker renderers/adapters.
 */
export interface ColorPickerRenderProps {
  kind: ColorPickerKind
  value: string
  disabled: boolean
  swatches: string[]
  onCommit: (hex: string) => void
  onClear?: (() => void) | undefined
  onClose: () => void
}

/**
 * Context passed to color-picker adapters when mounted into the toolbar.
 */
export interface ColorPickerAdapterContext extends ColorPickerRenderProps {
  container: HTMLElement
}

/**
 * Optional lifecycle hooks exposed by a mounted color-picker adapter.
 */
export interface ColorPickerAdapterHandle {
  update?: (next: Omit<ColorPickerAdapterContext, 'container'>) => void
  destroy?: () => void
}

/**
 * Adapter contract for integrating non-React or external color pickers.
 */
export interface ColorPickerAdapter {
  mount: (context: ColorPickerAdapterContext) => void | ColorPickerAdapterHandle
}

/**
 * Color picker customization options for toolbar text/highlight controls.
 */
export interface ColorPickerOptions {
  swatches?: string[]
  render?: (props: ColorPickerRenderProps) => ReactElement | null
  adapter?: ColorPickerAdapter
}

/**
 * Event payload describing sanitizer changes applied to editor HTML.
 */
export interface HTMLSanitizeNoticeEvent {
  changed: boolean
  message: string
}

/**
 * Imperative handle exposed by `BerryEditor`.
 */
export interface BerryEditorHandle {
  focus(): void
  blur(): void
  getHTML(): string
  setHTML(html: string): void
  getSelection(): SelectionRange | null
  setSelection(range: SelectionRange): void
  exec(command: string, payload?: unknown): void
  undo(): void
  redo(): void
}

/**
 * Props for the `BerryEditor` React component.
 */
export interface BerryEditorProps {
  value?: string
  defaultValue?: string
  onChange?: (html: string) => void
  onHTMLSanitizeNotice?: (event: HTMLSanitizeNoticeEvent) => void
  onSelectionChange?: (range: SelectionRange | null) => void
  onFocus?: () => void
  onBlur?: () => void
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  name?: string
  placeholder?: string
  imageAdapter?: ImageAdapter
  documentAdapter?: DocumentAdapter
  macroAdapter?: MacroAdapter
  linkPageOptions?: LinkPageOption[]
  linkPageOptions2?: LinkPageOption[]
  linkPageTabLabel?: string
  linkPageTab2Label?: string
  onSearchLinkPages?: (query: string) => Promise<LinkPageOption[]>
  onSearchLinkPages2?: (query: string) => Promise<LinkPageOption[]>
  emojiPicker?: EmojiPickerOptions
  fontFamilyOptions?: FontFamilyOption[]
  colorPicker?: ColorPickerOptions
  enableHTMLMode?: boolean
  showCategoryLabels?: boolean
  toolbarLayout?: BerryToolbarLayout
  toolbarItems?: BerryToolbarItemsConfig
  toolbarLoading?: boolean
}
