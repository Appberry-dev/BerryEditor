export type DocsTocItem = {
  id: string
  label: string
}

export function DocsToc({ items }: { items: ReadonlyArray<DocsTocItem> }) {
  if (items.length === 0) return null

  return (
    <aside className="docs-toc" aria-label="Page table of contents">
      <h2>On This Page</h2>
      <nav>
        {items.map((item) => (
          <a key={item.id} href={`#${item.id}`} className="docs-toc__link">
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  )
}
