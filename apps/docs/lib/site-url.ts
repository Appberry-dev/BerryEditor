const DEFAULT_SITE_URL = 'https://appberry-dev.github.io'

function normalizeOrigin(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_SITE_URL
  return trimmed.replace(/\/+$/, '')
}

function normalizeBasePath(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '/') return ''
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`
}

export function getDocsOrigin(): string {
  return normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL)
}

export function getDocsBasePath(): string {
  return normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH ?? '')
}

export function getDocsSiteUrl(): string {
  return `${getDocsOrigin()}${getDocsBasePath()}`
}
