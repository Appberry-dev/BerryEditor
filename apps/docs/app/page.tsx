import Link from 'next/link'
import { EditorDemo } from '../components/EditorDemo'

export default function HomePage() {
  return (
    <main className="home">
      <section className="home-hero">
        <p className="home-hero__eyebrow">BerryEditor</p>
        <h1>Compose rich content with a React-first editor built for production workflows.</h1>
        <div className="home-hero__actions">
          <Link href="/docs/quick-start">Get Started</Link>
          <Link href="/docs/api">API Reference</Link>
        </div>
        <div className="home-playground">
          <EditorDemo />
        </div>
      </section>

      <section className="home-section">
        <h2>Built for React and Next App Router</h2>
        <p>
          Use <code>@appberry/berryeditor</code> for standard React integration or{' '}
          <code>@appberry/berryeditor/next</code> for client components in App Router projects.
        </p>
        <pre className="home-inline-code">
          <code>pnpm add @appberry/berryeditor</code>
        </pre>
      </section>

      <section className="home-section">
        <h2>Why teams use BerryEditor</h2>
        <div className="home-feature-grid">
          <article>
            <h3>Canonical HTML Storage</h3>
            <p>
              Persist exactly what users authored, with safe HTML sanitization when raw mode is in
              play.
            </p>
          </article>
          <article>
            <h3>Typed Adapter Boundaries</h3>
            <p>
              Integrate files, macros, emoji search, and color pickers through strongly typed
              interfaces.
            </p>
          </article>
          <article>
            <h3>Toolbar You Can Reconfigure</h3>
            <p>Control category layout and choose individual controls with show/hide lists.</p>
          </article>
        </div>
      </section>

      <section className="home-section">
        <h2>Developer Documentation</h2>
        <div className="home-doc-grid">
          <Link href="/docs/quick-start">Quick Start</Link>
          <Link href="/docs/api">API</Link>
          <Link href="/docs/hooks">Hooks</Link>
          <Link href="/docs/styling">Styling</Link>
          <Link href="/docs/accessibility">Accessibility</Link>
        </div>
      </section>

      <footer className="home-footer" aria-label="Project footer">
        <p>
          BerryEditor by{' '}
          <a href="https://appberry.dev" target="_blank" rel="noreferrer">
            Appberry
          </a>
          .
        </p>
        <div className="home-footer__links">
          <a href="https://github.com/Appberry-dev/BerryEditor" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a
            href="https://github.com/Appberry-dev/BerryEditor/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            License
          </a>
        </div>
      </footer>
    </main>
  )
}
