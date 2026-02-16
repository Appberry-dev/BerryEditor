import Link from 'next/link'
import { DocsShell } from '../../components/docs/DocsShell'

const toc = [
  { id: 'doc-map', label: 'Documentation Map' },
  { id: 'architecture', label: 'Runtime Architecture' },
  { id: 'integration-paths', label: 'Integration Paths' },
  { id: 'operations', label: 'Operations Docs' },
  { id: 'project', label: 'Project and License' }
] as const

export default function DocsOverviewPage() {
  return (
    <DocsShell
      title="Documentation Overview"
      lead="BerryEditor provides a React-first editing surface with HTML as canonical persistence. Use this section to move from installation to advanced integration and customization."
      toc={toc}
    >
      <section id="doc-map">
        <h2>Documentation Map</h2>
        <p>
          Start with <strong>Quick Start</strong>, then use the API reference for typed integration
          and lifecycle details. Styling and accessibility sections cover production hardening.
        </p>
        <div className="docs-card-grid">
          <Link href="/docs/quick-start" className="docs-card">
            <h3>Quick Start</h3>
            <p>Install, render, and ship a working editor in minutes.</p>
          </Link>
          <Link href="/docs/api" className="docs-card">
            <h3>API Reference</h3>
            <p>Public props, handle methods, adapters, commands, and exports.</p>
          </Link>
          <Link href="/docs/hooks" className="docs-card">
            <h3>Hooks</h3>
            <p>React hooks, callbacks, adapter lifecycles, and link insertion patterns.</p>
          </Link>
          <Link href="/docs/styling" className="docs-card">
            <h3>Styling</h3>
            <p>Theme variables, class map, and safe override strategies.</p>
          </Link>
          <Link href="/docs/accessibility" className="docs-card">
            <h3>Accessibility</h3>
            <p>Built-in semantics and practical QA checklist.</p>
          </Link>
          <Link href="/docs/troubleshooting" className="docs-card">
            <h3>Troubleshooting</h3>
            <p>Resolve common setup, runtime, and adapter integration issues quickly.</p>
          </Link>
          <Link href="/docs/migrations" className="docs-card">
            <h3>Migrations</h3>
            <p>Version-to-version migration checklists and compatibility expectations.</p>
          </Link>
          <Link href="/docs/releases" className="docs-card">
            <h3>Releases</h3>
            <p>Versioning policy, release process, and documentation update standards.</p>
          </Link>
          <Link href="/#playground" className="docs-card">
            <h3>Playground</h3>
            <p>Interactive demo with adapters, uploads, and toolbar features on the home page.</p>
          </Link>
        </div>
      </section>

      <section id="architecture">
        <h2>Runtime Architecture</h2>
        <p>
          BerryEditor wraps a custom TypeScript engine and exposes a React component API. HTML is
          both the persistence format and the form submission value, with sanitization applied when
          entering content through raw HTML pathways.
        </p>
        <ul>
          <li>Rich text and HTML mode in the same component instance.</li>
          <li>Typed adapter interfaces for files and macros.</li>
          <li>Extensible toolbar layout plus per-item visibility controls.</li>
        </ul>
      </section>

      <section id="integration-paths">
        <h2>Integration Paths</h2>
        <p>
          The primary path is React + Next App Router via the client entrypoint. Plain React
          integration and controlled-mode usage are fully supported.
        </p>
        <ul>
          <li>
            App Router: import from <code>@appberry/berryeditor/next</code> in client components.
          </li>
          <li>
            React apps: import from <code>@appberry/berryeditor</code>.
          </li>
          <li>
            Always include <code>@appberry/berryeditor/styles.css</code> once at app level.
          </li>
        </ul>
      </section>

      <section id="operations">
        <h2>Operations Docs</h2>
        <p>
          Operational readiness is documented alongside API reference material. Use troubleshooting
          for incident response, migrations when upgrading versions, and releases to keep rollout
          and documentation updates synchronized.
        </p>
        <ul>
          <li>
            <Link href="/docs/troubleshooting">Troubleshooting guide</Link> for runtime failures,
            sanitization warnings, and integration regressions.
          </li>
          <li>
            <Link href="/docs/migrations">Migration guide</Link> for dependency upgrades and
            compatibility checks.
          </li>
          <li>
            <Link href="/docs/releases">Release process</Link> for changelog quality and publish
            gates.
          </li>
        </ul>
      </section>

      <section id="project">
        <h2>Project and License</h2>
        <p>
          BerryEditor is created by{' '}
          <a href="https://appberry.dev" target="_blank" rel="noreferrer">
            Appberry
          </a>
          . Source code lives on{' '}
          <a href="https://github.com/Appberry-dev/BerryEditor" target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
        <p>
          BerryEditor is licensed under <strong>Apache-2.0</strong>, which allows commercial and
          private use with license notice preservation. See the repository{' '}
          <a
            href="https://github.com/Appberry-dev/BerryEditor/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            LICENSE
          </a>{' '}
          for the full terms.
        </p>
      </section>
    </DocsShell>
  )
}
