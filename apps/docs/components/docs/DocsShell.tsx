import type { ReactNode } from 'react'
import { DocsToc, type DocsTocItem } from './DocsToc'

type DocsShellProps = {
  title: string
  lead: string
  toc: ReadonlyArray<DocsTocItem>
  children: ReactNode
}

export function DocsShell({ title, lead, toc, children }: DocsShellProps) {
  return (
    <main className="docs-main">
      <header className="docs-main__header">
        <p className="docs-main__eyebrow">BerryEditor Docs</p>
        <h1>{title}</h1>
        <p>{lead}</p>
      </header>
      <div className="docs-main__body">
        <article className="docs-article">{children}</article>
        <DocsToc items={toc} />
      </div>
    </main>
  )
}
