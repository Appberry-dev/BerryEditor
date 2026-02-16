import { ApiTable } from '../../../components/docs/ApiTable'
import { CodeBlock } from '../../../components/docs/CodeBlock'
import { DocsShell } from '../../../components/docs/DocsShell'
import type { ApiRow } from '../../../lib/docs/api-reference'

const toc = [
  { id: 'exports', label: 'Hook Exports' },
  { id: 'events', label: 'Event Hooks' },
  { id: 'link-hooks', label: 'Link Insertion Hooks' },
  { id: 'adapters', label: 'Adapter Hooks' },
  { id: 'pickers', label: 'Color Picker Hooks' },
  { id: 'patterns', label: 'Usage Patterns' }
] as const

const reactHookRows: ReadonlyArray<ApiRow> = [
  {
    name: 'useBerryFontFamilies(extensions?)',
    type: '(extensions?: FontFamilyOption[]) => FontFamilyOption[]',
    description: 'Merges custom font options with `DEFAULT_FONT_FAMILY_OPTIONS` and de-duplicates by value.'
  },
  {
    name: 'DEFAULT_FONT_FAMILY_OPTIONS',
    type: 'ReadonlyArray<FontFamilyOption>',
    description: 'Built-in font options exposed by package and `/next` client entry.'
  }
]

const eventHookRows: ReadonlyArray<ApiRow> = [
  {
    name: 'onChange',
    type: '(html: string) => void',
    description: 'Called when editor HTML changes.'
  },
  {
    name: 'onHTMLSanitizeNotice',
    type: '(event: HTMLSanitizeNoticeEvent) => void',
    description: 'Runs when unsafe HTML is removed while committing HTML mode changes.'
  },
  {
    name: 'onSelectionChange',
    type: '(range: SelectionRange | null) => void',
    description: 'Receives serialized selection updates from the editor engine.'
  },
  {
    name: 'onFocus',
    type: '() => void',
    description: 'Called when the rich editor surface gains focus.'
  },
  {
    name: 'onBlur',
    type: '() => void',
    description: 'Called when the rich editor surface loses focus.'
  }
]

const linkHookRows: ReadonlyArray<ApiRow> = [
  {
    name: 'linkPageOptions',
    type: 'LinkPageOption[]',
    description: 'Static nested page tree for the first link tab.'
  },
  {
    name: 'linkPageTabLabel',
    type: 'string',
    description: "Label override for the first link tab (default: 'Pages')."
  },
  {
    name: 'onSearchLinkPages',
    type: '(query: string) => Promise<LinkPageOption[]>',
    description: 'Async search hook for the first link tab.'
  },
  {
    name: 'linkPageOptions2',
    type: 'LinkPageOption[]',
    description: 'Static nested page tree for the second link tab.'
  },
  {
    name: 'linkPageTab2Label',
    type: 'string',
    description: "Label override for the second link tab (default: 'Pages 2')."
  },
  {
    name: 'onSearchLinkPages2',
    type: '(query: string) => Promise<LinkPageOption[]>',
    description: 'Async search hook for the second link tab.'
  }
]

const adapterHookRows: ReadonlyArray<ApiRow> = [
  {
    name: 'imageAdapter.upload',
    type: '(file, ctx) => Promise<UploadResult>',
    description: 'Image upload hook used by picker, drag-drop, and paste flows.'
  },
  {
    name: 'imageAdapter.remove',
    type: '(attachmentId: string) => Promise<void>',
    description: 'Optional cleanup hook when an uploaded image is removed.'
  },
  {
    name: 'documentAdapter.upload',
    type: '(file, ctx) => Promise<UploadResult>',
    description: 'Document upload hook used by picker, drag-drop, and paste flows.'
  },
  {
    name: 'documentAdapter.remove',
    type: '(attachmentId: string) => Promise<void>',
    description: 'Optional cleanup hook when an uploaded document is removed.'
  },
  {
    name: 'macroAdapter.search',
    type: '(query: string) => Promise<MacroOption[]>',
    description: 'Search hook for macro autocomplete results.'
  },
  {
    name: 'macroAdapter.resolve',
    type: '(macroId: string) => Promise<{ html: string }>',
    description: 'Resolve hook that returns inserted HTML for a selected macro.'
  }
]

