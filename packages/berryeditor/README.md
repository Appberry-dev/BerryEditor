# @appberry/berryeditor

`@appberry/berryeditor` is a React-first rich text editor with an internal TypeScript engine, HTML-first persistence, and extension points for uploads, macros, emoji picker behavior, toolbar layout, and color picker integration.

## Installation

```bash
pnpm add @appberry/berryeditor
npm i @appberry/berryeditor
yarn add @appberry/berryeditor
```

## Quickstart

```tsx
import { BerryEditor } from '@appberry/berryeditor'
import '@appberry/berryeditor/styles.css'

export function Editor() {
  return <BerryEditor defaultValue="<p>Hello world</p>" />
}
```

## Next.js Usage

```tsx
'use client'

import { BerryEditor } from '@appberry/berryeditor/next'
import '@appberry/berryeditor/styles.css'

export function EditorClient() {
  return <BerryEditor defaultValue="<p>Rendered in a client component</p>" />
}
```

## Next.js Integration Notes

- `@appberry/berryeditor/next` is a dedicated client entrypoint with `'use client'` already declared.
- In the App Router model, props sent from Server Components to Client Components must be serializable. Prefer passing plain data (for example HTML strings and JSON-like config objects).
- If you want browser-only loading, use `next/dynamic` with `ssr: false`.
- For monorepos/local package development, Next.js can transpile external workspace packages via `transpilePackages`.

```tsx
import dynamic from 'next/dynamic'

const EditorClient = dynamic(() => import('./EditorClient'), {
  ssr: false
})

export default function Page() {
  return <EditorClient />
}
```

## Feature Overview

- Rich text controls: headings, lists, alignment, links, font family, font size, line spacing, colors, and clear formatting.
- Insert tools: image, document, table, horizontal rule, emoji, and macro insertion.
- Context editing tools: table row/column quick actions plus image inline/wrap toggle and drag-resize handles.
- Mode toggle: switch between rich text and editable HTML source.
- Built-in sanitization for editor updates and HTML mode transitions.
- Adapter hooks for image/document uploads and macro resolution.
- Toolbar customization via category visibility/order/row and optional category labels.
- Per-item toolbar customization via `showOnly` / `hideOnly` filters.
- Color picker extension via React render hook or imperative adapter mount.

## Advanced Integration Example

```tsx
import { useMemo } from 'react'
import {
  BerryEditor,
  type BerryToolbarItemsConfig,
  type BerryToolbarLayout,
  type DocumentAdapter,
  type ImageAdapter,
  type MacroAdapter
} from '@appberry/berryeditor'
import '@appberry/berryeditor/styles.css'

const toolbarLayout: BerryToolbarLayout = {
  insert: { row: 1, order: 3 },
  mode: { row: 1, order: 4 },
  history: { row: 2, order: 1 },
  text: { row: 2, order: 2 },
  formatting: { row: 2, order: 3 },
  styles: { row: 2, order: 4 },
  paragraph: { row: 2, order: 5 }
}

const toolbarItems: BerryToolbarItemsConfig = {
  hideOnly: ['macro']
}

export function EditorWithIntegrations() {
  const imageAdapter = useMemo<ImageAdapter>(
    () => ({
      accept: 'image/*',
      upload: async (file, { setProgress }) => {
        setProgress(100)
        const url = URL.createObjectURL(file)
        return {
          id: crypto.randomUUID(),
          url,
          filename: file.name,
          filesize: file.size,
          contentType: file.type || 'application/octet-stream',
          previewUrl: url
        }
      }
    }),
    []
  )

  const documentAdapter = useMemo<DocumentAdapter>(
    () => ({
      accept: '.pdf,.doc,.docx,.txt',
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
    }),
    []
  )

  const macroAdapter = useMemo<MacroAdapter>(
    () => ({
      search: async (query) =>
        [
          { id: 'signature', label: 'Signature', description: 'Insert sign-off block' },
          { id: 'disclaimer', label: 'Disclaimer', description: 'Insert legal disclaimer' }
        ].filter((option) => option.label.toLowerCase().includes(query.toLowerCase())),
      resolve: async (macroId) => {
        if (macroId === 'signature') {
          return { html: '<p><strong>Best regards,</strong><br/>Berry Team</p>' }
        }
        return { html: '<p><em>This message may contain confidential information.</em></p>' }
      }
    }),
    []
  )

  return (
    <BerryEditor
      defaultValue="<h2>Welcome</h2><p>Try uploads, macros, and HTML mode.</p>"
      imageAdapter={imageAdapter}
      documentAdapter={documentAdapter}
      macroAdapter={macroAdapter}
      toolbarLayout={toolbarLayout}
      toolbarItems={toolbarItems}
      showCategoryLabels={false}
      onHTMLSanitizeNotice={(event) => {
        if (event.changed) {
          console.warn(event.message)
        }
      }}
    />
  )
}
```

