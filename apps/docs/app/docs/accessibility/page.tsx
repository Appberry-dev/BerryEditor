import { CodeBlock } from '../../../components/docs/CodeBlock'
import { DocsShell } from '../../../components/docs/DocsShell'
import {
  ACCESSIBILITY_FOUNDATIONS,
  ACCESSIBILITY_SNIPPET
} from '../../../lib/docs/accessibility-content'

const toc = [
  { id: 'foundations', label: 'Built-In Accessibility' },
  { id: 'integration', label: 'Integrator Guidance' }
] as const

export default function AccessibilityPage() {
  return (
    <DocsShell
      title="Accessibility"
      lead="BerryEditor ships with labeled controls and semantic editor/tooling roles; production accessibility still depends on host-app integration details."
      toc={toc}
    >
      <section id="foundations">
        <h2>Built-In Accessibility</h2>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Built In</th>
                <th scope="col">Integrator Action</th>
              </tr>
            </thead>
            <tbody>
              {ACCESSIBILITY_FOUNDATIONS.map((row) => (
                <tr key={row.area}>
                  <th scope="row">{row.area}</th>
                  <td>{row.builtIn}</td>
                  <td>{row.integratorAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="integration">
        <h2>Integrator Guidance</h2>
        <ul>
          <li>Keep visible editor labels and instructions close to the interactive surface.</li>
          <li>
            Use app-level live regions for asynchronous actions such as uploads or sanitization
            notices.
          </li>
          <li>Validate keyboard flows after any toolbar or theme customization.</li>
          <li>Map validation errors to the visible editor context when forms fail submission.</li>
        </ul>
        <CodeBlock code={ACCESSIBILITY_SNIPPET} />
      </section>
    </DocsShell>
  )
}
