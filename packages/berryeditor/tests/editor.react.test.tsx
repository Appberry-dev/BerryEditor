import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { BerryEditor } from '../src/react/BerryEditor'
import type { BerryEditorHandle } from '../src/react/types'

function selectEditorText(editor: HTMLElement): void {
  const paragraph = editor.querySelector('p')
  const textNode = paragraph?.firstChild
  if (!textNode) {
    throw new Error('Unable to select editor text')
  }

  const range = document.createRange()
  range.selectNodeContents(textNode)
  const selection = window.getSelection()
  if (!selection) {
    throw new Error('Selection API unavailable')
  }
  selection.removeAllRanges()
  selection.addRange(range)
}

function placeCursorInFirstParagraphText(editor: HTMLElement, offset: number): void {
  const paragraph = editor.querySelector('p')
  const textNode = paragraph?.firstChild
  if (!(textNode instanceof Text)) {
    throw new Error('Unable to find first paragraph text node')
  }

  const clampedOffset = Math.max(0, Math.min(offset, textNode.data.length))
  const range = document.createRange()
  range.setStart(textNode, clampedOffset)
  range.collapse(true)

  const selection = window.getSelection()
  if (!selection) {
    throw new Error('Selection API unavailable')
  }

  selection.removeAllRanges()
  selection.addRange(range)
  editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
}

function placeCursorInFirstTableCell(editor: HTMLElement): void {
  const cell = editor.querySelector('td,th')
  if (!cell) {
    throw new Error('Unable to find table cell')
  }

  const target = cell.firstChild ?? cell
  const range = document.createRange()
  range.selectNodeContents(target)
  range.collapse(true)

  const selection = window.getSelection()
  if (!selection) {
    throw new Error('Selection API unavailable')
  }

  selection.removeAllRanges()
  selection.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
}

function focusFirstAttachmentImage(editor: HTMLElement): HTMLImageElement {
  const image = editor.querySelector(
    'img[data-berry-attachment-id][data-berry-content-type^="image/"]:not(.berry-emoji)'
  ) as HTMLImageElement | null
  if (!image) {
    throw new Error('Unable to find attachment image')
  }

  const range = document.createRange()
  range.selectNode(image)
  const selection = window.getSelection()
  if (!selection) {
    throw new Error('Selection API unavailable')
  }
  selection.removeAllRanges()
  selection.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))

  return image
}

function mockExecCommandForColors(): { spy: ReturnType<typeof vi.fn>; restore: () => void } {
  const doc = document as unknown as {
    execCommand?: (commandId: string, showUI?: boolean, value?: string) => boolean
  }
  const original = doc.execCommand
  const spy = vi.fn((commandId: string, _showUI?: boolean, value?: string) => {
    if (commandId === 'styleWithCSS') return true
    if (commandId !== 'foreColor' && commandId !== 'hiliteColor' && commandId !== 'backColor')
      return false

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const range = selection.getRangeAt(0)
    if (range.collapsed) return false

    const span = document.createElement('span')
    if (commandId === 'foreColor') {
      span.setAttribute('style', `color:${value ?? ''}`)
    } else {
      span.setAttribute('style', `background-color:${value ?? ''}`)
    }

    try {
      range.surroundContents(span)
    } catch {
      const fragment = range.extractContents()
      span.append(fragment)
      range.insertNode(span)
    }

    selection.removeAllRanges()
    const nextRange = document.createRange()
    nextRange.selectNodeContents(span)
    nextRange.collapse(false)
    selection.addRange(nextRange)

    return true
  })

  doc.execCommand = spy

  return {
    spy,
    restore: () => {
      if (original) {
        doc.execCommand = original
      } else {
        delete doc.execCommand
      }
    }
  }
}

function mockExecCommandNoOpForColor(): { spy: ReturnType<typeof vi.fn>; restore: () => void } {
  const doc = document as unknown as {
    execCommand?: (commandId: string, showUI?: boolean, value?: string) => boolean
  }
  const original = doc.execCommand
  const spy = vi.fn((commandId: string) => {
    if (commandId === 'styleWithCSS') return true
    if (commandId === 'foreColor' || commandId === 'hiliteColor' || commandId === 'backColor') {
      return true
    }
    return false
  })

  doc.execCommand = spy

  return {
    spy,
    restore: () => {
      if (original) {
        doc.execCommand = original
      } else {
        delete doc.execCommand
      }
    }
  }
}

function mockExecCommandCollapseNoOpForColor(): {
  spy: ReturnType<typeof vi.fn>
  restore: () => void
} {
  const doc = document as unknown as {
    execCommand?: (commandId: string, showUI?: boolean, value?: string) => boolean
  }
  const original = doc.execCommand
  const spy = vi.fn((commandId: string) => {
    if (commandId === 'styleWithCSS') return true
    if (commandId === 'foreColor' || commandId === 'hiliteColor' || commandId === 'backColor') {
      const selection = window.getSelection()
      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      return true
    }
    return false
  })

  doc.execCommand = spy

  return {
    spy,
    restore: () => {
      if (original) {
        doc.execCommand = original
      } else {
        delete doc.execCommand
      }
    }
  }
}

function mockExecCommandColorWithFontTag(): {
  spy: ReturnType<typeof vi.fn>
  restore: () => void
} {
  const doc = document as unknown as {
    execCommand?: (commandId: string, showUI?: boolean, value?: string) => boolean
  }
  const original = doc.execCommand
  const spy = vi.fn((commandId: string, _showUI?: boolean, value?: string) => {
    if (commandId === 'styleWithCSS') return true
    if (commandId !== 'foreColor') return false

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const range = selection.getRangeAt(0)
    if (range.collapsed) return false

    const font = document.createElement('font')
    font.setAttribute('color', value ?? '')

    try {
      range.surroundContents(font)
    } catch {
      const fragment = range.extractContents()
      font.append(fragment)
      range.insertNode(font)
    }

    selection.removeAllRanges()
    const nextRange = document.createRange()
    nextRange.selectNodeContents(font)
    nextRange.collapse(false)
    selection.addRange(nextRange)
    return true
  })

  doc.execCommand = spy

  return {
    spy,
    restore: () => {
      if (original) {
        doc.execCommand = original
      } else {
        delete doc.execCommand
      }
    }
  }
}

