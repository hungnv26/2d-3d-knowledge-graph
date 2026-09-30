import { defineConfig, devices } from '@playwright/test'

// Browser tests run against the demo site (npm run demo:build first, or let the web server do it).
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:8792', viewport: { width: 1440, height: 900 } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: { command: 'npm run demo:build && node demo/serve.mjs', url: 'http://127.0.0.1:8792', reuseExistingServer: !process.env.CI, timeout: 120_000 },
})
