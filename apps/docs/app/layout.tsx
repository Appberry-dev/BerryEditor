import './globals.css'
import '@appberry/berryeditor/styles.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getDocsSiteUrl } from '../lib/site-url'

const docsSiteUrl = getDocsSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(docsSiteUrl),
  title: {
    default: 'BerryEditor',
    template: '%s | BerryEditor'
  },
  description: 'BerryEditor homepage and developer documentation'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
