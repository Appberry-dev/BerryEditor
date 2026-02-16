export const QUICK_START_INSTALL = `pnpm add @appberry/berryeditor`

export const QUICK_START_BASIC = `import { BerryEditor } from '@appberry/berryeditor'
import '@appberry/berryeditor/styles.css'

export function Example() {
  return <BerryEditor defaultValue="<p>Hello world</p>" />
}`

export const QUICK_START_NEXT_APP_ROUTER = `'use client'

import { BerryEditor } from '@appberry/berryeditor/next'
import '@appberry/berryeditor/styles.css'

export default function EditorClient() {
  return (
    <BerryEditor
      name="content"
      required
      defaultValue="<h2>Welcome</h2><p>Write here...</p>"
    />
  )
}`

export const QUICK_START_CONTROLLED = `import { useState } from 'react'
import { BerryEditor } from '@appberry/berryeditor'

export function ControlledEditor() {
  const [html, setHTML] = useState('<p>Initial content</p>')

  return <BerryEditor value={html} onChange={setHTML} />
}`

export const QUICK_START_TOOLBAR_ITEMS = `import { BerryEditor, type BerryToolbarItemsConfig } from '@appberry/berryeditor'

const minimalToolbar: BerryToolbarItemsConfig = {
  showOnly: ['bold', 'italic', 'underline', 'link', 'image', 'htmlToggle']
}

const noMacroToolbar: BerryToolbarItemsConfig = {
  hideOnly: ['macro']
}

export function ToolbarItemsExample() {
  return (
    <>
      <BerryEditor
        defaultValue="<p>Minimal toolbar profile</p>"
        toolbarItems={minimalToolbar}
      />

      <BerryEditor
        defaultValue="<p>All controls except macro</p>"
        toolbarItems={noMacroToolbar}
      />
    </>
  )
}`

export const QUICK_START_EMOJI_PICKER = `import { BerryEditor } from '@appberry/berryeditor'

export function EmojiPickerOptionsExample() {
  return (
    <BerryEditor
      defaultValue="<p>Emoji config demo</p>"
      emojiPicker={{
        useTwemoji: false,
        insertMode: 'unicode',
        showCategories: true
      }}
    />
  )
}`

export const QUICK_START_ADAPTERS = `import type { ImageAdapter, DocumentAdapter } from '@appberry/berryeditor'

const imageAdapter: ImageAdapter = {
  upload: async (file, { setProgress }) => {
    setProgress(100)
    const objectURL = URL.createObjectURL(file)
    return {
      id: crypto.randomUUID(),
      url: objectURL,
      previewUrl: objectURL,
      filename: file.name,
      filesize: file.size,
      contentType: file.type || 'application/octet-stream'
    }
  }
}

const documentAdapter: DocumentAdapter = {
  upload: async (file, { setProgress }) => {
    setProgress(100)
    return {
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      filename: file.name,
      filesize: file.size,
      contentType: file.type || 'application/octet-stream'
    }
  }
}`

export const QUICK_START_MACROS = `import { useMemo } from 'react'
import {
  BerryEditor,
  type MacroAdapter,
  type MacroOption
} from '@appberry/berryeditor'

const MACRO_OPTIONS: MacroOption[] = [
  { id: 'signature', label: 'Signature', description: 'Insert sign-off block' },
  { id: 'disclaimer', label: 'Disclaimer', description: 'Insert legal disclaimer' },
  { id: 'support', label: 'Support CTA', description: 'Insert support contact section' }
]

function resolveMacroHTML(macroId: string): string {
  if (macroId === 'signature') {
    return '<p><strong>Best regards,</strong><br/>Berry Team</p>'
  }
  if (macroId === 'disclaimer') {
    return '<p><em>This message may contain confidential information.</em></p>'
  }
  return '<p>Need help? <a href="https://appberry.dev/contact">Contact support</a>.</p>'
}

export function EditorWithMacros() {
  const macroAdapter = useMemo<MacroAdapter>(
    () => ({
      search: async (query) => {
        const q = query.trim().toLowerCase()
        if (!q) return MACRO_OPTIONS
        return MACRO_OPTIONS.filter(
          (option) =>
            option.label.toLowerCase().includes(q) ||
            (option.description ?? '').toLowerCase().includes(q)
        )
      },
      resolve: async (macroId) => ({ html: resolveMacroHTML(macroId) })
    }),
    []
  )

  return (
    <BerryEditor
      defaultValue="<p>Use Insert > Macro to add predefined content.</p>"
      macroAdapter={macroAdapter}
    />
  )
}`

