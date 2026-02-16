export type DocsNavItem = {
  title: string
  href: string
  description: string
}

export const DOCS_NAV_ITEMS: ReadonlyArray<DocsNavItem> = [
  {
    title: 'Overview',
    href: '/docs',
    description: 'Start here for architecture and navigation.'
  },
  {
    title: 'Quick Start',
    href: '/docs/quick-start',
    description: 'Install, render, and configure BerryEditor quickly.'
  },
  {
    title: 'API',
    href: '/docs/api',
    description: 'Comprehensive public component/type reference.'
  },
  {
    title: 'Hooks',
    href: '/docs/hooks',
    description: 'React hooks, callbacks, adapter lifecycles, and link insertion hooks.'
  },
  {
    title: 'Styling',
    href: '/docs/styling',
    description: 'Theme variables, class map, and override patterns.'
  },
  {
    title: 'Accessibility',
    href: '/docs/accessibility',
    description: 'Built-in semantics, keyboard flows, and QA checklist.'
  },
  {
    title: 'Troubleshooting',
    href: '/docs/troubleshooting',
    description: 'Diagnose common integration, rendering, and adapter issues.'
  },
  {
    title: 'Migrations',
    href: '/docs/migrations',
    description: 'Upgrade playbooks and compatibility guidance.'
  },
  {
    title: 'Releases',
    href: '/docs/releases',
    description: 'Versioning policy, release notes process, and verification checklist.'
  }
]
