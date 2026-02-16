import type { ReactNode } from 'react'

type CodeBlockProps = {
  code: string
  language?: string
  caption?: ReactNode
}

export function CodeBlock({ code, language = 'tsx', caption }: CodeBlockProps) {
  return (
    <figure className="docs-code">
      {caption ? <figcaption>{caption}</figcaption> : null}
      <pre>
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </figure>
  )
}