## API Reference

<!-- GENERATED:API_START -->
### Main Package Exports

- `BerryEditor`
- `BerryToolbar`
- `BerryToolbarProps`
- `BerryEditorHandle`
- `BerryEditorProps`
- `BerryToolbarCategoryKey`
- `BerryToolbarCategoryLayout`
- `BerryToolbarItemKey`
- `BerryToolbarItemsConfig`
- `BerryToolbarLayout`
- `ColorPickerAdapter`
- `ColorPickerAdapterContext`
- `ColorPickerAdapterHandle`
- `ColorPickerKind`
- `ColorPickerOptions`
- `ColorPickerRenderProps`
- `DocumentAdapter`
- `EmojiGender`
- `EmojiInsertMode`
- `EmojiInsertPayload`
- `EmojiPickerOptions`
- `EmojiTone`
- `FontFamilyOption`
- `HTMLSanitizeNoticeEvent`
- `ImageAdapter`
- `LinkPageOption`
- `MacroAdapter`
- `MacroOption`
- `SelectionRange`
- `UploadContext`
- `UploadResult`
- `DEFAULT_FONT_FAMILY_OPTIONS`
- `useBerryFontFamilies`
- `DEFAULT_TWEMOJI_BASE_URL`
- `TWEMOJI_VERSION`
- `UNICODE_EMOJI_VERSION`
- `UNICODE_FULLY_QUALIFIED_COUNT`
- `EditorEngine`
- `EditorCommand`
- `parseHTML`
- `serializeHTML`
- `sanitizeHTML`
- `createEmptyDocument`
- `documentFromHTML`
- `documentToHTML`
- `AttachmentNode`
- `BlockNode`
- `EditorDocument`
- `InlineMark`
- `InlineNode`
- `ListType`

### Next Client Entry Exports

- `BerryEditor`
- `DEFAULT_FONT_FAMILY_OPTIONS`
- `useBerryFontFamilies`
- `BerryEditorHandle`
- `BerryEditorProps`
- `ColorPickerAdapter`
- `ColorPickerAdapterContext`
- `ColorPickerAdapterHandle`
- `ColorPickerKind`
- `ColorPickerOptions`
- `ColorPickerRenderProps`
- `DocumentAdapter`
- `EmojiGender`
- `EmojiInsertMode`
- `EmojiInsertPayload`
- `EmojiPickerOptions`
- `EmojiTone`
- `FontFamilyOption`
- `ImageAdapter`
- `MacroAdapter`
- `MacroOption`
- `SelectionRange`
- `UploadContext`
- `UploadResult`
- `DEFAULT_TWEMOJI_BASE_URL`
- `TWEMOJI_VERSION`
- `UNICODE_EMOJI_VERSION`
- `UNICODE_FULLY_QUALIFIED_COUNT`

