import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: [
            'tests/dev/config-hot-reload.test.ts',
            'tests/landing/background-config.test.ts',
            'tests/landing/elastic-menu-chain-config.test.ts',
            'tests/landing/line-field-config.test.ts',
            'tests/dev/playwright-server-ownership.test.ts',
            'tests/landing/session3-evidence-finalizer.test.ts',
          ],
        },
      },
      {
        test: {
          name: 'process-gates',
          globals: true,
          environment: 'node',
          include: [
            'tests/dev/config-hot-reload.test.ts',
            'tests/dev/playwright-server-ownership.test.ts',
            'tests/landing/background-config.test.ts',
            'tests/landing/elastic-menu-chain-config.test.ts',
            'tests/landing/line-field-config.test.ts',
            'tests/landing/session3-evidence-finalizer.test.ts',
          ],
          fileParallelism: false,
          maxWorkers: 1,
          testTimeout: 15000,
          hookTimeout: 15000,
        },
      },
    ],
  },
})
