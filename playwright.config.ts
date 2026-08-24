import { defineConfig } from '@playwright/test'

const previewHost = '127.0.0.1'
const previewPort = 4173
const previewUrl = `http://${previewHost}:${previewPort}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // The visual journeys share one preview process plus browser animation/WebGL timing.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'line',
  projects: [
    { name: 'desktop-chromium', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { viewport: { width: 390, height: 844 } } },
  ],
  use: {
    baseURL: previewUrl,
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run preview -- --host ${previewHost} --port ${previewPort} --strictPort`,
    url: previewUrl,
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
