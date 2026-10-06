import { defineConfig, devices } from '@playwright/test'

import { env } from './support/env'

const isLargePhase = process.env.PERF_PHASE === 'large'

/**
 * Performance measures of the app on a big mailbox: `npm run perf` (see perf/README section
 * of e2e/README.md). Not part of the default suite nor of CI: one worker, no retry, no trace
 * nor video (they would skew the timings), against a production build served by the stack.
 *
 * `export default` is what Playwright loads.
 */
export default defineConfig({
  testDir: './perf',
  // The large drafts of the composer run first, on a fresh stack (`npm run perf:large`): the
  // 5 000 emails of the seed make this backend stall the sends. Everything else needs the seed
  testMatch: isLargePhase ? '**/composer-large.perf.ts' : '**/*.perf.ts',
  testIgnore: isLargePhase ? undefined : '**/composer-large.perf.ts',
  outputDir: './test-results/perf',
  globalSetup: './perf/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30 * 60_000,
  expect: { timeout: 60_000 },
  reporter: [['list']],
  use: {
    baseURL: env.baseUrl,
    testIdAttribute: 'data-testid',
    locale: 'en-US',
    timezoneId: 'Europe/Paris',
    viewport: { width: 1440, height: 900 },
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    headless: true
  },
  // channel chromium: the new headless mode, a full browser whose frames are paced like a
  // visible window (the default headless shell stops producing frames while scrolling)
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        viewport: { width: 1440, height: 900 }
      }
    }
  ]
})