### BerryEditor Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string` | - | Controlled HTML value. When provided, editor runs in controlled mode. |
| `defaultValue` | `string` | `''` | Initial HTML for uncontrolled mode. |
| `onChange` | `(html: string) => void` | - | Called when editor HTML changes. |
| `onHTMLSanitizeNotice` | `(event: HTMLSanitizeNoticeEvent) => void` | - | Called when unsafe HTML is removed while committing HTML mode changes. |
| `onSelectionChange` | `(range: SelectionRange \| null) => void` | - | Receives selection updates from the editor engine. |
| `onFocus` | `() => void` | - | Focus callback for host app integrations. |
| `onBlur` | `() => void` | - | Blur callback for host app integrations. |
| `disabled` | `boolean` | `false` | Disables editing and toolbar actions. |
| `readOnly` | `boolean` | `false` | Prevents editing while keeping content visible. |
| `required` | `boolean` | `false` | Enables form validity enforcement when used with `name`. |
| `name` | `string` | - | Form field name for hidden proxy textarea submission. |
| `placeholder` | `string` | `'Start writing...'` | Placeholder text for an empty editor. |
| `imageAdapter` | `ImageAdapter` | - | Custom image upload/remove integration. |
| `documentAdapter` | `DocumentAdapter` | - | Custom document upload/remove integration. |
| `macroAdapter` | `MacroAdapter` | - | Macro search + resolve integration. |
| `linkPageOptions` | `LinkPageOption[]` | - | Optional nested page tree for the first link tab. |
| `linkPageOptions2` | `LinkPageOption[]` | - | Optional nested page tree for the second link tab. |
| `linkPageTabLabel` | `string` | - | Optional label override for the first link tab. |
| `linkPageTab2Label` | `string` | - | Optional label override for the second link tab. |
| `onSearchLinkPages` | `(query: string) => Promise<LinkPageOption[]>` | - | Optional async search hook for the first link tab. |
| `onSearchLinkPages2` | `(query: string) => Promise<LinkPageOption[]>` | - | Optional async search hook for the second link tab. |
| `emojiPicker` | `EmojiPickerOptions` | - | Configuration for built-in Unicode 17 + Twemoji picker. |
| `fontFamilyOptions` | `FontFamilyOption[]` | - | Custom font family options merged with defaults. |
| `colorPicker` | `ColorPickerOptions` | - | Swatches and custom render/adapter for text/highlight color pickers. |
| `enableHTMLMode` | `boolean` | `true` | Shows or hides rich/HTML mode toggle. |
| `showCategoryLabels` | `boolean` | `true` | Shows/hides category labels under toolbar control groups. |
| `toolbarLayout` | `BerryToolbarLayout` | - | Per-category visibility/order/row overrides for toolbar layout. |
| `toolbarItems` | `BerryToolbarItemsConfig` | - | Per-item toolbar visibility using showOnly/hideOnly lists. All items render by default. |
| `toolbarLoading` | `boolean` | `false` | Replaces the toolbar UI with a non-interactive skeleton while loading. |

