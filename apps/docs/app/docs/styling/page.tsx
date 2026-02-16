import { CodeBlock } from '../../../components/docs/CodeBlock'
import { DocsShell } from '../../../components/docs/DocsShell'
import {
  STYLING_CLASS_MAP,
  STYLING_NOTES,
  STYLING_TOKENS,
  STYLE_IMPORT_SNIPPET,
  TARGETED_CLASS_OVERRIDE,
  THEME_OVERRIDE_SNIPPET
} from '../../../lib/docs/styling-content'

const toc = [
  { id: 'setup', label: 'Style Setup' },
  { id: 'tokens', label: 'Theme Variables' },
  { id: 'class-map', label: 'Class Map' },
  { id: 'override-patterns', label: 'Override Patterns' }
] as const

export default function StylingPage() {
  return (
    <DocsShell
      title="Styling"
      lead="Use CSS variables for brand theming, then apply focused class overrides when structure-level customization is needed."
      toc={toc}
    >
      <section id="setup">
        <h2>Style Setup</h2>
        <p>Import BerryEditor styles once at app shell scope.</p>
        <CodeBlock code={STYLE_IMPORT_SNIPPET} />
      </section>

      <section id="tokens">
        <h2>Theme Variables</h2>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th scope="col">Token</th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              {STYLING_TOKENS.map((row) => (
                <tr key={row.token}>
                  <th scope="row">
                    <code>{row.token}</code>
                  </th>
                  <td>{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CodeBlock code={THEME_OVERRIDE_SNIPPET} caption="Example: root-level theme override" />
      </section>

      <section id="class-map">
        <h2>Class Map</h2>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {STYLING_CLASS_MAP.map((row) => (
                <tr key={row.className}>
                  <th scope="row">
                    <code>{row.className}</code>
                  </th>
                  <td>{row.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="override-patterns">
        <h2>Override Patterns</h2>
        <ul>
          {STYLING_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <CodeBlock code={TARGETED_CLASS_OVERRIDE} caption="Example: targeted class overrides" />
      </section>
    </DocsShell>
  )
}
