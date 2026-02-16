'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DOCS_NAV_ITEMS } from '../../lib/docs/nav'

function GitHubMarkIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className="docs-sidebar__external-icon"
    >
      <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.08.55-.17.55-.38v-1.34c-2.24.49-2.71-1.08-2.71-1.08-.36-.93-.9-1.17-.9-1.17-.73-.5.06-.49.06-.49.81.06 1.23.82 1.23.82.72 1.22 1.89.87 2.35.66.07-.52.28-.87.5-1.07-1.79-.2-3.68-.89-3.68-3.98 0-.88.32-1.6.82-2.17-.08-.2-.36-1 .08-2.09 0 0 .67-.22 2.2.82a7.63 7.63 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.09.16 1.89.08 2.09.51.57.82 1.29.82 2.17 0 3.1-1.89 3.78-3.69 3.98.29.25.55.73.55 1.47v2.19c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
    </svg>
  )
}

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/docs') return pathname === '/docs'
  return pathname.startsWith(href)
}

export function DocsSidebar() {
  const pathname = usePathname() ?? '/docs'

  return (
    <aside className="docs-sidebar" aria-label="Documentation navigation">
      <Link href="/" className="docs-sidebar__brand">
        BerryEditor
      </Link>
      <p className="docs-sidebar__subhead">Developer Documentation</p>
      <nav className="docs-sidebar__nav">
        {DOCS_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`docs-sidebar__link${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span>{item.title}</span>
              <small>{item.description}</small>
            </Link>
          )
        })}
      </nav>
      <div className="docs-sidebar__meta">
        <a
          href="https://github.com/Appberry-dev/BerryEditor"
          target="_blank"
          rel="noreferrer"
          className="docs-sidebar__external"
          aria-label="BerryEditor on GitHub"
        >
          <GitHubMarkIcon />
          <span>GitHub</span>
        </a>
        <p className="docs-sidebar__credit">
          Created by{' '}
          <a href="https://appberry.dev" target="_blank" rel="noreferrer">
            Appberry
          </a>
        </p>
      </div>
    </aside>
  )
}
