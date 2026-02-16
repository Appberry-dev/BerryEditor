import { describe, expect, it } from 'vitest'
import { HistoryStack } from '../src/core/history'

describe('HistoryStack', () => {
  it('supports push/undo/redo', () => {
    const history = new HistoryStack<number>((a, b) => a === b)
    history.push(1)
    history.push(2)

    expect(history.canUndo()).toBe(true)
    expect(history.undo(3)).toBe(2)
    expect(history.undo(2)).toBe(1)
    expect(history.undo(1)).toBeNull()

    expect(history.canRedo()).toBe(true)
    expect(history.redo(1)).toBe(2)
    expect(history.redo(2)).toBe(3)
    expect(history.redo(3)).toBeNull()
  })
})
