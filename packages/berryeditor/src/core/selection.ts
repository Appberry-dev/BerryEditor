import type { SelectionRange } from '../react/types'

function offsetFromPoint(container: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange()
  range.setStart(container, 0)
  range.setEnd(node, offset)
  return range.toString().length
}

function pointFromOffset(
  container: HTMLElement,
  target: number
): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let consumed = 0

  while (walker.nextNode()) {
    const node = walker.currentNode
    const text = node.textContent ?? ''
    const next = consumed + text.length
    if (target <= next) {
      return { node, offset: Math.max(0, target - consumed) }
    }
    consumed = next
  }

  if (container.lastChild) {
    if (container.lastChild.nodeType === Node.TEXT_NODE) {
      const text = container.lastChild.textContent ?? ''
      return { node: container.lastChild, offset: text.length }
    }
    return { node: container, offset: container.childNodes.length }
  }

  return { node: container, offset: 0 }
}

/**
 * Returns the current selection as character offsets relative to `container`.
 */
export function getSelectionRange(container: HTMLElement): SelectionRange | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  if (!container.contains(selection.anchorNode) || !container.contains(selection.focusNode)) {
    return null
  }

  return {
    anchor: offsetFromPoint(container, selection.anchorNode as Node, selection.anchorOffset),
    focus: offsetFromPoint(container, selection.focusNode as Node, selection.focusOffset)
  }
}

/**
 * Restores a selection from character offsets relative to `container`.
 */
export function setSelectionRange(container: HTMLElement, range: SelectionRange): void {
  const selection = window.getSelection()
  if (!selection) return

  const anchorPoint = pointFromOffset(container, range.anchor)
  const focusPoint = pointFromOffset(container, range.focus)
  if (!anchorPoint || !focusPoint) return

  const domRange = document.createRange()
  domRange.setStart(anchorPoint.node, anchorPoint.offset)
  domRange.setEnd(focusPoint.node, focusPoint.offset)

  selection.removeAllRanges()
  selection.addRange(domRange)
}
