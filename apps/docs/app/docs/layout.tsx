import type { ReactNode } from 'react'
import { DocsSidebar } from '../../components/docs/DocsSidebar'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="docs-layout">
      <DocsSidebar />
      <div className="docs-layout__content">{children}</div>
    </div>
  )
}
