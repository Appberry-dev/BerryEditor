/**
 * Undo/redo stack with duplicate suppression based on caller-provided equality.
 */
export class HistoryStack<T> {
  private past: T[] = []
  private future: T[] = []
  private readonly areEqual: (a: T, b: T) => boolean

  /**
   * @param areEqual Compares snapshots to avoid pushing duplicate adjacent states.
   */
  constructor(areEqual: (a: T, b: T) => boolean) {
    this.areEqual = areEqual
  }

  clear(): void {
    this.past = []
    this.future = []
  }

  push(next: T): void {
    if (this.past.length && this.areEqual(this.past[this.past.length - 1] as T, next)) {
      return
    }
    this.past.push(next)
    this.future = []
  }

  undo(current: T): T | null {
    const prev = this.past.pop()
    if (!prev) return null
    this.future.push(current)
    return prev
  }

  redo(current: T): T | null {
    const next = this.future.pop()
    if (!next) return null
    this.past.push(current)
    return next
  }

  canUndo(): boolean {
    return this.past.length > 0
  }

  canRedo(): boolean {
    return this.future.length > 0
  }
}
