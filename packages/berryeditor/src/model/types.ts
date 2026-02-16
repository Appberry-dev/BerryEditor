/**
 * Supported inline text marks stored on text nodes.
 */
export type InlineMark =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'link'
  | 'linkTarget'
  | 'fontFamily'
  | 'fontSize'
  | 'textColor'
  | 'highlightColor'

/**
 * Inline text node.
 */
export interface TextNode {
  kind: 'text'
  text: string
  marks: Partial<Record<InlineMark, true | string>>
}

/**
 * Inline attachment node (image/document).
 */
export interface AttachmentNode {
  kind: 'attachment'
  id: string
  url: string
  filename: string
  filesize: number
  contentType: string
  previewUrl?: string
  width?: number
  widthUnit?: 'px' | 'percent'
  height?: number
  alt?: string
  caption?: string
  padding?: number
  imageAlign?: 'left' | 'center' | 'right'
  wrapText?: boolean
  wrapSide?: 'left' | 'right'
  linkUrl?: string
  linkOpenInNewTab?: boolean
  pending?: boolean
}

/**
 * Any inline node.
 */
export type InlineNode = TextNode | AttachmentNode

export type ListType = 'bullet' | 'numbered'
export type Alignment = 'left' | 'center' | 'right' | 'justify'

/**
 * Shared typography/alignment options for block-level nodes.
 */
export interface BaseBlock {
  align?: Alignment
  lineHeight?: number
  fontSize?: number
  fontFamily?: string
}

/**
 * Textual block node, including headings, quotes, and list items.
 */
export interface TextBlockNode extends BaseBlock {
  type: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'quote' | 'listItem'
  listType?: ListType
  children: InlineNode[]
}

/**
 * Horizontal rule block.
 */
export interface HorizontalRuleBlockNode extends BaseBlock {
  type: 'horizontalRule'
}

/**
 * Table cell content model.
 */
export interface TableCellNode {
  header?: boolean
  colspan?: number
  rowspan?: number
  align?: Alignment
  lineHeight?: number
  fontSize?: number
  fontFamily?: string
  children: InlineNode[]
}

export interface TableRowNode {
  cells: TableCellNode[]
}

/**
 * Table block node.
 */
export interface TableBlockNode extends BaseBlock {
  type: 'table'
  rows: TableRowNode[]
}

export type BlockNode = TextBlockNode | HorizontalRuleBlockNode | TableBlockNode

/**
 * Root editor document model.
 */
export interface EditorDocument {
  blocks: BlockNode[]
}
