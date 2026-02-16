import type { MetadataRoute } from 'next'
import { getDocsSiteUrl } from '../lib/site-url'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getDocsSiteUrl()

  return {
    rules: {
      userAgent: '*',
      allow: '/'
    },
    sitemap: `${siteUrl}/sitemap.xml`
  }
}
