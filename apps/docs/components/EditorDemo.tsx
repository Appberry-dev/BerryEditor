'use client'

import { BerryEditor } from '@appberry/berryeditor'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  BerryEditorHandle,
  DocumentAdapter,
  FontFamilyOption,
  ImageAdapter,
  LinkPageOption,
  MacroAdapter
} from '@appberry/berryeditor'
import { Progress, ScrollArea, Separator, Skeleton, Tabs, TabsContent, Toggle } from './ui'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const DEFAULT_MACROS = [
  { id: 'macro-signature', label: 'Signature', description: 'Insert a default signature block' },
  { id: 'macro-disclaimer', label: 'Disclaimer', description: 'Insert legal disclaimer paragraph' },
  { id: 'macro-callout', label: 'Callout', description: 'Insert highlighted callout text' }
]

const DEMO_PAGE_LINKS: LinkPageOption[] = [
  {
    id: 'docs-home',
    name: 'Docs',
    href: '/docs',
    children: [
      {
        id: 'docs-get-started',
        name: 'Get Started',
        href: '/docs/quick-start',
        children: [
          {
            id: 'docs-hooks',
            name: 'Hooks',
            href: '/docs/hooks'
          },
          {
            id: 'docs-styling',
            name: 'Styling',
            href: '/docs/styling'
          }
        ]
      },
      {
        id: 'docs-api',
        name: 'API Reference',
        href: '/docs/api'
      },
      {
        id: 'docs-accessibility',
        name: 'Accessibility',
        href: '/docs/accessibility'
      }
    ]
  }
]

const DEMO_EVENT_LINKS: LinkPageOption[] = [
  {
    id: 'events-2026',
    name: '2026 Events',
    href: '/events/2026',
    children: [
      {
        id: 'events-launch',
        name: 'Product Launch',
        href: '/events/2026/product-launch'
      },
      {
        id: 'events-webinar',
        name: 'Quarterly Webinar',
        href: '/events/2026/webinar-q1'
      }
    ]
  },
  {
    id: 'events-archive',
    name: 'Event Archive',
    href: '/events/archive'
  }
]

const DEMO_FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  { label: 'System UI', value: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  { label: 'Sora', value: '"Sora", "Avenir Next", "Segoe UI", sans-serif' },
  { label: 'Inter', value: 'Inter, "Avenir Next", "Segoe UI", sans-serif' },
  { label: 'Helvetica', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  {
    label: 'Trebuchet MS',
    value: '"Trebuchet MS", "Lucida Sans Unicode", "Lucida Grande", "Lucida Sans", sans-serif'
  },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Palatino', value: 'Palatino, "Palatino Linotype", "Book Antiqua", serif' },
  { label: 'Garamond', value: 'Garamond, "Times New Roman", serif' },
  { label: 'IBM Plex Serif', value: '"IBM Plex Serif", Georgia, "Times New Roman", serif' },
  { label: 'Merriweather', value: 'Merriweather, Georgia, "Times New Roman", serif' },
  { label: 'Consolas', value: 'Consolas, "Liberation Mono", "Courier New", monospace' },
  { label: 'IBM Plex Mono', value: '"IBM Plex Mono", Consolas, "Courier New", monospace' },
  { label: 'Lucida Console', value: '"Lucida Console", "Courier New", monospace' }
]

type UploadKind = 'image' | 'document'

type UploadStatus = {
  kind: UploadKind
  filename: string
  progress: number
}

const DEMO_DEFAULT_HTML =
  '<h1 style="font-family:Palatino, &quot;Palatino Linotype&quot;, &quot;Book Antiqua&quot;, serif;font-size:40px"><span style="color:#e11d48">Welcome to BerryEditor!</span> 😆✌️</h1><p>BerryEditor combines <b>rich text editing</b>, <b>HTML source mode</b>, <b>uploads</b>, <b>macros</b>, <b>emoji tooling</b>, and<b> typed adapters</b> into <i style="background-color:#facc15">one customizable package</i> for <u>modern React apps</u>.</p>'

async function resolveMacroHTML(macroId: string): Promise<string> {
  await sleep(80)
  if (macroId === 'macro-signature') {
    return '<p><strong>Best regards,</strong><br>Berry Team</p>'
  }
  if (macroId === 'macro-disclaimer') {
    return '<p><em>This message is confidential and intended for the recipient only.</em></p>'
  }
  return '<blockquote><p><strong>Note:</strong> Review this section before publishing.</p></blockquote>'
}

function Icon({ glyph }: { glyph: string }) {
  return (
    <span className="demo-material-icon" aria-hidden="true">
      {glyph}
    </span>
  )
}

function ActionButton({
  children,
  onClick,
  disabled,
  className
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`demo-action-button${className ? ` ${className}` : ''}`}
    >
      {children}
    </button>
  )
}

