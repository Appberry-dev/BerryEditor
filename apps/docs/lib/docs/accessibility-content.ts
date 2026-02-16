export type AccessibilityRow = {
  area: string
  builtIn: string
  integratorAction: string
}

export const ACCESSIBILITY_FOUNDATIONS: ReadonlyArray<AccessibilityRow> = [
  {
    area: 'Editor surface',
    builtIn: 'Rich mode root uses `role="textbox"` with `aria-multiline` and a label.',
    integratorAction: 'Provide page-level context and visible labeling around the editor region.'
  },
  {
    area: 'Toolbar semantics',
    builtIn: 'Toolbar root and context table tools expose `role="toolbar"` with labels.',
    integratorAction: 'Keep toolbar visible and avoid CSS overrides that hide focus outlines.'
  },
  {
    area: 'Mode switching',
    builtIn: 'HTML mode toggle announces pressed state and updates labels for destination mode.',
    integratorAction: 'Document raw HTML mode usage for authors and validate policy for unsafe HTML.'
  },
  {
    area: 'Table insertion/editing',
    builtIn:
      'Table matrix uses grid-like semantics and keyboard navigation hints; context bubble actions are labeled.',
    integratorAction: 'Include keyboard instructions in product help text for first-time users.'
  },
  {
    area: 'Form integration',
    builtIn:
      'Hidden form proxy supports native `required` validity and tracks semantic content (including media-only).',
    integratorAction: 'Show validation errors near the visible editor with clear instructional text.'
  },
  {
    area: 'Uploads',
    builtIn: 'Upload progress callbacks enable host announcements and UI feedback.',
    integratorAction:
      'Use aria-live regions in your app for upload progress and completion status updates.'
  },
  {
    area: 'Emoji controls',
    builtIn:
      'Built-in picker includes labeled search, category select, tone/gender groups, and button labels.',
    integratorAction: 'Verify language/localization of emoji labels if you customize picker UI.'
  }
]

export const ACCESSIBILITY_CHECKLIST: ReadonlyArray<string> = [
  'Navigate toolbar actions with keyboard only and confirm every control has visible focus.',
  'Switch to HTML mode and back using keyboard; verify sanitize notice flow in app-level messaging.',
  'Submit a required form with empty editor and confirm accessible error messaging is announced.',
  'Insert table via keyboard controls and execute table context bubble actions without mouse.',
  'Upload an image/document and confirm progress and completion are announced in a live region.',
  'Run a screen reader pass over toolbar groups and editor surface labels.',
  'Check color contrast after theme overrides, especially focus and selection states.'
]

export const ACCESSIBILITY_SNIPPET = `const [uploadMessage, setUploadMessage] = useState('')

<div aria-live="polite">{uploadMessage}</div>

<BerryEditor
  name="content"
  required
  onHTMLSanitizeNotice={(event) => {
    if (event.changed) {
      setUploadMessage(event.message)
    }
  }}
  imageAdapter={{
    upload: async (file, { setProgress }) => {
      setProgress(100)
      setUploadMessage(\`Uploaded \${file.name}\`)
      return {
        id: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        previewUrl: URL.createObjectURL(file),
        filename: file.name,
        filesize: file.size,
        contentType: file.type || 'application/octet-stream'
      }
    }
  }}
/>`
