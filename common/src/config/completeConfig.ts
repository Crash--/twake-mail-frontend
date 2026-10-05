import { loadAppDashboard } from './appDashboard'
import type { AppConfig } from './config'
import { findIssuerByWebFinger, isOpenIdIssuer } from './issuerDiscovery'

/**
 * sessionStorage key of the issuer found for a server. The SSO round trip
 * reloads the app: the callback page goes to the same issuer without
 * discovering it again. It holds a public address, never a credential.
 */
export const DISCOVERED_ISSUER_STORAGE_KEY = 'twake-mail.oidc.discovered-issuer'

export interface CompleteConfigDependencies {
  fetchFn: typeof fetch
  storage: Pick<Storage, 'getItem' | 'setItem'>
}

function makeDefaultDependencies(): CompleteConfigDependencies {
  return { fetchFn: fetch, storage: window.sessionStorage }
}

function readCachedIssuer(
  storage: CompleteConfigDependencies['storage'],
  serverUrl: string
): string | null {
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(DISCOVERED_ISSUER_STORAGE_KEY) ?? 'null'
    )
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'serverUrl' in parsed &&
      parsed.serverUrl === serverUrl &&
      'issuer' in parsed &&
      typeof parsed.issuer === 'string'
    ) {
      return parsed.issuer
    }
  } catch {
    // Unreadable: discovered again
  }
  return null
}

function writeCachedIssuer(
  storage: CompleteConfigDependencies['storage'],
  serverUrl: string,
  issuer: string
): void {
  try {
    storage.setItem(
      DISCOVERED_ISSUER_STORAGE_KEY,
      JSON.stringify({ serverUrl, issuer })
    )
  } catch {
    // No storage: the next page load discovers it again
  }
}

/**
 * The SSO of the JMAP server, as tmail-flutter finds it: WebFinger on the
 * server, then the server itself as an issuer, then (unless the SSO is
 * required) the Basic form.
 */
async function discoverIssuer(
  config: AppConfig,
  dependencies: CompleteConfigDependencies
): Promise<AppConfig> {
  const { issuerDiscovery, oidc } = config
  if (issuerDiscovery === null || oidc === null) return config
  const { serverUrl, fallbackToBasic } = issuerDiscovery
  const { fetchFn, storage } = dependencies

  const cached = readCachedIssuer(storage, serverUrl)
  const issuer =
    cached ??
    (await findIssuerByWebFinger(serverUrl, fetchFn)) ??
    ((await isOpenIdIssuer(serverUrl, fetchFn)) ? serverUrl : null)

  if (issuer !== null) {
    if (issuer !== cached) writeCachedIssuer(storage, serverUrl, issuer)
    return {
      ...config,
      oidc: { ...oidc, issuerUrl: issuer },
      issuerDiscovery: null
    }
  }
  if (fallbackToBasic) {
    return { ...config, authMode: 'basic', oidc: null, issuerDiscovery: null }
  }
  return { ...config, issuerDiscovery: null }
}

/**
 * What the runtime configuration cannot tell by itself, found before the app
 * starts: the SSO of the server when `SSO_BASE_URL` is not given, and the
 * apps of `app_dashboard.json` (mounted by the Helm chart of tmail-frontend).
 * Never fails: the app starts with what it has.
 */
export async function completeConfig(
  config: AppConfig,
  dependencies: CompleteConfigDependencies = makeDefaultDependencies()
): Promise<AppConfig> {
  const [withIssuer, appList] = await Promise.all([
    discoverIssuer(config, dependencies),
    config.appDashboardUrl === null
      ? Promise.resolve(config.appList)
      : loadAppDashboard(config.appDashboardUrl, dependencies.fetchFn)
  ])
  return { ...withIssuer, appList, appDashboardUrl: null }
}