### BerryToolbar Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `disabled` | `boolean` | - | Disables all toolbar controls. |
| `readOnly` | `boolean` | - | Read-only presentation mode for toolbar actions. |
| `canUndo` | `boolean` | - | Whether undo control is enabled. |
| `canRedo` | `boolean` | - | Whether redo control is enabled. |
| `onCommand` | `(command: EditorCommand, payload?: CommandPayload) => void` | - | Command dispatch callback for toolbar controls. |
| `onPrepareInsert` | `() => void` | - | Optional hook fired before insert popovers/actions so hosts can preserve selection state. |
| `canInsertImage` | `boolean` | - | Whether image insert control should be enabled. |
| `canInsertDocument` | `boolean` | - | Whether document insert control should be enabled. |
| `onPickImage` | `() => void` | - | Trigger host image picker/upload flow. |
| `onPickDocument` | `() => void` | - | Trigger host document picker/upload flow. |
| `onInsertEmoji` | `(value: string \| EmojiInsertPayload) => void` | - | Insert selected emoji into editor content. |
| `emojiPicker` | `EmojiPickerOptions` | - | Built-in picker options. |
| `onSearchMacros` | `(query: string) => Promise<MacroOption[]>` | - | Optional macro search hook. |
| `onInsertMacro` | `(macroId: string) => Promise<void>` | - | Insert selected macro by ID. |
| `linkPageOptions` | `LinkPageOption[]` | - | Static first page-tab options. |
| `linkPageOptions2` | `LinkPageOption[]` | - | Static second page-tab options. |
| `linkPageTabLabel` | `string` | - | Label for first page-tab (default: 'Pages'). |
| `linkPageTab2Label` | `string` | - | Label for second page-tab (default: 'Pages 2'). |
| `onSearchLinkPages` | `(query: string) => Promise<LinkPageOption[]>` | - | Async search hook for first page-tab. |
| `onSearchLinkPages2` | `(query: string) => Promise<LinkPageOption[]>` | - | Async search hook for second page-tab. |
| `fontFamilyOptions` | `FontFamilyOption[]` | - | Font family list displayed by toolbar typography controls. |
| `colorPicker` | `ColorPickerOptions` | - | Color picker render/adapter configuration. |
| `showFormattingControls` | `boolean` | `true` | Show or hide rich-text formatting categories. |
| `showCategoryLabels` | `boolean` | `true` | Show or hide category labels under groups. |
| `showHTMLToggle` | `boolean` | `false` | Show or hide the mode-toggle category. |
| `isHTMLMode` | `boolean` | `false` | Current mode state for mode-toggle button label/state. |
| `onToggleHTMLMode` | `() => void` | - | Toggle callback for switching rich/HTML modes. |
| `toolbarLayout` | `BerryToolbarLayout` | - | Per-category visibility/order/row overrides. |
| `toolbarItems` | `BerryToolbarItemsConfig` | - | Per-item visibility controls using showOnly/hideOnly lists. |
| `loading` | `boolean` | `false` | Renders non-interactive toolbar skeleton placeholders while host data is loading. |

### BerryEditor Handle

| Method | Signature | Notes |
| --- | --- | --- |
| `focus()` | `() => void` | Focuses rich editor content area. |
| `blur()` | `() => void` | Blurs current editor focus target. |
| `getHTML()` | `() => string` | Returns current HTML. In HTML mode, commits sanitized draft first. |
| `setHTML(html)` | `(html: string) => void` | Replaces editor content with provided HTML. |
| `getSelection()` | `() => SelectionRange \| null` | Reads current selection offsets. |
| `setSelection(range)` | `(range: SelectionRange) => void` | Restores selection offsets. |
| `exec(command, payload?)` | `(command: string, payload?: unknown) => void` | Executes editor command with optional payload. |
| `undo()` | `() => void` | Undo last operation. |
| `redo()` | `() => void` | Redo last undone operation. |

### Editor Commands

