/**
 * The specs that need another stack than the default one of `start.sh`, by suite. `E2E_SUITE`
 * selects which run (each CI job of .github/workflows/e2e.yml starts its stack and sets it):
 *
 *   (unset) / main  everything else: basic auth, start.sh
 *   oidc            E2E_OIDC=1 E2E_APP_ENV=docker/app-env-oidc.js ./scripts/start.sh
 *   chart           E2E_CHART_IMAGE=<image> ./scripts/start-chart.sh
 *   chart-sso       E2E_OIDC=1 E2E_CHART_IMAGE=<image> ./scripts/start-chart.sh
 *
 * So no run lists a spec its stack cannot pass: none is skipped.
 */
const SUITE_SPECS = {
  oidc: ['**/drive.spec.ts', '**/infra-oidc.spec.ts'],
  chart: ['**/chart-image.spec.ts'],
  'chart-sso': ['**/chart-image-sso.spec.ts']
} as const satisfies Record<string, readonly string[]>

type Suite = keyof typeof SUITE_SPECS

function isSuite(raw: string): raw is Suite {
  return Object.keys(SUITE_SPECS).includes(raw)
}

/** `testMatch` / `testIgnore` of the config for the suite `raw` (E2E_SUITE) */
export function suiteSelection(raw: string | undefined): {
  testMatch?: string[]
  testIgnore?: string[]
} {
  if (raw === undefined || raw === '' || raw === 'main') {
    return { testIgnore: Object.values(SUITE_SPECS).flat() }
  }
  if (!isSuite(raw)) {
    throw new Error(
      `E2E_SUITE=${raw}: expected main, ${Object.keys(SUITE_SPECS).join(', ')}`
    )
  }
  return { testMatch: [...SUITE_SPECS[raw]] }
}
