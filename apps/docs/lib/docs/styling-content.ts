export type StylingToken = {
  token: string
  description: string
}

export type ClassMapRow = {
  className: string
  purpose: string
}

export const STYLE_IMPORT_SNIPPET = `import '@appberry/berryeditor/styles.css'`

export const THEME_OVERRIDE_SNIPPET = `:root {
  --berry-bg: linear-gradient(160deg, #fffaf0 0%, #eef8ff 100%);
  --berry-panel: rgba(255, 255, 255, 0.94);
  --berry-border: rgba(27, 35, 56, 0.18);
  --berry-text: #162032;
  --berry-muted: #52617f;
  --berry-accent: #0059b3;
  --berry-accent-soft: rgba(0, 89, 179, 0.16);
  --berry-danger: #b42318;
}`

export const TARGETED_CLASS_OVERRIDE = `.berry-shell {
  border-radius: 20px;
}

.berry-toolbar__group {
  border-radius: 14px;
}

.berry-editor {
  min-height: 340px;
}`

export const STYLING_TOKENS: ReadonlyArray<StylingToken> = [
  { token: '--berry-font-sans', description: 'Primary UI font family used by shell and toolbar.' },
  { token: '--berry-font-mono', description: 'Monospace font for code and HTML mode textarea.' },
  { token: '--berry-bg', description: 'Shell surface background.' },
  { token: '--berry-panel', description: 'Panel surface for controls and buttons.' },
  { token: '--berry-border', description: 'Border color for editor chrome and controls.' },
  { token: '--berry-text', description: 'Primary text color.' },
  { token: '--berry-muted', description: 'Secondary text color.' },
  { token: '--berry-accent', description: 'Focus, active, and highlight accent color.' },
  { token: '--berry-accent-soft', description: 'Soft accent fill for hover/selection backgrounds.' },
  { token: '--berry-danger', description: 'Error or destructive state color.' },
  { token: '--berry-shadow', description: 'Default shell elevation.' }
]

export const STYLING_CLASS_MAP: ReadonlyArray<ClassMapRow> = [
  { className: '.berry-shell', purpose: 'Root wrapper around toolbar + editor frame.' },
  { className: '.berry-toolbar', purpose: 'Toolbar container with grouped controls.' },
  { className: '.berry-toolbar__row', purpose: 'Toolbar row layout wrapper.' },
  { className: '.berry-toolbar__group', purpose: 'Category grouping surface in toolbar.' },
  { className: '.berry-toolbar__button', purpose: 'Standard toolbar button styles.' },
  { className: '.berry-toolbar__select', purpose: 'Toolbar select input for styles and font family.' },
  { className: '.berry-toolbar__numeric-input', purpose: 'Font size and line-height numeric controls.' },
  { className: '.berry-toolbar__flyout', purpose: 'Popover/flyout content styling shell.' },
  { className: '.berry-editor-frame', purpose: 'Frame region wrapping rich and HTML editor modes.' },
  { className: '.berry-editor', purpose: 'Main `contentEditable` rich text area.' },
  { className: '.berry-html-editor', purpose: 'Raw HTML textarea shown in HTML mode.' },
  { className: '.berry-table-bubble', purpose: 'Context toolbar for table row/column operations.' },
  { className: '.berry-image-bubble', purpose: 'Context toolbar for image wrap/inline controls.' },
  { className: '.berry-image-resize-box', purpose: 'Overlay box shown around selected images.' },
  { className: '.berry-image-resize-handle', purpose: 'Drag handles for resizing selected images.' },
  { className: '.berry-emoji-picker', purpose: 'Built-in emoji picker root.' },
  { className: '.berry-emoji-picker__grid', purpose: 'Emoji result grid layout.' }
]

export const STYLING_NOTES: ReadonlyArray<string> = [
  'Prefer CSS variables first for brand theming and runtime theme switching.',
  'Apply class overrides narrowly to avoid fighting internal responsive behavior.',
  'Keep focus states visible when overriding toolbar/editor styles.',
  'When changing font stacks, test both rich mode and HTML mode readability.'
]
