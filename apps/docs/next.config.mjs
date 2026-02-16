/** @type {import('next').NextConfig} */
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const normalizedBasePath =
  rawBasePath && rawBasePath !== '/'
    ? `/${rawBasePath.replace(/^\/+|\/+$/g, '')}`
    : ''

const nextConfig = {
  transpilePackages: ['@appberry/berryeditor'],
  allowedDevOrigins: ['127.0.0.1'],
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  ...(normalizedBasePath
    ? {
        basePath: normalizedBasePath,
        assetPrefix: normalizedBasePath
      }
    : {})
}

export default nextConfig
