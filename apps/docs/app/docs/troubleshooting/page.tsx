import { CodeBlock } from '../../../components/docs/CodeBlock'
import { DocsShell } from '../../../components/docs/DocsShell'

const toc = [
  { id: 'quick-diagnosis', label: 'Quick Diagnosis' },
  { id: 'common-failures', label: 'Common Failures' },
  { id: 'integration-checks', label: 'Integration Checks' }
] as const

const staleDocsCommand = `pnpm docs:check`

export default function TroubleshootingPage() {
  return (
    <DocsShell
      title="Troubleshooting"
      lead="Operational guide for diagnosing setup, runtime, and integration issues in BerryEditor."
      toc={toc}
    >
      <section id="quick-diagnosis">
        <h2>Quick Diagnosis</h2>
        <p>
          Start with reproducible checks before changing code. Most reported issues are stale
          generated docs, missing style import, disabled toolbar controls, or failing adapter
          promises.
        </p>
        <ol>
          <li>Run workspace checks: lint, typecheck, and tests.</li>
          <li>Run docs drift checks to confirm generated references are current.</li>
          <li>Validate that `@appberry/berryeditor/styles.css` is imported once at app level.</li>
          <li>Confirm adapters return the required upload metadata fields.</li>
        </ol>
        <CodeBlock code={staleDocsCommand} />
      </section>

      <section id="common-failures">
        <h2>Common Failures</h2>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th scope="col">Symptom</th>
                <th scope="col">Likely Cause</th>
                <th scope="col">Resolution</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Toolbar appears unstyled</th>
                <td>Missing styles entry import</td>
                <td>Import <code>@appberry/berryeditor/styles.css</code> in your root client bundle.</td>
              </tr>
              <tr>
                <th scope="row">Upload insert controls are disabled</th>
                <td>Adapter not configured or editor set to read-only/disabled</td>
                <td>Provide adapters and verify <code>disabled</code>/<code>readOnly</code> flags.</td>
              </tr>
              <tr>
                <th scope="row">Generated docs check fails</th>
                <td>Source API changed without regenerating docs artifacts</td>
                <td>Run <code>pnpm docs:generate</code> and commit updated generated files.</td>
              </tr>
              <tr>
                <th scope="row">HTML-mode sanitize warnings appear</th>
                <td>Unsafe HTML attributes/tags are being stripped</td>
                <td>Inspect authoring source and use <code>onHTMLSanitizeNotice</code> for diagnostics.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="integration-checks">
        <h2>Integration Checks</h2>
        <p>
          For adapter-backed deployments, add runtime logging around `upload`, `remove`, and macro
          resolution calls. Validate rejection paths explicitly and return actionable user-facing
          errors.
        </p>
        <ul>
          <li>Ensure `UploadResult` includes stable `id`, `url`, and MIME metadata.</li>
          <li>Abort in-flight uploads using `UploadContext.signal` on unmount/navigation.</li>
          <li>Revoke temporary object URLs after preview usage to avoid memory leaks.</li>
        </ul>
      </section>
    </DocsShell>
  )
}
