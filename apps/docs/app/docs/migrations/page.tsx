import { CodeBlock } from '../../../components/docs/CodeBlock'
import { DocsShell } from '../../../components/docs/DocsShell'

const toc = [
  { id: 'strategy', label: 'Upgrade Strategy' },
  { id: 'checklist', label: 'Migration Checklist' },
  { id: 'validation', label: 'Post-Migration Validation' }
] as const

const migrationFlow = `pnpm install
pnpm docs:generate
pnpm docs:check
pnpm typecheck
pnpm test`

export default function MigrationsPage() {
  return (
    <DocsShell
      title="Migrations"
      lead="Version upgrade guidance for BerryEditor package consumers and maintainers."
      toc={toc}
    >
      <section id="strategy">
        <h2>Upgrade Strategy</h2>
        <p>
          Treat every version bump as an API compatibility review. Verify exported names, prop
          signatures, command unions, and generated docs artifacts in the same change.
        </p>
        <ul>
          <li>Patch: bug fixes and internal changes with no public API changes.</li>
          <li>Minor: backward-compatible feature additions and new optional props/commands.</li>
          <li>Major: behavior changes or API removals requiring migration notes.</li>
        </ul>
      </section>

      <section id="checklist">
        <h2>Migration Checklist</h2>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">What To Check</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Imports</th>
                <td>
                  Verify package entry usage remains valid: <code>@appberry/berryeditor</code>,
                  <code>@appberry/berryeditor/next</code>, and <code>styles.css</code>.
                </td>
              </tr>
              <tr>
                <th scope="row">Props</th>
                <td>
                  Compare all `BerryEditorProps` and `BerryToolbarProps` entries against release
                  notes and generated API docs.
                </td>
              </tr>
              <tr>
                <th scope="row">Commands</th>
                <td>
                  Revalidate any direct `ref.exec` command usage and payload shape assumptions.
                </td>
              </tr>
              <tr>
                <th scope="row">Adapters</th>
                <td>
                  Confirm upload/macro adapters still satisfy required return contracts and
                  cancellation behavior.
                </td>
              </tr>
              <tr>
                <th scope="row">Styling</th>
                <td>
                  Re-run visual QA for toolbar layout, color pickers, image/table controls, and
                  HTML-mode toggle behavior.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <CodeBlock code={migrationFlow} />
      </section>

      <section id="validation">
        <h2>Post-Migration Validation</h2>
        <p>
          After upgrade, run unit tests, E2E coverage, and a manual authoring pass focused on rich
          text editing, uploads, command shortcuts, and HTML mode transitions.
        </p>
        <ul>
          <li>Confirm generated docs and README markers remain in sync.</li>
          <li>Confirm sanitizer callbacks still match expected telemetry.</li>
          <li>Confirm form submission with `name` and `required` still behaves as expected.</li>
        </ul>
      </section>
    </DocsShell>
  )
}