describe('BerryEditor', () => {
  it('renders with initial HTML and serializes to form proxy', async () => {
    render(<BerryEditor defaultValue="<p>Hello</p>" name="content" />)

    const editor = screen.getByRole('textbox')
    expect(editor).toBeInTheDocument()

    const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
    expect(proxy.value).toContain('<p>Hello</p>')
  })

  it('marks required editor invalid for semantic-empty markup', async () => {
    render(<BerryEditor defaultValue="<p><br></p>" name="content" required />)

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.checkValidity()).toBe(false)
      expect(proxy.validationMessage).toBe('Please fill out this field.')
    })
  })

  it('clears required validation once semantic content exists', async () => {
    const ref = createRef<BerryEditorHandle>()
    render(<BerryEditor ref={ref} defaultValue="<p><br></p>" name="content" required />)

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.checkValidity()).toBe(false)
    })

    ref.current?.setHTML('<p>Hello</p>')

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.checkValidity()).toBe(true)
      expect(proxy.validationMessage).toBe('')
    })
  })

  it('treats media-only html as valid for required editor fields', async () => {
    render(
      <BerryEditor
        defaultValue={'<p><img src="https://example.com/image.png" alt="Upload preview" /></p>'}
        name="content"
        required
      />
    )

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.checkValidity()).toBe(true)
      expect(proxy.validationMessage).toBe('')
    })
  })

  it('emits onChange when editable content changes', async () => {
    const changes: string[] = []
    render(<BerryEditor defaultValue="<p>Start</p>" onChange={(html) => changes.push(html)} />)

    const editor = screen.getByRole('textbox')
    editor.innerHTML = '<p>Updated</p>'
    fireEvent.input(editor)

    expect(changes[changes.length - 1]).toContain('Updated')
  })

  it('supports imperative API methods', () => {
    const ref = createRef<BerryEditorHandle>()
    render(<BerryEditor ref={ref} defaultValue="<p>One</p>" />)

    expect(ref.current).toBeTruthy()
    ref.current?.setHTML('<p>Two</p>')
    expect(ref.current?.getHTML()).toContain('<p>Two</p>')
  })

  it('shows HTML mode toggle by default and supports opt-out', () => {
    const { rerender } = render(<BerryEditor defaultValue="<p>Hello</p>" />)

    expect(screen.getByRole('button', { name: 'Switch to HTML mode' })).toBeInTheDocument()

    rerender(<BerryEditor defaultValue="<p>Hello</p>" enableHTMLMode={false} />)

    expect(screen.queryByRole('button', { name: 'Switch to HTML mode' })).not.toBeInTheDocument()
  })

  it('renders a toolbar skeleton while toolbarLoading is true and keeps editor editable', () => {
    render(<BerryEditor defaultValue="<p>Hello</p>" toolbarLoading />)

    expect(
      screen.queryByRole('toolbar', { name: 'Editor formatting tools' })
    ).not.toBeInTheDocument()
    expect(document.querySelector('.berry-toolbar--loading')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument()

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    expect(editor).toHaveAttribute('contenteditable', 'true')
  })

  it('swaps from toolbar skeleton to interactive toolbar when toolbarLoading turns off', () => {
    const { rerender } = render(<BerryEditor defaultValue="<p>Hello</p>" toolbarLoading />)

    expect(document.querySelector('.berry-toolbar--loading')).toBeInTheDocument()
    expect(
      screen.queryByRole('toolbar', { name: 'Editor formatting tools' })
    ).not.toBeInTheDocument()

    rerender(<BerryEditor defaultValue="<p>Hello</p>" toolbarLoading={false} />)

    expect(document.querySelector('.berry-toolbar--loading')).not.toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: 'Editor formatting tools' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument()
  })

  it('renders toolbar categories in the default two-row order', () => {
    render(<BerryEditor defaultValue="<p>Hello</p>" />)

    const toolbar = screen.getByRole('toolbar', { name: 'Editor formatting tools' })
    const row1 = toolbar.querySelector('.berry-toolbar__row[data-row="1"]')
    const row2 = toolbar.querySelector('.berry-toolbar__row[data-row="2"]')

    const row1Labels = Array.from(row1?.querySelectorAll('.berry-toolbar__group-label') ?? []).map(
      (node) => node.textContent?.trim()
    )
    const row2Labels = Array.from(row2?.querySelectorAll('.berry-toolbar__group-label') ?? []).map(
      (node) => node.textContent?.trim()
    )

    expect(row1Labels).toEqual(['History', 'Text', 'Formatting'])
    expect(row2Labels).toEqual(['Styles', 'Paragraph', 'Insert', 'Mode'])
  })

  it('hides toolbar category labels when showCategoryLabels is false', () => {
    render(<BerryEditor defaultValue="<p>Hello</p>" showCategoryLabels={false} />)

    const toolbar = screen.getByRole('toolbar', { name: 'Editor formatting tools' })
    expect(toolbar.querySelectorAll('.berry-toolbar__group-label')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument()
  })

  it('supports toolbar category visibility, order, and row overrides', () => {
    render(
      <BerryEditor
        defaultValue="<p>Hello</p>"
        toolbarLayout={{
          formatting: { visible: false },
          insert: { row: 1, order: 1 },
          mode: { row: 1, order: 2 },
          styles: { row: 2, order: 1 },
          paragraph: { row: 2, order: 2 },
          history: { row: 2, order: 3 },
          text: { row: 2, order: 4 }
        }}
      />
    )

    const toolbar = screen.getByRole('toolbar', { name: 'Editor formatting tools' })
    const row1 = toolbar.querySelector('.berry-toolbar__row[data-row="1"]')
    const row2 = toolbar.querySelector('.berry-toolbar__row[data-row="2"]')

    const row1Labels = Array.from(row1?.querySelectorAll('.berry-toolbar__group-label') ?? []).map(
      (node) => node.textContent?.trim()
    )
    const row2Labels = Array.from(row2?.querySelectorAll('.berry-toolbar__group-label') ?? []).map(
      (node) => node.textContent?.trim()
    )

    expect(row1Labels).toEqual(['Insert', 'Mode'])
    expect(row2Labels).toEqual(['Styles', 'Paragraph', 'History', 'Text'])
    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument()
  })

  it('supports toolbar item showOnly filters', () => {
    render(
      <BerryEditor
        defaultValue="<p>Hello</p>"
        toolbarItems={{ showOnly: ['bold', 'htmlToggle'] }}
      />
    )

    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to HTML mode' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Italic' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Image' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Font family' })).not.toBeInTheDocument()
  })

  it('supports toolbar item hideOnly filters and removes empty categories', () => {
    render(
      <BerryEditor
        defaultValue="<p>Hello</p>"
        toolbarItems={{
          hideOnly: [
            'bold',
            'italic',
            'underline',
            'strike',
            'textColor',
            'highlightColor',
            'clearFormatting'
          ]
        }}
      />
    )

    const toolbar = screen.getByRole('toolbar', { name: 'Editor formatting tools' })
    const labels = Array.from(toolbar.querySelectorAll('.berry-toolbar__group-label')).map((node) =>
      node.textContent?.trim()
    )

    expect(labels).not.toContain('Formatting')
    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Image' })).toBeInTheDocument()
  })

  it('switches into HTML mode and hides formatting controls', () => {
    render(<BerryEditor defaultValue="<p>Hello</p>" />)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to HTML mode' }))

    expect(screen.getByRole('textbox', { name: 'HTML editor' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to rich text mode' })).toBeInTheDocument()
  })

  it('sanitizes unsafe HTML when toggling back to rich mode and emits notice callback', async () => {
    const onHTMLSanitizeNotice = vi.fn()
    render(
      <BerryEditor
        defaultValue="<p>Hello</p>"
        name="content"
        onHTMLSanitizeNotice={onHTMLSanitizeNotice}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Switch to HTML mode' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'HTML editor' }), {
      target: { value: '<p>Safe</p><script>alert(1)</script><img src="x" onerror="alert(2)" />' }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Switch to rich text mode' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('<p>Safe</p>')
      expect(proxy.value).not.toContain('<script')
      expect(proxy.value).not.toContain('onerror=')
    })

    expect(onHTMLSanitizeNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        changed: true,
        message: expect.stringContaining('Unsafe HTML')
      })
    )
  })

  it('restores rich-text focus and caret after switching from HTML mode', async () => {
    render(<BerryEditor defaultValue="<p>Hello world</p>" />)

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    placeCursorInFirstParagraphText(editor, 5)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to HTML mode' }))
    expect(screen.getByRole('textbox', { name: 'HTML editor' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Switch to rich text mode' }))

    await waitFor(() => {
      expect(document.activeElement).toBe(editor)
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        throw new Error('Selection API unavailable')
      }
      const range = selection.getRangeAt(0)
      expect(range.collapsed).toBe(true)
      expect(range.startOffset).toBe(5)
      expect(range.startContainer.textContent).toContain('Hello world')
    })
  })

  it('does not emit sanitize notice when HTML stays unchanged after sanitize', () => {
    const onHTMLSanitizeNotice = vi.fn()
    render(<BerryEditor defaultValue="<p>Hello</p>" onHTMLSanitizeNotice={onHTMLSanitizeNotice} />)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to HTML mode' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'HTML editor' }), {
      target: { value: '<p>Safe only</p>' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Switch to rich text mode' }))

    expect(onHTMLSanitizeNotice).not.toHaveBeenCalled()
  })

  it('auto-commits sanitized HTML when getHTML is called in HTML mode', async () => {
    const ref = createRef<BerryEditorHandle>()
    render(<BerryEditor ref={ref} defaultValue="<p>Hello</p>" />)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to HTML mode' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'HTML editor' }), {
      target: { value: '<p>Saved</p><script>alert(1)</script>' }
    })

    const saved = ref.current?.getHTML() ?? ''
    expect(saved).toContain('<p>Saved</p>')
    expect(saved).not.toContain('<script')

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'HTML editor' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Switch to HTML mode' })).toBeInTheDocument()
    })
  })

  it('keeps form proxy sanitized while editing raw HTML', () => {
    render(<BerryEditor defaultValue="<p>Hello</p>" name="content" />)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to HTML mode' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'HTML editor' }), {
      target: { value: '<p>Draft</p><script>alert(1)</script>' }
    })

    const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
    expect(proxy.value).toContain('<p>Draft</p>')
    expect(proxy.value).not.toContain('<script')
  })

  it('disables HTML mode toggle in read-only mode', () => {
    render(<BerryEditor defaultValue="<p>Hello</p>" readOnly />)

    const toggle = screen.getByRole('button', { name: 'Switch to HTML mode' })
    expect(toggle).toBeDisabled()
    fireEvent.click(toggle)
    expect(screen.queryByRole('textbox', { name: 'HTML editor' })).not.toBeInTheDocument()
  })

  it('preserves local HTML draft when controlled value changes externally', async () => {
    function ControlledHarness() {
      const [value, setValue] = useState('<p>Start</p>')
      return (
        <>
          <button type="button" onClick={() => setValue('<p>External</p>')}>
            External update
          </button>
          <BerryEditor value={value} onChange={setValue} />
        </>
      )
    }

    render(<ControlledHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to HTML mode' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'HTML editor' }), {
      target: { value: '<p>Draft wins</p>' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'External update' }))

    const htmlEditor = screen.getByRole('textbox', { name: 'HTML editor' }) as HTMLTextAreaElement
    expect(htmlEditor.value).toBe('<p>Draft wins</p>')

    fireEvent.click(screen.getByRole('button', { name: 'Switch to rich text mode' }))

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Rich text editor' })).toHaveTextContent(
        'Draft wins'
      )
    })
  })

  it('uploads image and document files through dedicated adapters', async () => {
    const imageUpload = vi.fn(async (file: File) => ({
      id: 'img-1',
      url: 'https://example.com/image.png',
      filename: file.name,
      filesize: file.size,
      contentType: file.type || 'image/png',
      previewUrl: 'https://example.com/image-preview.png'
    }))
    const documentUpload = vi.fn(async (file: File) => ({
      id: 'doc-1',
      url: 'https://example.com/file.pdf',
      filename: file.name,
      filesize: file.size,
      contentType: file.type || 'application/pdf'
    }))

    const { container } = render(
      <BerryEditor
        defaultValue="<p>Start</p>"
        name="content"
        imageAdapter={{ upload: imageUpload }}
        documentAdapter={{ upload: documentUpload }}
      />
    )

    const imageInput = container.querySelector('input[accept="image/*"]') as HTMLInputElement
    const documentInput = container.querySelector(
      'input[accept=".pdf,.doc,.docx,.txt,.rtf,.xlsx,.xls,.ppt,.pptx"]'
    ) as HTMLInputElement

    const imageFile = new File(['img'], 'photo.png', { type: 'image/png' })
    const documentFile = new File(['doc'], 'file.pdf', { type: 'application/pdf' })

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    const placeCursorInEditor = (): void => {
      const selection = window.getSelection()
      if (!selection) {
        throw new Error('Selection API unavailable')
      }
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    placeCursorInEditor()
    fireEvent.change(imageInput, { target: { files: [imageFile] } })

    placeCursorInEditor()
    fireEvent.change(documentInput, { target: { files: [documentFile] } })

    await waitFor(() => {
      expect(imageUpload).toHaveBeenCalledTimes(1)
      expect(documentUpload).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      const parsed = new DOMParser().parseFromString(proxy.value, 'text/html')
      const imageNode = parsed.querySelector(
        'img[data-berry-attachment-id][data-berry-content-type^="image/"]'
      )
      expect(imageNode).not.toBeNull()
      const imageContainer = imageNode?.closest('figure')
      expect(imageContainer).toBeNull()
    })
  })

  it('inserts uploaded images at the active cursor position', async () => {
    const imageUpload = vi.fn(async (file: File) => ({
      id: 'img-cursor',
      url: 'https://example.com/image.png',
      filename: file.name,
      filesize: file.size,
      contentType: file.type || 'image/png',
      previewUrl: 'https://example.com/image-preview.png'
    }))

    const { container } = render(
      <BerryEditor
        defaultValue="<p>AAA BBB</p>"
        name="content"
        imageAdapter={{ upload: imageUpload }}
      />
    )

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    placeCursorInFirstParagraphText(editor, 4)

    fireEvent.click(screen.getByRole('button', { name: 'Image' }))
    const imageInput = container.querySelector('input[accept="image/*"]') as HTMLInputElement
    const imageFile = new File(['img'], 'photo.png', { type: 'image/png' })
    fireEvent.change(imageInput, { target: { files: [imageFile] } })

    await waitFor(() => {
      expect(imageUpload).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toMatch(/AAA[\s\S]*data-berry-content-type="image\/png"[\s\S]*BBB/)
    })
  })

  it('inserts uploaded documents at the active cursor position', async () => {
    const documentUpload = vi.fn(async (file: File) => ({
      id: 'doc-cursor',
      url: 'https://example.com/file.pdf',
      filename: file.name,
      filesize: file.size,
      contentType: file.type || 'application/pdf'
    }))

    const { container } = render(
      <BerryEditor
        defaultValue="<p>AAA BBB</p>"
        name="content"
        documentAdapter={{ upload: documentUpload }}
      />
    )

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    placeCursorInFirstParagraphText(editor, 4)

    fireEvent.click(screen.getByRole('button', { name: 'Document' }))
    const documentInput = container.querySelector(
      'input[accept=".pdf,.doc,.docx,.txt,.rtf,.xlsx,.xls,.ppt,.pptx"]'
    ) as HTMLInputElement
    const documentFile = new File(['doc'], 'file.pdf', { type: 'application/pdf' })
    fireEvent.change(documentInput, { target: { files: [documentFile] } })

    await waitFor(() => {
      expect(documentUpload).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toMatch(/AAA[\s\S]*data-berry-content-type="application\/pdf"[\s\S]*BBB/)
    })
  })

  it('loads macro options from adapters and keeps built-in emoji picker available', async () => {
    const macroSearch = vi.fn(async () => [{ id: 'macro-a', label: 'Macro A' }])
    const macroResolve = vi.fn(async () => ({ html: '<p>Macro output</p>' }))

    render(
      <BerryEditor
        defaultValue="<p>Start</p>"
        macroAdapter={{ search: macroSearch, resolve: macroResolve }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    await screen.findByRole('textbox', { name: 'Search emoji' })

    fireEvent.click(screen.getByRole('button', { name: 'Macro' }))
    await waitFor(() => {
      expect(macroSearch).toHaveBeenCalled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Macro A' }))
    await waitFor(() => {
      expect(macroResolve).toHaveBeenCalledWith('macro-a')
    })
  })

  it('inserts macros at the active cursor position', async () => {
    const macroSearch = vi.fn(async () => [{ id: 'macro-a', label: 'Macro A' }])
    const macroResolve = vi.fn(async () => ({ html: '<span>MACRO</span>' }))

    render(
      <BerryEditor
        defaultValue="<p>AAA BBB</p>"
        name="content"
        macroAdapter={{ search: macroSearch, resolve: macroResolve }}
      />
    )

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    placeCursorInFirstParagraphText(editor, 4)

    fireEvent.click(screen.getByRole('button', { name: 'Macro' }))
    await waitFor(() => {
      expect(macroSearch).toHaveBeenCalled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Macro A' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      const parsed = new DOMParser().parseFromString(proxy.value, 'text/html')
      expect(parsed.body.textContent).toContain('AAA MACROBBB')
    })
  })

  it('loads default emoji options when no adapter is provided', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Start</p>"
        name="content"
        emojiPicker={{ persistPreferences: false, persistRecents: false }}
      />
    )

    const emojiButton = screen.getByRole('button', { name: 'Emoji' })
    expect(emojiButton).toBeEnabled()
    fireEvent.click(emojiButton)

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Search emoji' })).toBeInTheDocument()
    })
    expect(screen.getByRole('combobox', { name: 'Emoji category' })).toBeInTheDocument()
    expect(document.querySelectorAll('.berry-emoji-picker__emoji-button').length).toBeGreaterThan(
      20
    )
  })

  it('shows tone and gender selectors only for categories that support variants', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Start</p>"
        emojiPicker={{ persistPreferences: false, persistRecents: false }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    const categorySelect = await screen.findByRole('combobox', { name: 'Emoji category' })

    fireEvent.change(categorySelect, { target: { value: 'Flags' } })
    expect(screen.queryByRole('button', { name: 'Skin tone: Dark' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Woman' })).not.toBeInTheDocument()

    fireEvent.change(categorySelect, { target: { value: 'People & Body' } })
    expect(await screen.findByRole('button', { name: 'Skin tone: Dark' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Woman' })).toBeInTheDocument()
  })

  it('applies selected skin tone to gender selector emojis', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Start</p>"
        emojiPicker={{ persistPreferences: false, persistRecents: false }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    const categorySelect = await screen.findByRole('combobox', { name: 'Emoji category' })
    fireEvent.change(categorySelect, { target: { value: 'People & Body' } })

    const womanButton = await screen.findByRole('button', { name: 'Woman' })
    expect(womanButton).toHaveTextContent('👩')

    fireEvent.click(screen.getByRole('button', { name: 'Skin tone: Dark' }))
    expect(womanButton).toHaveTextContent('👩🏿')
  })

  it('searches emojis by keyword and inserts twemoji image html by default', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Start</p>"
        name="content"
        emojiPicker={{ persistPreferences: false, persistRecents: false }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    const search = await screen.findByRole('textbox', { name: 'Search emoji' })
    fireEvent.change(search, { target: { value: 'lol' } })

    const joyButton = await screen.findByRole('button', { name: /face with tears of joy/i })
    fireEvent.click(joyButton)

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('class="berry-emoji"')
      expect(proxy.value).toContain('data-berry-emoji=')
      expect(proxy.value).toContain(
        'src="https://cdn.jsdelivr.net/gh/jdecked/twemoji@v17.0.2/assets/svg/'
      )
    })
  })

  it('inserts emoji at the active text cursor position', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Hello world</p>"
        name="content"
        emojiPicker={{ insertMode: 'unicode', persistPreferences: false, persistRecents: false }}
      />
    )

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    placeCursorInFirstParagraphText(editor, 6)

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Search emoji' }), {
      target: { value: 'rocket' }
    })
    fireEvent.click(await screen.findByRole('button', { name: /rocket/i }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      const parsed = new DOMParser().parseFromString(proxy.value, 'text/html')
      expect(parsed.body.textContent).toContain('Hello 🚀world')
    })
  })

  it('keeps cursor after inserted twemoji emoji for follow-up typing', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Hello world</p>"
        name="content"
        emojiPicker={{ persistPreferences: false, persistRecents: false }}
      />
    )

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    placeCursorInFirstParagraphText(editor, 6)

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Search emoji' }), {
      target: { value: 'rocket' }
    })
    fireEvent.click(await screen.findByRole('button', { name: /rocket/i }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('class="berry-emoji"')
    })

    await waitFor(() => {
      expect(document.activeElement).toBe(editor)

      const emoji = editor.querySelector('img.berry-emoji')
      const selection = window.getSelection()
      if (!(emoji instanceof HTMLImageElement) || !selection || selection.rangeCount === 0) {
        throw new Error('Selection API unavailable')
      }

      const actual = selection.getRangeAt(0)
      const expected = document.createRange()
      expected.setStartAfter(emoji)
      expected.collapse(true)

      expect(actual.collapsed).toBe(true)
      expect(actual.compareBoundaryPoints(Range.START_TO_START, expected)).toBe(0)
    })
  })

  it('applies skin tone preference to emoji insertion', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Start</p>"
        name="content"
        emojiPicker={{ persistPreferences: false, persistRecents: false }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Search emoji' }), {
      target: { value: 'thumbs up' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Skin tone: Dark' }))

    fireEvent.click(await screen.findByRole('button', { name: /^thumbs up: dark skin tone$/i }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('👍🏿')
    })
  })

  it('applies gender preference to emoji insertion when a gendered variant exists', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Start</p>"
        name="content"
        emojiPicker={{ persistPreferences: false, persistRecents: false }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Search emoji' }), {
      target: { value: 'police officer' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Woman' }))
    fireEvent.click(await screen.findByRole('button', { name: /^woman police officer$/i }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('\u{1F46E}\u200D\u2640\uFE0F')
    })
  })

  it('persists selected skin tone and gender between picker mounts', async () => {
    window.localStorage.clear()

    const { unmount } = render(<BerryEditor defaultValue="<p>Start</p>" />)

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    fireEvent.change(await screen.findByRole('combobox', { name: 'Emoji category' }), {
      target: { value: 'People & Body' }
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Skin tone: Dark' }))
    fireEvent.click(screen.getByRole('button', { name: 'Woman' }))
    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))

    unmount()

    render(<BerryEditor defaultValue="<p>Start</p>" />)
    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    fireEvent.change(await screen.findByRole('combobox', { name: 'Emoji category' }), {
      target: { value: 'People & Body' }
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Skin tone: Dark' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      expect(screen.getByRole('button', { name: 'Woman' })).toHaveAttribute('aria-pressed', 'true')
    })

    window.localStorage.clear()
  })

  it('inserts explicitly selected context variant and updates preference', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Start</p>"
        name="content"
        emojiPicker={{ persistPreferences: false, persistRecents: false }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Search emoji' }), {
      target: { value: 'thumbs up' }
    })
    fireEvent.click(await screen.findByRole('button', { name: /^choose variants for thumbs up$/i }))
    const darkToneButtons = await screen.findAllByRole('button', {
      name: /^thumbs up: dark skin tone$/i
    })
    const explicitVariantButton =
      darkToneButtons.find((button) =>
        button.classList.contains('berry-emoji-picker__variant-button')
      ) ?? darkToneButtons[0]
    expect(explicitVariantButton).toBeDefined()
    fireEvent.click(explicitVariantButton as HTMLButtonElement)

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('👍🏿')
    })
  })

  it('updates recents after emoji insertion', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Start</p>"
        emojiPicker={{ persistPreferences: false, persistRecents: true }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Search emoji' }), {
      target: { value: 'rocket' }
    })
    fireEvent.click(await screen.findByRole('button', { name: /rocket/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    fireEvent.change(await screen.findByRole('combobox', { name: 'Emoji category' }), {
      target: { value: '__recents__' }
    })
    expect(await screen.findByRole('button', { name: /rocket/i })).toBeInTheDocument()
  })

  it('supports unicode insertion mode for the built-in emoji picker', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Start</p>"
        name="content"
        emojiPicker={{ insertMode: 'unicode', persistPreferences: false, persistRecents: false }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Search emoji' }), {
      target: { value: 'rocket' }
    })
    fireEvent.click(await screen.findByRole('button', { name: /rocket/i }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('🚀')
      expect(proxy.value).not.toContain('class="berry-emoji"')
    })
  })

  it('replaces pasted unicode emojis with twemoji images when insert mode is twemoji', async () => {
    render(<BerryEditor defaultValue="<p>Start</p>" name="content" />)

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    placeCursorInFirstParagraphText(editor, 5)

    fireEvent.paste(editor, {
      clipboardData: {
        files: [],
        getData: (type: string) => (type === 'text/html' ? '<p>😀</p>' : '')
      } as unknown as DataTransfer
    })

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('class="berry-emoji"')
      expect(proxy.value).toContain('data-berry-emoji="😀"')
      expect(proxy.value).toContain(
        'src="https://cdn.jsdelivr.net/gh/jdecked/twemoji@v17.0.2/assets/svg/1f600.svg"'
      )
    })
  })

  it('keeps pasted unicode emojis as text when insert mode is unicode', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Start</p>"
        name="content"
        emojiPicker={{ insertMode: 'unicode', persistPreferences: false, persistRecents: false }}
      />
    )

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    placeCursorInFirstParagraphText(editor, 5)

    fireEvent.paste(editor, {
      clipboardData: {
        files: [],
        getData: (type: string) => (type === 'text/html' ? '<p>😀</p>' : '')
      } as unknown as DataTransfer
    })

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('😀')
      expect(proxy.value).not.toContain('class="berry-emoji"')
    })
  })

  it('keeps pasted unicode emojis as text when twemoji rendering is disabled', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Start</p>"
        name="content"
        emojiPicker={{ useTwemoji: false, persistPreferences: false, persistRecents: false }}
      />
    )

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    placeCursorInFirstParagraphText(editor, 5)

    fireEvent.paste(editor, {
      clipboardData: {
        files: [],
        getData: (type: string) => (type === 'text/html' ? '<p>😀</p>' : '')
      } as unknown as DataTransfer
    })

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('😀')
      expect(proxy.value).not.toContain('class="berry-emoji"')
    })
  })

  it('normalizes unicode emojis to twemoji images when the editor blurs', async () => {
    render(<BerryEditor defaultValue="<p>Start 😀</p>" name="content" />)

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    fireEvent.focus(editor)
    fireEvent.blur(editor)

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('class="berry-emoji"')
      expect(proxy.value).toContain('data-berry-emoji=')
      expect(proxy.value).toContain(
        'src="https://cdn.jsdelivr.net/gh/jdecked/twemoji@v17.0.2/assets/svg/1f600.svg"'
      )
    })
  })

  it('does not normalize unicode emojis on blur when insert mode is unicode', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Start 😀</p>"
        name="content"
        emojiPicker={{ insertMode: 'unicode', persistPreferences: false, persistRecents: false }}
      />
    )

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    fireEvent.focus(editor)
    fireEvent.blur(editor)

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('😀')
      expect(proxy.value).not.toContain('class="berry-emoji"')
    })
  })

  it('does not normalize unicode emojis on blur when twemoji rendering is disabled', async () => {
    render(
      <BerryEditor
        defaultValue="<p>Start 😀</p>"
        name="content"
        emojiPicker={{ useTwemoji: false, persistPreferences: false, persistRecents: false }}
      />
    )

    const editor = screen.getByRole('textbox', { name: 'Rich text editor' })
    fireEvent.focus(editor)
    fireEvent.blur(editor)

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('😀')
      expect(proxy.value).not.toContain('class="berry-emoji"')
    })
  })

  it('renders a visual table matrix and inserts the selected dimensions', async () => {
    render(<BerryEditor defaultValue="<p>Start</p>" name="content" />)

    const editor = screen.getByRole('textbox')
    selectEditorText(editor)
    fireEvent.click(screen.getByRole('button', { name: 'Table' }))

    expect(screen.queryByRole('spinbutton', { name: /rows/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /cols/i })).not.toBeInTheDocument()

    selectEditorText(editor)
    fireEvent.click(screen.getByRole('gridcell', { name: 'Insert 2 by 3 table' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('<table')

      const parsed = new DOMParser().parseFromString(proxy.value, 'text/html')
      const rows = parsed.querySelectorAll('table tr')
      expect(rows).toHaveLength(2)
      expect(rows[0]?.children.length).toBe(3)
    })
  })

  it('applies black cell borders when table borders are enabled in the flyout', async () => {
    render(<BerryEditor defaultValue="<p>Start</p>" name="content" />)

    const editor = screen.getByRole('textbox')
    selectEditorText(editor)
    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Borders' }))

    selectEditorText(editor)
    fireEvent.click(screen.getByRole('gridcell', { name: 'Insert 1 by 1 table' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      const parsed = new DOMParser().parseFromString(proxy.value, 'text/html')
      const table = parsed.querySelector('table')
      const cell = parsed.querySelector('td')
      expect(table?.getAttribute('style')).toContain('border-collapse:collapse')
      expect(cell?.getAttribute('style')).toContain('border:1px solid #000000')
    })
  })

  it('shows contextual table bubble and executes row/table actions', async () => {
    render(
      <BerryEditor
        defaultValue="<table><tbody><tr><td>One</td></tr></tbody></table>"
        name="content"
      />
    )

    const editor = screen.getByRole('textbox')
    placeCursorInFirstTableCell(editor)
    fireEvent.mouseUp(editor)

    await waitFor(() => {
      expect(screen.getByRole('toolbar', { name: 'Table editing tools' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add row below' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      const parsed = new DOMParser().parseFromString(proxy.value, 'text/html')
      expect(parsed.querySelectorAll('table tr')).toHaveLength(2)
    })

    placeCursorInFirstTableCell(editor)
    fireEvent.click(screen.getByRole('button', { name: 'Delete table' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).not.toContain('<table')
    })
  })

  it('shows contextual image bubble and applies image controls from floating and main toolbars', async () => {
    render(
      <BerryEditor
        defaultValue={
          '<img class="berry-attachment-image" data-berry-attachment-id="img-1" data-berry-url="https://example.com/photo.png" data-berry-filename="photo.png" data-berry-filesize="123" data-berry-content-type="image/png" data-berry-preview-url="https://example.com/photo.png" data-berry-caption="" data-berry-pending="false" src="https://example.com/photo.png" alt="photo">'
        }
        name="content"
      />
    )

    const editor = screen.getByRole('textbox')
    const image = focusFirstAttachmentImage(editor)
    fireEvent.pointerDown(image)

    await waitFor(() => {
      expect(screen.getByRole('toolbar', { name: 'Image editing tools' })).toBeInTheDocument()
    })

    fireEvent.click(
      within(screen.getByRole('toolbar', { name: 'Image editing tools' })).getByRole('button', {
        name: 'Set image text wrap'
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Align right' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('data-berry-image-wrap="true"')
      expect(proxy.value).toContain('data-berry-image-wrap-side="right"')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Align center' }))
    fireEvent.click(screen.getByRole('button', { name: 'Insert or edit link' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Link URL' }), {
      target: { value: 'https://example.com/linked-photo' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('data-berry-image-align="center"')
      expect(proxy.value).not.toContain('data-berry-image-wrap="true"')
      expect(proxy.value).toContain('href="https://example.com/linked-photo"')
      expect(document.activeElement).toBe(editor)
    })

    const imageAgain = focusFirstAttachmentImage(editor)
    fireEvent.pointerDown(imageAgain)

    fireEvent.click(screen.getByRole('button', { name: 'Insert or edit link' }))
    fireEvent.click(screen.getByRole('button', { name: 'Unlink' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).not.toContain('href="https://example.com/linked-photo"')
    })

    const imageBeforeDelete = focusFirstAttachmentImage(editor)
    fireEvent.pointerDown(imageBeforeDelete)
    fireEvent.click(screen.getByRole('button', { name: 'Delete image' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).not.toContain('data-berry-attachment-id="img-1"')
      expect(screen.queryByRole('toolbar', { name: 'Image editing tools' })).not.toBeInTheDocument()
    })
  })

  it('applies custom link text and new-tab toggle for text links', async () => {
    render(<BerryEditor defaultValue="<p>Hello world</p>" name="content" />)

    const editor = screen.getByRole('textbox')
    selectEditorText(editor)
    fireEvent.mouseUp(editor)
    fireEvent.click(screen.getByRole('button', { name: 'Insert or edit link' }))

    expect(screen.getByRole('textbox', { name: 'Link text' })).toHaveValue('Hello world')
    fireEvent.change(screen.getByRole('textbox', { name: 'Link URL' }), {
      target: { value: 'https://example.com/docs' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Link text' }), {
      target: { value: 'Documentation' }
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Open in new tab' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      const parsed = new DOMParser().parseFromString(proxy.value, 'text/html')
      const link = parsed.querySelector('a')
      expect(link?.getAttribute('href')).toBe('https://example.com/docs')
      expect(link?.textContent).toBe('Documentation')
      expect(link?.getAttribute('target')).toBe('_blank')
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
    })
  })

  it('inserts page links at the active cursor position', async () => {
    render(
      <BerryEditor
        defaultValue="<p>AAA BBB</p>"
        name="content"
        linkPageOptions={[
          {
            id: 'docs-start',
            name: 'Docs Start',
            href: 'https://example.com/docs/start'
          }
        ]}
      />
    )

    const editor = screen.getByRole('textbox')
    placeCursorInFirstParagraphText(editor, 4)

    fireEvent.click(screen.getByRole('button', { name: 'Insert or edit link' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Pages' }))
    fireEvent.change(screen.getByRole('listbox', { name: 'Page links' }), {
      target: { value: 'pages1:docs-start' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      const parsed = new DOMParser().parseFromString(proxy.value, 'text/html')
      const link = parsed.querySelector('a')
      expect(link?.getAttribute('href')).toBe('https://example.com/docs/start')
      expect(parsed.body.textContent).toContain('AAA Docs StartBBB')
    })
  })

  it('shows only the URL tab when no page tabs are configured', () => {
    render(<BerryEditor defaultValue="<p>Hello world</p>" name="content" />)

    const editor = screen.getByRole('textbox')
    selectEditorText(editor)
    fireEvent.mouseUp(editor)
    fireEvent.click(screen.getByRole('button', { name: 'Insert or edit link' }))

    const tablist = screen.getByRole('tablist', { name: 'Link source' })
    const tabs = within(tablist)
      .getAllByRole('tab')
      .map((tab) => tab.textContent?.trim())
    expect(tabs).toEqual(['URL'])
  })

  it('supports nested page picker search for links', async () => {
    const onSearchLinkPages = vi.fn(async (query: string) => {
      if (query.toLowerCase().includes('release')) {
        return [
          {
            id: 'release-notes',
            name: 'Release Notes',
            href: 'https://example.com/docs/releases',
            children: []
          }
        ]
      }
      return []
    })
    const onSearchLinkPages2 = vi.fn(async () => [])

    render(
      <BerryEditor
        defaultValue="<p>Replace me</p>"
        name="content"
        linkPageOptions={[
          {
            id: 'docs',
            name: 'Docs',
            href: 'https://example.com/docs',
            children: [
              {
                id: 'guides',
                name: 'Guides',
                href: 'https://example.com/docs/guides',
                children: [
                  {
                    id: 'guides-start',
                    name: 'Getting Started',
                    href: 'https://example.com/docs/guides/getting-started'
                  }
                ]
              }
            ]
          }
        ]}
        linkPageOptions2={[
          {
            id: 'events',
            name: 'Events',
            href: 'https://example.com/events',
            children: [
              {
                id: 'events-townhall',
                name: 'Town Hall',
                href: 'https://example.com/events/town-hall'
              }
            ]
          }
        ]}
        linkPageTab2Label="Events"
        onSearchLinkPages={onSearchLinkPages}
        onSearchLinkPages2={onSearchLinkPages2}
      />
    )

    const editor = screen.getByRole('textbox')
    selectEditorText(editor)
    fireEvent.mouseUp(editor)
    fireEvent.click(screen.getByRole('button', { name: 'Insert or edit link' }))
    const tablist = screen.getByRole('tablist', { name: 'Link source' })
    const tabs = within(tablist)
      .getAllByRole('tab')
      .map((tab) => tab.textContent?.trim())
    expect(tabs).toEqual(['Pages', 'Events', 'URL'])
    fireEvent.click(screen.getByRole('tab', { name: 'Pages' }))

    fireEvent.change(screen.getByRole('textbox', { name: 'Search pages' }), {
      target: { value: 'started' }
    })

    const pageList = screen.getByRole('listbox', { name: 'Page links' })
    await screen.findByRole('option', { name: /Getting Started/i })
    expect(
      screen.getByText(/Docs \/ Guides \/ https:\/\/example.com\/docs\/guides\/getting-started/i)
    ).toBeInTheDocument()
    fireEvent.change(pageList, { target: { value: 'pages1:guides-start' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      const parsed = new DOMParser().parseFromString(proxy.value, 'text/html')
      const link = parsed.querySelector('a')
      expect(link?.getAttribute('href')).toBe('https://example.com/docs/guides/getting-started')
      expect(link?.textContent).toBe('Getting Started')
      expect(link?.getAttribute('target')).toBeNull()
    })

    selectEditorText(editor)
    fireEvent.mouseUp(editor)
    fireEvent.click(screen.getByRole('button', { name: 'Insert or edit link' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Pages' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Search pages' }), {
      target: { value: 'release' }
    })
    await screen.findByRole('option', { name: /Release Notes/i })
    expect(onSearchLinkPages).toHaveBeenCalledWith('release')

    selectEditorText(editor)
    fireEvent.mouseUp(editor)
    fireEvent.click(screen.getByRole('tab', { name: 'Events' }))
    await screen.findByRole('option', { name: /Town Hall/i })
    fireEvent.change(screen.getByRole('listbox', { name: 'Page links' }), {
      target: { value: 'pages2:events-townhall' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      const parsed = new DOMParser().parseFromString(proxy.value, 'text/html')
      const link = parsed.querySelector('a')
      expect(link?.getAttribute('href')).toBe('https://example.com/events/town-hall')
      expect(link?.textContent).toBe('Town Hall')
    })
  })

  it('applies text color through colorPicker.render hook', async () => {
    const { spy, restore } = mockExecCommandForColors()
    let commitFromPicker: unknown = null

    try {
      render(
        <BerryEditor
          defaultValue="<p>Hello</p>"
          name="content"
          colorPicker={{
            render: (props) => {
              commitFromPicker = props.onCommit
              return <div data-testid="custom-color-picker" />
            }
          }}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
      await screen.findByTestId('custom-color-picker')

      const editor = screen.getByRole('textbox')
      selectEditorText(editor)
      if (typeof commitFromPicker === 'function') {
        ;(commitFromPicker as (hex: string) => void)('#0ea5e9')
      } else {
        throw new Error('Missing render color picker commit hook')
      }

      await waitFor(() => {
        const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
        expect(proxy.value).toContain('color:#0ea5e9')
      })
      expect(spy).toHaveBeenCalledWith('foreColor', false, '#0ea5e9')
    } finally {
      restore()
    }
  })

  it('falls back to inline styling when browser color command is a no-op', async () => {
    const { restore } = mockExecCommandNoOpForColor()
    let commitFromPicker: unknown = null

    try {
      render(
        <BerryEditor
          defaultValue="<p>Hello</p>"
          name="content"
          colorPicker={{
            render: (props) => {
              commitFromPicker = props.onCommit
              return <div data-testid="no-op-color-picker" />
            }
          }}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
      await screen.findByTestId('no-op-color-picker')

      const editor = screen.getByRole('textbox')
      selectEditorText(editor)
      fireEvent.mouseUp(editor)

      if (typeof commitFromPicker === 'function') {
        ;(commitFromPicker as (hex: string) => void)('#0ea5e9')
      } else {
        throw new Error('Missing render color picker commit hook')
      }

      await waitFor(() => {
        const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
        expect(proxy.value).toContain('color:#0ea5e9')
      })
    } finally {
      restore()
    }
  })

  it('falls back to inline styling when browser color command collapses selection without mutating html', async () => {
    const { restore } = mockExecCommandCollapseNoOpForColor()
    let commitFromPicker: unknown = null

    try {
      render(
        <BerryEditor
          defaultValue="<p>Hello</p>"
          name="content"
          colorPicker={{
            render: (props) => {
              commitFromPicker = props.onCommit
              return <div data-testid="collapsed-no-op-color-picker" />
            }
          }}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
      await screen.findByTestId('collapsed-no-op-color-picker')

      const editor = screen.getByRole('textbox')
      selectEditorText(editor)
      fireEvent.mouseUp(editor)

      if (typeof commitFromPicker === 'function') {
        ;(commitFromPicker as (hex: string) => void)('#0ea5e9')
      } else {
        throw new Error('Missing render color picker commit hook')
      }

      await waitFor(() => {
        const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
        expect(proxy.value).toContain('color:#0ea5e9')
      })
    } finally {
      restore()
    }
  })

  it('mounts adapter-based color picker and triggers update/destroy lifecycle', async () => {
    const update = vi.fn()
    const destroy = vi.fn()
    const mount = vi.fn((context: unknown) => {
      void context
      return { update, destroy }
    })

    const { rerender, unmount } = render(
      <BerryEditor defaultValue="<p>Hello</p>" colorPicker={{ adapter: { mount } }} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))

    await waitFor(() => {
      expect(mount).toHaveBeenCalledTimes(1)
      const [firstCall] = mount.mock.calls
      if (!firstCall) throw new Error('Missing mount call')
      const [mountContext] = firstCall
      if (!mountContext || typeof mountContext !== 'object') {
        throw new Error('Missing mount context')
      }
      if (!('container' in mountContext)) {
        throw new Error('Missing mount container')
      }
      expect(mountContext).toEqual(
        expect.objectContaining({
          kind: 'text',
          value: '#111111'
        })
      )
      expect(mountContext.container).toBeInstanceOf(HTMLElement)
    })

    rerender(
      <BerryEditor defaultValue="<p>Hello</p>" disabled colorPicker={{ adapter: { mount } }} />
    )

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'text',
          disabled: true
        })
      )
    })

    unmount()
    expect(destroy).toHaveBeenCalled()
  })

  it('prefers colorPicker.render over colorPicker.adapter', async () => {
    const mount = vi.fn()
    const renderHook = vi.fn(() => <div data-testid="render-first-picker" />)

    render(
      <BerryEditor
        defaultValue="<p>Hello</p>"
        colorPicker={{
          render: renderHook,
          adapter: { mount }
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))

    await waitFor(() => {
      expect(renderHook).toHaveBeenCalled()
    })
    await screen.findByTestId('render-first-picker')
    expect(mount).not.toHaveBeenCalled()
  })

  it('applies font-size on change from remembered selection after live selection clears', async () => {
    render(<BerryEditor defaultValue="<p>Hello</p>" name="content" />)

    const editor = screen.getByRole('textbox')
    selectEditorText(editor)
    fireEvent.mouseUp(editor)

    const fontSizeInput = screen.getByRole('spinbutton', { name: 'Font size in pixels' })
    fontSizeInput.focus()
    window.getSelection()?.removeAllRanges()

    fireEvent.change(fontSizeInput, { target: { value: '18' } })

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('font-size:18px')
    })
    expect(document.activeElement).toBe(editor)

    fireEvent.change(fontSizeInput, { target: { value: '20' } })

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('font-size:20px')
    })
    expect(document.activeElement).toBe(editor)
  })

  it('applies font-size to the current paragraph only when selection spans multiple paragraphs', async () => {
    render(
      <BerryEditor defaultValue="<p>First paragraph</p><p>Second paragraph</p>" name="content" />
    )

    const editor = screen.getByRole('textbox')
    const paragraphs = editor.querySelectorAll('p')
    const firstText = paragraphs[0]?.firstChild
    const secondText = paragraphs[1]?.firstChild
    if (!(firstText instanceof Text) || !(secondText instanceof Text)) {
      throw new Error('Unable to prepare paragraph selection')
    }

    const range = document.createRange()
    range.setStart(firstText, 0)
    range.setEnd(secondText, secondText.data.length)
    const selection = window.getSelection()
    if (!selection) {
      throw new Error('Selection API unavailable')
    }
    selection.removeAllRanges()
    selection.addRange(range)
    fireEvent.mouseUp(editor)

    const fontSizeInput = screen.getByRole('spinbutton', { name: 'Font size in pixels' })
    fontSizeInput.focus()
    window.getSelection()?.removeAllRanges()
    fireEvent.change(fontSizeInput, { target: { value: '24' } })

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      const parsed = new DOMParser().parseFromString(proxy.value, 'text/html')
      const nextParagraphs = parsed.body.querySelectorAll('p')
      const firstStyle = nextParagraphs[0]?.getAttribute('style') ?? ''
      const secondStyle = nextParagraphs[1]?.getAttribute('style') ?? ''
      expect(firstStyle).not.toMatch(/font-size:\s*24px/i)
      expect(secondStyle).toMatch(/font-size:\s*24px/i)
    })
  })

  it('applies line-spacing on change from remembered selection after live selection clears', async () => {
    render(<BerryEditor defaultValue="<p>Hello</p>" name="content" />)

    const editor = screen.getByRole('textbox')
    selectEditorText(editor)
    fireEvent.mouseUp(editor)

    const lineSpacingInput = screen.getByRole('spinbutton', { name: 'Line spacing' })
    lineSpacingInput.focus()
    window.getSelection()?.removeAllRanges()

    fireEvent.change(lineSpacingInput, { target: { value: '1.8' } })

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toMatch(/line-height:\s*1\.8/i)
    })
    expect(document.activeElement).toBe(editor)

    fireEvent.change(lineSpacingInput, { target: { value: '2' } })

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toMatch(/line-height:\s*2(?:\.0+)?/i)
    })
    expect(document.activeElement).toBe(editor)
  })

  it('restores editor focus and caret position after font-size change', async () => {
    render(<BerryEditor defaultValue="<p>Hello</p>" name="content" />)

    const editor = screen.getByRole('textbox')
    placeCursorInFirstParagraphText(editor, 3)

    const fontSizeInput = screen.getByRole('spinbutton', { name: 'Font size in pixels' })
    fontSizeInput.focus()
    window.getSelection()?.removeAllRanges()
    fireEvent.change(fontSizeInput, { target: { value: '22' } })

    await waitFor(() => {
      expect(document.activeElement).toBe(editor)
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        throw new Error('Selection API unavailable')
      }
      const range = selection.getRangeAt(0)
      expect(range.collapsed).toBe(true)
      expect(range.startOffset).toBe(3)
      expect(range.startContainer.textContent).toContain('Hello')
    })
  })

  it('restores editor focus and caret position after line-spacing change', async () => {
    render(<BerryEditor defaultValue="<p>Hello</p>" name="content" />)

    const editor = screen.getByRole('textbox')
    placeCursorInFirstParagraphText(editor, 4)

    const lineSpacingInput = screen.getByRole('spinbutton', { name: 'Line spacing' })
    lineSpacingInput.focus()
    window.getSelection()?.removeAllRanges()
    fireEvent.change(lineSpacingInput, { target: { value: '2.3' } })

    await waitFor(() => {
      expect(document.activeElement).toBe(editor)
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        throw new Error('Selection API unavailable')
      }
      const range = selection.getRangeAt(0)
      expect(range.collapsed).toBe(true)
      expect(range.startOffset).toBe(4)
      expect(range.startContainer.textContent).toContain('Hello')
    })
  })

  it('applies line-spacing to the current paragraph only when selection spans multiple paragraphs', async () => {
    render(
      <BerryEditor defaultValue="<p>First paragraph</p><p>Second paragraph</p>" name="content" />
    )

    const editor = screen.getByRole('textbox')
    const paragraphs = editor.querySelectorAll('p')
    const firstText = paragraphs[0]?.firstChild
    const secondText = paragraphs[1]?.firstChild
    if (!(firstText instanceof Text) || !(secondText instanceof Text)) {
      throw new Error('Unable to prepare paragraph selection')
    }

    const range = document.createRange()
    range.setStart(firstText, 0)
    range.setEnd(secondText, secondText.data.length)
    const selection = window.getSelection()
    if (!selection) {
      throw new Error('Selection API unavailable')
    }
    selection.removeAllRanges()
    selection.addRange(range)
    fireEvent.mouseUp(editor)

    const lineSpacingInput = screen.getByRole('spinbutton', { name: 'Line spacing' })
    lineSpacingInput.focus()
    window.getSelection()?.removeAllRanges()
    fireEvent.change(lineSpacingInput, { target: { value: '2.2' } })

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      const parsed = new DOMParser().parseFromString(proxy.value, 'text/html')
      const nextParagraphs = parsed.body.querySelectorAll('p')
      const firstStyle = nextParagraphs[0]?.getAttribute('style') ?? ''
      const secondStyle = nextParagraphs[1]?.getAttribute('style') ?? ''
      expect(firstStyle).not.toMatch(/line-height:\s*2\.2/i)
      expect(secondStyle).toMatch(/line-height:\s*2\.2/i)
    })
  })

  it('rejects invalid colors from custom picker hooks', async () => {
    const { spy, restore } = mockExecCommandForColors()
    let commitFromPicker: unknown = null

    try {
      render(
        <BerryEditor
          defaultValue="<p>Hello</p>"
          name="content"
          colorPicker={{
            render: (props) => {
              commitFromPicker = props.onCommit
              return <div data-testid="invalid-color-picker" />
            }
          }}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
      await screen.findByTestId('invalid-color-picker')

      const editor = screen.getByRole('textbox')
      selectEditorText(editor)
      if (typeof commitFromPicker === 'function') {
        ;(commitFromPicker as (hex: string) => void)('#12')
        ;(commitFromPicker as (hex: string) => void)('red')
      } else {
        throw new Error('Missing render color picker commit hook')
      }

      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).toContain('<p>Hello</p>')
      expect(proxy.value).not.toContain('color:')
      expect(spy).not.toHaveBeenCalledWith('foreColor', false, '#12')
      expect(spy).not.toHaveBeenCalledWith('foreColor', false, 'red')
    } finally {
      restore()
    }
  })

  it('applies color commit even after selection is temporarily cleared', async () => {
    const { spy, restore } = mockExecCommandForColors()
    let commitFromPicker: unknown = null

    try {
      render(
        <BerryEditor
          defaultValue="<p>Hello</p>"
          name="content"
          colorPicker={{
            render: (props) => {
              commitFromPicker = props.onCommit
              return <div data-testid="selection-recovery-picker" />
            }
          }}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
      await screen.findByTestId('selection-recovery-picker')

      const editor = screen.getByRole('textbox')
      selectEditorText(editor)
      fireEvent.mouseUp(editor)
      window.getSelection()?.removeAllRanges()

      if (typeof commitFromPicker === 'function') {
        ;(commitFromPicker as (hex: string) => void)('#0ea5e9')
      } else {
        throw new Error('Missing render color picker commit hook')
      }

      await waitFor(() => {
        const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
        expect(proxy.value).toContain('color:#0ea5e9')
      })
      expect(spy).toHaveBeenCalledWith('foreColor', false, '#0ea5e9')
    } finally {
      restore()
    }
  })

  it('applies color commit from last expanded selection when current selection is collapsed', async () => {
    const { restore } = mockExecCommandNoOpForColor()
    let commitFromPicker: unknown = null

    try {
      render(
        <BerryEditor
          defaultValue="<p>Hello</p>"
          name="content"
          colorPicker={{
            render: (props) => {
              commitFromPicker = props.onCommit
              return <div data-testid="collapsed-selection-picker" />
            }
          }}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
      await screen.findByTestId('collapsed-selection-picker')

      const editor = screen.getByRole('textbox')
      selectEditorText(editor)
      fireEvent.mouseUp(editor)

      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        throw new Error('Selection API unavailable')
      }
      const collapsedRange = selection.getRangeAt(0).cloneRange()
      collapsedRange.collapse(false)
      selection.removeAllRanges()
      selection.addRange(collapsedRange)

      if (typeof commitFromPicker === 'function') {
        ;(commitFromPicker as (hex: string) => void)('#0ea5e9')
      } else {
        throw new Error('Missing render color picker commit hook')
      }

      await waitFor(() => {
        const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
        expect(proxy.value).toContain('color:#0ea5e9')
      })
    } finally {
      restore()
    }
  })

  it('tracks expanded selection via document selectionchange for color fallback recovery', async () => {
    const { restore } = mockExecCommandNoOpForColor()
    let commitFromPicker: unknown = null

    try {
      render(
        <BerryEditor
          defaultValue="<p>Hello world</p>"
          name="content"
          colorPicker={{
            render: (props) => {
              commitFromPicker = props.onCommit
              return <div data-testid="selectionchange-recovery-picker" />
            }
          }}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
      await screen.findByTestId('selectionchange-recovery-picker')

      const editor = screen.getByRole('textbox')
      selectEditorText(editor)
      document.dispatchEvent(new Event('selectionchange'))
      window.getSelection()?.removeAllRanges()

      if (typeof commitFromPicker === 'function') {
        ;(commitFromPicker as (hex: string) => void)('#0ea5e9')
      } else {
        throw new Error('Missing render color picker commit hook')
      }

      await waitFor(() => {
        const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
        expect(proxy.value).toContain('color:#0ea5e9')
      })
    } finally {
      restore()
    }
  })

  it('falls back to inline styling when browser applies foreColor via font tags on multi-word selections', async () => {
    const { restore } = mockExecCommandColorWithFontTag()
    let commitFromPicker: unknown = null

    try {
      render(
        <BerryEditor
          defaultValue="<p>Hello world</p>"
          name="content"
          colorPicker={{
            render: (props) => {
              commitFromPicker = props.onCommit
              return <div data-testid="font-tag-color-picker" />
            }
          }}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
      await screen.findByTestId('font-tag-color-picker')

      const editor = screen.getByRole('textbox')
      selectEditorText(editor)
      fireEvent.mouseUp(editor)

      if (typeof commitFromPicker === 'function') {
        ;(commitFromPicker as (hex: string) => void)('#0ea5e9')
      } else {
        throw new Error('Missing render color picker commit hook')
      }

      await waitFor(() => {
        const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
        expect(proxy.value).toContain('color:#0ea5e9')
        expect(proxy.value).not.toContain('<font')
      })
    } finally {
      restore()
    }
  })

  it('shows a clear-highlight action in the highlight color picker', () => {
    render(<BerryEditor defaultValue="<p>Hello</p>" />)

    fireEvent.click(screen.getByRole('button', { name: 'Highlight color' }))

    expect(screen.getByRole('button', { name: 'Clear highlight' })).toBeInTheDocument()
  })

  it('adds trailing whitespace after applying highlight color', async () => {
    const { restore } = mockExecCommandNoOpForColor()
    let commitHighlight: unknown = null

    try {
      render(
        <BerryEditor
          defaultValue="<p>Hello</p>"
          name="content"
          colorPicker={{
            render: (props) => {
              if (props.kind === 'highlight') {
                commitHighlight = props.onCommit
              }
              return <div data-testid={`highlight-whitespace-picker-${props.kind}`} />
            }
          }}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Highlight color' }))
      await screen.findByTestId('highlight-whitespace-picker-highlight')

      const editor = screen.getByRole('textbox')
      selectEditorText(editor)
      fireEvent.mouseUp(editor)

      if (typeof commitHighlight === 'function') {
        ;(commitHighlight as (hex: string) => void)('#facc15')
      } else {
        throw new Error('Missing highlight picker commit hook')
      }

      await waitFor(() => {
        const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
        const parsed = new DOMParser().parseFromString(proxy.value, 'text/html')
        const highlightedSpan = parsed.body.querySelector(
          'span[style*="background-color:#facc15"]'
        ) as HTMLSpanElement | null
        expect(highlightedSpan).not.toBeNull()
        const trailingNode = highlightedSpan?.nextSibling
        expect(trailingNode?.nodeType).toBe(Node.TEXT_NODE)
        expect((trailingNode as Text).data).toMatch(/^[\s\u00A0]/)
      })
    } finally {
      restore()
    }
  })

  it('clear highlight removes highlight from the nearest highlighted parent at cursor', async () => {
    render(
      <BerryEditor
        defaultValue='<p><span style="background-color:#facc15">Hello</span> world</p>'
        name="content"
      />
    )

    const editor = screen.getByRole('textbox')
    const highlightedTextNode = editor.querySelector('span[style*="background-color"]')?.firstChild
    if (!(highlightedTextNode instanceof Text)) {
      throw new Error('Unable to find highlighted text')
    }

    const range = document.createRange()
    range.setStart(highlightedTextNode, 2)
    range.collapse(true)
    const selection = window.getSelection()
    if (!selection) {
      throw new Error('Selection API unavailable')
    }
    selection.removeAllRanges()
    selection.addRange(range)
    fireEvent.mouseUp(editor)

    fireEvent.click(screen.getByRole('button', { name: 'Highlight color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear highlight' }))

    await waitFor(() => {
      const proxy = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement
      expect(proxy.value).not.toContain('background-color')
      expect(proxy.value).toContain('<p>Hello world</p>')
    })
  })

  it('exposes onClear for highlight picker hooks and closes the picker', async () => {
    let clearHighlight: unknown = null

    render(
      <BerryEditor
        defaultValue="<p>Hello</p>"
        name="content"
        colorPicker={{
          render: (props) => {
            if (props.kind === 'highlight') {
              clearHighlight = props.onClear
            }
            return <div data-testid={`highlight-clear-picker-${props.kind}`} />
          }
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Highlight color' }))
    await screen.findByTestId('highlight-clear-picker-highlight')

    if (typeof clearHighlight !== 'function') {
      throw new Error('Missing highlight clear hook')
    }
    ;(clearHighlight as () => void)()

    await waitFor(() => {
      expect(screen.queryByTestId('highlight-clear-picker-highlight')).not.toBeInTheDocument()
    })
  })
})
