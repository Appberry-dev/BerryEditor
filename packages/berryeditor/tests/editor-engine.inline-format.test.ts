import { describe, expect, it } from 'vitest'
import { EditorEngine } from '../src/core/editor_engine'
import type { EditorCommand } from '../src/core/commands'

const INLINE_FALLBACK_CASES: Array<{
  command: Extract<EditorCommand, 'bold' | 'italic' | 'underline' | 'strike'>
  selector: 'strong' | 'em' | 'u' | 's'
}> = [
  { command: 'bold', selector: 'strong' },
  { command: 'italic', selector: 'em' },
  { command: 'underline', selector: 'u' },
  { command: 'strike', selector: 's' }
]

function withExecCommandUnavailable(run: () => void): void {
  const doc = document as Document & Record<string, unknown>
  const originalExecCommand = doc.execCommand
  Reflect.deleteProperty(doc, 'execCommand')
  try {
    run()
  } finally {
    if (typeof originalExecCommand === 'function') {
      doc.execCommand = originalExecCommand
    } else {
      Reflect.deleteProperty(doc, 'execCommand')
    }
  }
}

function withExecCommandCollapseNoOpForInlineMarks(run: () => void): void {
  const doc = document as Document & Record<string, unknown>
  const originalExecCommand = doc.execCommand
  const nextExecCommand = ((commandId: string): boolean => {
    if (!['bold', 'italic', 'underline', 'strikeThrough'].includes(commandId)) {
      return false
    }
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return false
    }
    const range = selection.getRangeAt(0).cloneRange()
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
    return true
  }) as unknown as Document['execCommand']

  doc.execCommand = nextExecCommand
  try {
    run()
  } finally {
    if (typeof originalExecCommand === 'function') {
      doc.execCommand = originalExecCommand
    } else {
      Reflect.deleteProperty(doc, 'execCommand')
    }
  }
}

describe('EditorEngine inline format fallback', () => {
  it.each(INLINE_FALLBACK_CASES)('applies $command when execCommand is unavailable', (scenario) => {
    const editor = document.createElement('div')
    editor.contentEditable = 'true'
    document.body.append(editor)

    const engine = new EditorEngine()
    engine.bind(editor)
    engine.loadHTML('<p>Hello world</p>')
    engine.setSelection({ anchor: 0, focus: 5 })

    withExecCommandUnavailable(() => {
      engine.exec(scenario.command)
    })

    const formatted = editor.querySelector(scenario.selector)
    expect(formatted?.textContent).toBe('Hello')

    engine.unbind()
    editor.remove()
  })

  it.each(INLINE_FALLBACK_CASES)(
    'restores expanded selection and applies $command when execCommand collapses selection',
    (scenario) => {
      const editor = document.createElement('div')
      editor.contentEditable = 'true'
      document.body.append(editor)

      const engine = new EditorEngine()
      engine.bind(editor)
      engine.loadHTML('<p>Hello world</p>')
      engine.setSelection({ anchor: 0, focus: 11 })

      withExecCommandCollapseNoOpForInlineMarks(() => {
        engine.exec(scenario.command)
      })

      const formatted = editor.querySelector(scenario.selector)
      expect(formatted?.textContent).toBe('Hello world')

      engine.unbind()
      editor.remove()
    }
  )

  it('does not mutate markup when fallback is used with a collapsed selection', () => {
    const editor = document.createElement('div')
    editor.contentEditable = 'true'
    document.body.append(editor)

    const engine = new EditorEngine()
    engine.bind(editor)
    engine.loadHTML('<p>Hello world</p>')
    engine.setSelection({ anchor: 5, focus: 5 })

    withExecCommandUnavailable(() => {
      engine.exec('bold')
    })

    expect(editor.innerHTML).toBe('<p>Hello world</p>')

    engine.unbind()
    editor.remove()
  })
})