export function EditorDemo() {
  const editorRef = useRef<BerryEditorHandle | null>(null)
  const objectURLsRef = useRef<Set<string>>(new Set())
  const toolbarLoadingTimeoutRef = useRef<number | null>(null)
  const [html, setHTML] = useState(DEMO_DEFAULT_HTML)
  const [disabled, setDisabled] = useState(false)
  const [showCategoryLabels, setShowCategoryLabels] = useState(true)
  const [useTwemoji, setUseTwemoji] = useState(true)
  const [toolbarLoading, setToolbarLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null)

  const triggerToolbarLoading = useCallback((durationMs = 900) => {
    if (toolbarLoadingTimeoutRef.current !== null) {
      window.clearTimeout(toolbarLoadingTimeoutRef.current)
      toolbarLoadingTimeoutRef.current = null
    }

    setToolbarLoading(true)
    toolbarLoadingTimeoutRef.current = window.setTimeout(() => {
      setToolbarLoading(false)
      toolbarLoadingTimeoutRef.current = null
    }, durationMs)
  }, [])

  const createDemoObjectURL = useCallback((blob: Blob): string => {
    const objectURL = URL.createObjectURL(blob)
    objectURLsRef.current.add(objectURL)
    return objectURL
  }, [])

  const resetDemo = useCallback(() => {
    for (const objectURL of objectURLsRef.current) {
      URL.revokeObjectURL(objectURL)
    }
    objectURLsRef.current.clear()
    setUploadStatus(null)
    setHTML(DEMO_DEFAULT_HTML)
  }, [])

  useEffect(() => {
    const objectURLs = objectURLsRef.current
    triggerToolbarLoading()

    return () => {
      if (toolbarLoadingTimeoutRef.current !== null) {
        window.clearTimeout(toolbarLoadingTimeoutRef.current)
        toolbarLoadingTimeoutRef.current = null
      }

      for (const objectURL of objectURLs) {
        URL.revokeObjectURL(objectURL)
      }
      objectURLs.clear()
    }
  }, [triggerToolbarLoading])

  const handleEditorChange = useCallback((nextHTML: string) => {
    setHTML(nextHTML)
  }, [])

  const runSimulatedUpload = async (
    file: File,
    kind: UploadKind,
    setProgress: (value: number) => void,
    signal: AbortSignal
  ): Promise<void> => {
    setUploadStatus({ kind, filename: file.name, progress: 0 })

    for (let i = 1; i <= 10; i += 1) {
      if (signal.aborted) {
        setUploadStatus((current) => (current?.filename === file.name ? null : current))
        throw new DOMException('Upload aborted', 'AbortError')
      }

      await sleep(60)
      const progress = i * 10
      setProgress(progress)
      setUploadStatus((current) => {
        if (!current || current.filename !== file.name) return current
        return { ...current, progress }
      })
    }

    setUploadStatus((current) => (current?.filename === file.name ? null : current))
  }

  const imageAdapter = useMemo<ImageAdapter>(
    () => ({
      accept: 'image/*',
      upload: async (file, { setProgress, signal }) => {
        await runSimulatedUpload(file, 'image', setProgress, signal)
        const attachmentId = crypto.randomUUID()
        const objectURL = createDemoObjectURL(file)

        return {
          id: attachmentId,
          url: objectURL,
          filename: file.name,
          filesize: file.size,
          contentType: file.type || 'application/octet-stream',
          previewUrl: objectURL
        }
      }
    }),
    [createDemoObjectURL]
  )

  const documentAdapter = useMemo<DocumentAdapter>(
    () => ({
      accept: '.pdf,.doc,.docx,.txt,.rtf',
      upload: async (file, { setProgress, signal }) => {
        await runSimulatedUpload(file, 'document', setProgress, signal)
        const attachmentId = crypto.randomUUID()

        return {
          id: attachmentId,
          url: createDemoObjectURL(file),
          filename: file.name,
          filesize: file.size,
          contentType: file.type || 'application/octet-stream'
        }
      }
    }),
    [createDemoObjectURL]
  )

  const macroAdapter = useMemo<MacroAdapter>(
    () => ({
      search: async (query: string) => {
        const value = query.trim().toLowerCase()
        if (!value) return DEFAULT_MACROS
        return DEFAULT_MACROS.filter(
          (macro) =>
            macro.label.toLowerCase().includes(value) ||
            (macro.description ?? '').toLowerCase().includes(value)
        )
      },
      resolve: async (macroId: string) => ({ html: await resolveMacroHTML(macroId) })
    }),
    []
  )

  return (
    <section className="demo-wrap">
      <div className="demo-actions demo-actions--grid">
        <div className="demo-action-group">
          <ActionButton onClick={() => editorRef.current?.focus()}>
            <Icon glyph="target" />
            Focus
          </ActionButton>
          <ActionButton onClick={resetDemo}>
            <Icon glyph="restart_alt" />
            Reset
          </ActionButton>
          <ActionButton onClick={() => triggerToolbarLoading()}>
            <Icon glyph="hourglass_top" />
            Simulate Load
          </ActionButton>
          <Toggle
            pressed={disabled}
            onPressedChange={setDisabled}
            className="demo-disabled-toggle"
            aria-label="Disable editor"
          >
            <Icon glyph="toggle_off" />
            {disabled ? 'Disabled' : 'Enabled'}
          </Toggle>
          <Toggle
            pressed={showCategoryLabels}
            onPressedChange={setShowCategoryLabels}
            className="demo-disabled-toggle"
            aria-label="Toggle category labels"
          >
            <Icon glyph="label" />
            {showCategoryLabels ? 'Labels On' : 'Labels Off'}
          </Toggle>
          <Toggle
            pressed={useTwemoji}
            onPressedChange={setUseTwemoji}
            className="demo-disabled-toggle"
            aria-label="Toggle Twemoji rendering"
          >
            <Icon glyph="emoji_emotions" />
            {useTwemoji ? 'Twemoji On' : 'Twemoji Off'}
          </Toggle>
        </div>

        <Separator orientation="vertical" className="demo-separator" />
      </div>

      {uploadStatus ? (
        <div className="demo-upload-status" aria-live="polite">
          <div className="demo-upload-meta">
            <strong>
              {uploadStatus.kind === 'image' ? 'Uploading image' : 'Uploading document'}
            </strong>
            <span>{uploadStatus.filename}</span>
          </div>
          <Progress value={uploadStatus.progress} />
          <Skeleton className="demo-upload-skeleton" />
        </div>
      ) : null}

      <Tabs defaultValue="editor" className="demo-tabs">
        <TabsContent value="editor">
          <BerryEditor
            ref={editorRef}
            value={html}
            onChange={handleEditorChange}
            name="content"
            placeholder="Write bold ideas..."
            imageAdapter={imageAdapter}
            documentAdapter={documentAdapter}
            macroAdapter={macroAdapter}
            fontFamilyOptions={DEMO_FONT_FAMILY_OPTIONS}
            linkPageOptions={DEMO_PAGE_LINKS}
            linkPageTabLabel="Pages"
            linkPageOptions2={DEMO_EVENT_LINKS}
            linkPageTab2Label="Events"
            required
            disabled={disabled}
            showCategoryLabels={showCategoryLabels}
            emojiPicker={{ useTwemoji }}
            toolbarLoading={toolbarLoading}
          />
        </TabsContent>

        <TabsContent value="html">
          <ScrollArea className="demo-output-scroll">
            <pre className="demo-output">{html}</pre>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </section>
  )
}
