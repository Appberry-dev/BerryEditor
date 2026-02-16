import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:3005'
  },
  webServer: {
    command: 'pnpm --dir ../.. --filter docs dev:e2e',
    url: 'http://127.0.0.1:3005',
    reuseExistingServer: true,
    timeout: 120_000
  }
})
