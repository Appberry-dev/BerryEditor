import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'next/client': 'src/next/client.ts'
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: false,
  clean: true,
  splitting: false,
  target: 'es2022',
  skipNodeModulesBundle: false,
  noExternal: [/^@appberry\/berrypickr(\/.*)?$/],
  external: ['react', 'react-dom']
})
