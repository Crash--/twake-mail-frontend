import { defineConfig, devices } from '@playwright/test'

import { env } from './support/env'

const isCI = process.env.CI !== undefined && process.env.CI !== ''

type TraceMode = 'on' | 'off' | 'retain-on-failure' | 'on-first-retry'
const TRACE_MODES: readonly TraceMode[] = [
  'on',
  'off',
  'retain-on-failure',
  'on-first-retry'
]

function traceMode(raw: string | undefined): TraceMode {
  return TRACE_MODES.find(mode => mode === raw) ?? 'retain-on-failure'
}

/**
 * What the phone and tablet projects replay: the main path (log in, change
 * folder, read, keyboard only) and the responsive scenarios. The rest of the
 * suite tests behaviours that do not depend on the screen size.
 */
const RESPONSIVE_SPECS =
  /LOGIN-01|MBX-05|EML-01|EML-29|A11Y-01|RESP-|SRCH-01|SRCH-03|SRCH-13/

function workers(raw: string | undefined): number | undefined {
  const parsed = Number(raw)
  if (raw !== undefined && Number.isInteger(parsed) && parsed > 0) {
    return parsed
  }
  return isCI ? 2 : undefined
}

/**
 * Twake Mail e2e suite. Backend: e2e/scripts/start.sh. Conventions: e2e/README.md.
 * Backlog of scenarios to write: e2e/e2e.md.
 *
 * `export default` is what Playwright loads: the one exception to the named exports rule.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results/artifacts',
  globalSetup: './support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: workers(process.env.E2E_WORKERS),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report', open: 'never' }],
    ['junit', { outputFile: './test-results/junit.xml' }]
  ],
  use: {
    baseURL: env.baseUrl,
    testIdAttribute: 'data-testid',
    locale: 'en-US',
    timezoneId: 'Europe/Paris',
    trace: traceMode(process.env.E2E_TRACE),
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: process.env.E2E_HEADLESS !== 'false',
    launchOptions: { slowMo: Number(process.env.E2E_SLOWMO ?? 0) }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      // An iPhone 12 to 15 sized screen, in Chromium
      name: 'mobile',
      grep: RESPONSIVE_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true
      }
    },
    {
      // An iPad Air sized screen, in Chromium
      name: 'tablet',
      grep: RESPONSIVE_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
        isMobile: true
      }
    }
  ]
})
