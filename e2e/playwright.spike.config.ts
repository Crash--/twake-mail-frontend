import { defineConfig } from '@playwright/test'

import base from './playwright.config'

/**
 * Specs of the composer spike (spike/), against the e2e stack started with the spike overlay
 * (scripts/spike.sh: DEBUG on, tmail-web on 18503). Not part of the e2e suite: run them with
 * `./scripts/spike.sh test`.
 *
 * `export default` is what Playwright loads.
 */
export default defineConfig({
  ...base,
  testDir: './spike',
  outputDir: './test-results/spike-artifacts',
  reporter: [['list']],
  timeout: 120_000
})
