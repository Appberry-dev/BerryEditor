import { DocsShell } from '../../../components/docs/DocsShell'

const toc = [
  { id: 'policy', label: 'Versioning Policy' },
  { id: 'release-checklist', label: 'Release Checklist' },
  { id: 'documentation-gates', label: 'Documentation Gates' }
] as const

export default function ReleasesPage() {
  return (
    <DocsShell
      title="Releases"
      lead="Release management standards for keeping package behavior and online documentation aligned."
      toc={toc}
    >
      <section id="policy">
        <h2>Versioning Policy</h2>
        <p>
          BerryEditor follows semantic versioning. Public API changes drive version level decisions,
          and release notes must summarize export/prop/command changes explicitly.
        </p>
        <ul>
          <li>Patch releases: no intentional public API changes.</li>
          <li>Minor releases: additive, backward-compatible API enhancements.</li>
          <li>Major releases: breaking API or behavioral changes with migration guidance.</li>
        </ul>
      </section>

      <section id="release-checklist">
        <h2>Release Checklist</h2>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Requirement</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">API Regeneration</th>
                <td>
                  Run <code>pnpm docs:generate</code> and confirm generated artifacts are committed.
                </td>
              </tr>
              <tr>
                <th scope="row">Drift Validation</th>
                <td>
                  Run <code>pnpm docs:check</code> in CI and local release validation.
                </td>
              </tr>
              <tr>
                <th scope="row">Quality Gates</th>
                <td>
                  Pass <code>pnpm typecheck</code>, <code>pnpm test</code>, and docs build checks.
                </td>
              </tr>
              <tr>
                <th scope="row">Changelog Quality</th>
                <td>
                  Record added, changed, fixed, and deprecated behavior with clear upgrade impact.
                </td>
              </tr>
              <tr>
                <th scope="row">Docs Publish</th>
                <td>
                  Verify docs deployment output includes updated API pages and operational guides.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="documentation-gates">
        <h2>Documentation Gates</h2>
        <p>
          A release is not complete until generated API reference, README generated sections, and
          online docs pages are synchronized in the same revision.
        </p>
        <ul>
          <li>All public exports are listed in docs import groups.</li>
          <li>All public props and command unions are reflected in generated tables.</li>
          <li>Troubleshooting and migration pages are updated when behavior changes.</li>
        </ul>
      </section>
    </DocsShell>
  )
}