const pickerHookRows: ReadonlyArray<ApiRow> = [
  {
    name: 'colorPicker.render',
    type: '(props: ColorPickerRenderProps) => ReactElement | null',
    description: 'React render hook for fully custom text/highlight picker UI.'
  },
  {
    name: 'colorPicker.adapter.mount',
    type: '(context: ColorPickerAdapterContext) => void | ColorPickerAdapterHandle',
    description: 'Imperative mount hook for non-React color pickers.'
  },
  {
    name: 'ColorPickerAdapterHandle.update',
    type: '(next) => void',
    description: 'Optional lifecycle update hook after mount.'
  },
  {
    name: 'ColorPickerAdapterHandle.destroy',
    type: '() => void',
    description: 'Optional lifecycle cleanup hook before unmount.'
  }
]

const fontHookSnippet = `import { BerryEditor, useBerryFontFamilies } from '@appberry/berryeditor'

const brandFonts = [
  { label: 'Sora', value: '"Sora", "Avenir Next", "Segoe UI", sans-serif' },
  { label: 'IBM Plex Serif', value: '"IBM Plex Serif", Georgia, serif' }
]

export function BrandedEditor() {
  const fonts = useBerryFontFamilies(brandFonts)
  return <BerryEditor defaultValue="<p>Hello</p>" fontFamilyOptions={fonts} />
}`

const linkHookSnippet = `import { useRef } from 'react'
import type { BerryEditorHandle, LinkPageOption } from '@appberry/berryeditor'
import { BerryEditor } from '@appberry/berryeditor'

const pageLinks: LinkPageOption[] = [
  { id: 'docs-home', name: 'Docs Home', href: '/docs' },
  {
    id: 'docs-api',
    name: 'API',
    href: '/docs/api',
    children: [{ id: 'docs-hooks', name: 'Hooks', href: '/docs/hooks' }]
  }
]

async function onSearchLinkPages(query: string): Promise<LinkPageOption[]> {
  const response = await fetch('/api/internal-pages?q=' + encodeURIComponent(query))
  const payload = (await response.json()) as { items: LinkPageOption[] }
  return payload.items
}

export function EditorWithLinkHooks() {
  const editorRef = useRef<BerryEditorHandle>(null)

  return (
    <>
      <BerryEditor
        ref={editorRef}
        defaultValue="<p>Select text, then add a link.</p>"
        linkPageOptions={pageLinks}
        linkPageTabLabel="Pages"
        onSearchLinkPages={onSearchLinkPages}
      />
      <button
        type="button"
        onClick={() =>
          editorRef.current?.exec('link', {
            url: 'https://appberry.dev',
            text: 'Appberry',
            openInNewTab: true
          })
        }
      >
        Insert link
      </button>
    </>
  )
}`

const nextSnippet = `'use client'

import { useBerryFontFamilies } from '@appberry/berryeditor/next'`

export default function HooksPage() {
  return (
    <DocsShell
      title="Hooks"
      lead="BerryEditor exposes React hooks plus callback and adapter hook points for events, link insertion, uploads, macros, and custom picker lifecycles."
      toc={toc}
    >
      <section id="exports">
        <h2>Hook Exports</h2>
        <ApiTable rows={reactHookRows} showDefault={false} />
      </section>

      <section id="events">
        <h2>Event Hooks</h2>
        <ApiTable rows={eventHookRows} showDefault={false} />
      </section>

      <section id="link-hooks">
        <h2>Link Insertion Hooks</h2>
        <p>
          Use page-tab hooks to drive toolbar link insertion with CMS/internal routes. The{' '}
          <code>URL</code> tab is always available, and you can also insert links imperatively with{' '}
          <code>ref.exec('link')</code>.
        </p>
        <ApiTable rows={linkHookRows} showDefault={false} />
        <CodeBlock code={linkHookSnippet} />
      </section>

      <section id="adapters">
        <h2>Adapter Hooks</h2>
        <ApiTable rows={adapterHookRows} showDefault={false} />
      </section>

      <section id="pickers">
        <h2>Color Picker Hooks</h2>
        <ApiTable rows={pickerHookRows} showDefault={false} />
      </section>

      <section id="patterns">
        <h2>Usage Patterns</h2>
        <p>
          <code>useBerryFontFamilies</code> merges custom font options while preserving defaults.
          Pass hook callbacks with stable references where possible if they trigger network requests
          or mount imperative integrations.
        </p>
        <CodeBlock code={fontHookSnippet} />
        <ul>
          <li>Memoization is built into the hook through `useMemo`.</li>
          <li>Empty labels are ignored during normalization.</li>
          <li>
            You can import the same utility from <code>@appberry/berryeditor/next</code> in client
            components.
          </li>
          <li>
            Use <code>ref.exec('link', {'{'} url, text, openInNewTab {'}'})</code> when you need
            app-driven link insertion without opening the toolbar popover.
          </li>
        </ul>
        <CodeBlock code={nextSnippet} />
      </section>
    </DocsShell>
  )
}
