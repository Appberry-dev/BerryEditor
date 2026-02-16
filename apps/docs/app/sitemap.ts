import type { MetadataRoute } from 'next'
import { getDocsSiteUrl } from '../lib/site-url'

export const dynamic = 'force-static'

const ROUTES = [
  '/',
  '/docs',
  '/docs/quick-start',
  '/docs/api',
  '/docs/hooks',
  '/docs/styling',
  '/docs/accessibility',
  '/docs/troubleshooting',
  '/docs/migrations',
  '/docs/releases',
  '/app-router',
  '/pages-router'
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getDocsSiteUrl()

  return ROUTES.map((route, index) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: index === 0 ? 1 : 0.8
  }))
}