| Command | Payload | Notes |
| --- | --- | --- |
| `bold` | `-` | Toggle bold inline mark. |
| `italic` | `-` | Toggle italic inline mark. |
| `underline` | `-` | Toggle underline inline mark. |
| `strike` | `-` | Toggle strikethrough inline mark. |
| `code` | `-` | Apply code block formatting. |
| `link` | `{ url, text?, openInNewTab? }` | Create/update link for selection, or insert provided text as a link. |
| `unlink` | `-` | Remove link from current selection. |
| `paragraph` | `-` | Switch block to paragraph. |
| `heading1` | `-` | Switch block to H1. |
| `heading2` | `-` | Switch block to H2. |
| `heading3` | `-` | Switch block to H3. |
| `quote` | `-` | Switch block to blockquote. |
| `bullet` | `-` | Toggle unordered list. |
| `number` | `-` | Toggle ordered list. |
| `alignLeft` | `-` | Align block left. |
| `alignCenter` | `-` | Align block center. |
| `alignRight` | `-` | Align block right. |
| `alignJustify` | `-` | Justify block alignment. |
| `fontFamily` | `{ fontFamily }` | Apply font family style. |
| `fontSize` | `{ fontSize }` | Apply font size style. |
| `textColor` | `{ color }` | Apply text color style. |
| `highlightColor` | `{ color }` | Apply highlight color style. |
| `clearHighlight` | `-` | Remove highlight from the nearest highlighted parent at cursor. |
| `lineSpacing` | `{ lineHeight }` | Apply line-height style. |
| `insertHorizontalRule` | `-` | Insert horizontal divider. |
| `insertTable` | `{ rows, cols, bordered? }` | Insert table with dimensions and optional black 1px cell borders. |
| `tableAddRowAbove` | `-` | Insert table row above selection. |
| `tableAddRowBelow` | `-` | Insert table row below selection. |
| `tableDeleteRow` | `-` | Delete current table row. |
| `tableAddColumnLeft` | `-` | Insert table column on left side. |
| `tableAddColumnRight` | `-` | Insert table column on right side. |
| `tableDeleteColumn` | `-` | Delete current table column. |
| `tableDelete` | `-` | Delete active table. |
| `insertText` | `{ text }` | Insert plain text at cursor. |
| `insertHTML` | `{ html }` | Insert HTML fragment at cursor. |
| `removeFormat` | `-` | Clear inline formatting from selection. |
| `undo` | `-` | Undo last operation. |
| `redo` | `-` | Redo last undone operation. |
<!-- GENERATED:API_END -->

## Documentation Site

- Overview: `/docs`
- Quick Start: `/docs/quick-start`
- API Reference: `/docs/api`
- Hooks: `/docs/hooks`
- Styling: `/docs/styling`
- Accessibility: `/docs/accessibility`
- Troubleshooting: `/docs/troubleshooting`
- Migrations: `/docs/migrations`
- Releases: `/docs/releases`

## Security and Sanitization

- HTML is sanitized before it is persisted to editor state.
- In HTML mode, switching back to rich text sanitizes the draft before applying changes.
- Calling `ref.getHTML()` while in HTML mode sanitizes and commits the HTML draft first.
- Pasted HTML content is sanitized before insertion.
- DOMPurify maintainers note that modifying sanitized markup afterward can re-introduce unsafe content. Treat sanitized HTML as the final form for rendering/storage.
- OWASP guidance still applies: sanitize plus context-appropriate output handling and CSP, rather than relying on a single control.

## Notes and Caveats

- `emojiPicker.useTwemoji` defaults to `true`; set it to `false` to render native Unicode glyphs in picker tiles.
- When `emojiPicker.insertMode` is `twemojiImage` (default), pasted Unicode emojis are normalized to `berry-emoji` image tags.
- In `twemojiImage` mode, a blur pass also normalizes remaining Unicode emojis in the rich editor content.
- Set `emojiPicker.insertMode` to `unicode` to keep pasted emojis as Unicode text.
- Selected image attachments expose inline/wrap toggle controls and resize handles in rich mode.
- If you create blob URLs in adapters (for example via `URL.createObjectURL`), your app should revoke them (`URL.revokeObjectURL`) when no longer needed.

## Attribution

Twemoji graphics are provided by [jdecked/twemoji](https://github.com/jdecked/twemoji) under CC-BY 4.0.

## External References

- Next.js `'use client'` directive: https://nextjs.org/docs/app/api-reference/directives/use-client
- Next.js lazy loading (`next/dynamic`, including `ssr: false`): https://nextjs.org/docs/pages/building-your-application/optimizing/lazy-loading
- Next.js `transpilePackages`: https://nextjs.org/docs/pages/api-reference/config/next-config-js/transpilePackages
- DOMPurify project documentation: https://github.com/cure53/DOMPurify
- OWASP Cross Site Scripting Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

## License

Apache-2.0
