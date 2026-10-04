/**
 * Every knob of the suite, read once from the environment. Defaults match
 * e2e/scripts/start.sh, so a local run needs no variable at all.
 */
export interface E2EEnv {
  /** Browser facing origin: the app and, through the nginx proxy, /jmap and /dex */
  baseUrl: string
  /** JMAP endpoint used by the provisioning client (tmail-backend, direct) */
  jmapUrl: string
  /** tmail-backend WebAdmin */
  webadminUrl: string
  /** Mail domain every test user is created in */
  domain: string
  /** True when the stack runs the `oidc` profile (Dex) */
  oidc: boolean
  /** Dex issuer, as seen from the test runner */
  oidcIssuer: string
}

function readUrl(name: string, fallback: string): string {
  const raw = process.env[name]
  return (raw === undefined || raw === '' ? fallback : raw).replace(/\/+$/, '')
}

const baseUrl = readUrl('E2E_BASE_URL', 'http://127.0.0.1:18302')

export const env: E2EEnv = {
  baseUrl,
  jmapUrl: readUrl('E2E_JMAP_URL', 'http://127.0.0.1:18300'),
  webadminUrl: readUrl('E2E_WEBADMIN_URL', 'http://127.0.0.1:18301'),
  domain: process.env.E2E_DOMAIN ?? 'example.com',
  oidc: process.env.E2E_OIDC === '1',
  oidcIssuer: readUrl('E2E_OIDC_ISSUER', `${baseUrl}/dex`)
}
