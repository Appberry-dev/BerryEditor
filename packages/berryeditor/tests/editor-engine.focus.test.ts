import { describe, expect, it, vi } from 'vitest'
import { EditorEngine } from '../src/core/editor_engine'

function setCaret(node: Text, offset: number): void {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  const selection = window.getSelection()
  if (!selection) {
    throw new Error('Selection API unavailable')
  }
  selection.removeAllRanges()
  selection.addRange(range)
}

describe('EditorEngine focusForCommand', () => {
  it('restores caret after focus changes selection', () => {
    const editor = document.createElement('div')
    editor.contentEditable = 'true'
    document.body.append(editor)

    const engine = new EditorEngine()
    engine.bind(editor)
    engine.loadHTML('<p>Hello world</p>')

    const textNode = editor.querySelector('p')?.firstChild
    if (!(textNode instanceof Text)) {
      throw new Error('Unable to find text node')
    }

    setCaret(textNode, 6)
    engine.setSelection({ anchor: 6, focus: 6 })

    const originalFocus = editor.focus.bind(editor)
    Object.defineProperty(editor, 'focus', {
      configurable: true,
      value: () => {
        originalFocus()
        setCaret(textNode, textNode.data.length)
      }
    })

    engine.focusForCommand()

    expect(engine.getSelection()).toEqual({ anchor: 6, focus: 6 })

    engine.unbind()
    editor.remove()
  })

  it('focuses the editor before running execCommand commands', () => {
    const editor = document.createElement('div')
    editor.contentEditable = 'true'
    document.body.append(editor)

    const engine = new EditorEngine()
    engine.bind(editor)
    engine.loadHTML('<p>Hello world</p>')

    const textNode = editor.querySelector('p')?.firstChild
    if (!(textNode instanceof Text)) {
      throw new Error('Unable to find text node')
    }

    setCaret(textNode, 0)
    engine.setSelection({ anchor: 0, focus: 0 })

    let focusCalled = false
    const originalFocus = editor.focus.bind(editor)
    Object.defineProperty(editor, 'focus', {
      configurable: true,
      value: () => {
        focusCalled = true
        originalFocus()
      }
    })

    const doc = document as Document & {
      execCommand?: (commandId: string, showUI?: boolean, value?: string) => boolean
    }
    const originalExecCommand = doc.execCommand
    const execCommandSpy = vi.fn((commandId: string) => commandId === 'bold' && focusCalled)
    doc.execCommand = execCommandSpy

    try {
      engine.exec('bold')

      expect(execCommandSpy).toHaveBeenCalledWith('bold', undefined, undefined)
      expect(focusCalled).toBe(true)
    } finally {
      if (originalExecCommand) {
        doc.execCommand = originalExecCommand
      } else {
        Reflect.deleteProperty(doc as unknown as Record<string, unknown>, 'execCommand')
      }
      engine.unbind()
      editor.remove()
    }
  })
})