export const QUICK_START_FILE_MANAGER = `import { useRef } from 'react'
import {
  BerryEditor,
  type BerryEditorHandle,
  type DocumentAdapter,
  type ImageAdapter
} from '@appberry/berryeditor'

type MediaAsset = {
  id: string
  url: string
  filename: string
  filesize: number
  contentType: string
  alt?: string
}

async function uploadMedia(
  file: File,
  kind: 'image' | 'document',
  signal: AbortSignal
): Promise<MediaAsset> {
  const formData = new FormData()
  formData.set('file', file)
  formData.set('kind', kind)

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    body: formData,
    signal
  })

  if (!response.ok) throw new Error('Upload failed')
  return response.json()
}

export function EditorWithAssetManager() {
  const editorRef = useRef<BerryEditorHandle>(null)

  const imageAdapter: ImageAdapter = {
    accept: 'image/*',
    upload: async (file, { signal, setProgress }) => {
      setProgress(20)
      const asset = await uploadMedia(file, 'image', signal)
      setProgress(100)

      return {
        ...asset,
        previewUrl: asset.url
      }
    }
  }

  const documentAdapter: DocumentAdapter = {
    accept: '.pdf,.doc,.docx,.txt',
    upload: async (file, { signal, setProgress }) => {
      setProgress(20)
      const asset = await uploadMedia(file, 'document', signal)
      setProgress(100)
      return asset
    }
  }

  async function insertFromManager(kind: 'image' | 'document') {
    // Replace with your own CMS/media library picker.
    const asset = await openMyAssetManager(kind)
    if (!asset) return

    if (kind === 'image') {
      editorRef.current?.exec('insertHTML', {
        html: \`<img src="\${asset.url}" alt="\${asset.alt ?? asset.filename}" />\`
      })
      return
    }

    editorRef.current?.exec('insertHTML', {
      html: \`<p><a href="\${asset.url}" target="_blank" rel="noopener noreferrer">\${asset.filename}</a></p>\`
    })
  }

  return (
    <>
      <button type="button" onClick={() => insertFromManager('image')}>
        Insert image from manager
      </button>
      <button type="button" onClick={() => insertFromManager('document')}>
        Insert document from manager
      </button>
      <BerryEditor
        ref={editorRef}
        imageAdapter={imageAdapter}
        documentAdapter={documentAdapter}
      />
    </>
  )
}`

export const QUICK_START_BERRYPICKR = `import { createBerryPickrController } from '@appberry/berrypickr'
import { useMountedBerryPickrUI } from '@appberry/berrypickr/react'
import { useEffect, useRef, type ReactElement } from 'react'
import { BerryEditor, type ColorPickerRenderProps } from '@appberry/berryeditor'

function BerryPickrColorPicker({
  value,
  disabled,
  swatches,
  onCommit,
  onClose
}: ColorPickerRenderProps): ReactElement {
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<ReturnType<typeof createBerryPickrController> | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = createBerryPickrController({
      format: 'hex',
      formats: ['hex'],
      lockAlpha: true,
      disabled,
      swatches,
      value
    })
  }
  const controller = controllerRef.current

  useMountedBerryPickrUI(controller, anchorRef, {
    uiOptions: { mode: 'inline', showAlways: true },
    removeOnUnmount: true
  })

  useEffect(() => {
    controller.updateOptions({
      format: 'hex',
      formats: ['hex'],
      lockAlpha: true,
      disabled,
      swatches
    })
    controller.setValue(value, { source: 'options' })
  }, [controller, disabled, swatches, value])

  useEffect(() => {
    return controller.on('change', (event) => {
      const hex = event.value?.to('hex')
      if (hex) onCommit(hex)
    })
  }, [controller, onCommit])

  return (
    <div>
      <div ref={anchorRef} />
      <button type="button" onClick={onClose} disabled={disabled}>
        Close
      </button>
    </div>
  )
}

export function EditorWithBerryPickr() {
  return (
    <BerryEditor
      colorPicker={{
        render: (props) => <BerryPickrColorPicker {...props} />
      }}
    />
  )
}`

export const QUICK_START_HTML_MODE = `import { BerryEditor } from '@appberry/berryeditor'

export function HtmlModeExample() {
  return (
    <BerryEditor
      defaultValue="<p>Hello</p>"
      onHTMLSanitizeNotice={(event) => {
        if (event.changed) {
          console.warn(event.message)
        }
      }}
    />
  )
}`
