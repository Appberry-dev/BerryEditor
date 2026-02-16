import type { ReactNode } from 'react'

type CalloutTone = 'info' | 'warning' | 'success'

export function Callout({
  title,
  tone = 'info',
  children
}: {
  title: string
  tone?: CalloutTone
  children: ReactNode
}) {
  return (
    <section className={`docs-callout docs-callout--${tone}`}>
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  )
}
