import { parseHTML } from "../html/parser"
import { serializeHTML } from "../html/serializer"
import type { BlockNode, EditorDocument } from "./types"

/**
 * Creates a minimal document with one empty paragraph block.
 */
export function createEmptyDocument(): EditorDocument {
  const emptyBlock: BlockNode = { type: 'paragraph', children: [] }
  return { blocks: [emptyBlock] }
}

/**
 * Parses HTML into the document model and guarantees at least one block.
 */
export function documentFromHTML(html: string): EditorDocument {
  const parsed = parseHTML(html)
  if (!parsed.blocks.length) {
    return createEmptyDocument()
  }
  return parsed
}

/**
 * Serializes a document model to sanitized HTML.
 */
export function documentToHTML(documentModel: EditorDocument): string {
  return serializeHTML(documentModel)
}
