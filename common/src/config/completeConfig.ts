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

export type CompleteConfigResult =
  { ok: true; value: AppConfig } | { ok: false; error: 'sso-unreachable' }

/**
 * The SSO of the JMAP server, as tmail-flutter finds it: WebFinger on the
 * server, then the server itself as an issuer, then (unless the SSO is
 * required) the Basic form. The Basic form only when both steps got an
 * answer saying there is none: a server that did not answer may have one.
 */
async function discoverIssuer(
  config: AppConfig,
  dependencies: CompleteConfigDependencies
): Promise<CompleteConfigResult> {
  const { issuerDiscovery, oidc } = config
  if (issuerDiscovery === null || oidc === null) {
    return { ok: true, value: config }
  }
  const { serverUrl, fallbackToBasic } = issuerDiscovery
  const { fetchFn, storage } = dependencies

  const cached = readCachedIssuer(storage, serverUrl)
  let issuer = cached
  let unavailable = false
  if (issuer === null) {
    const webFinger = await findIssuerByWebFinger(serverUrl, fetchFn)
    if (webFinger.ok) {
      issuer = webFinger.value
    } else {
      unavailable = webFinger.error === 'unavailable'
      const openId = await isOpenIdIssuer(serverUrl, fetchFn)
      if (openId.ok) issuer = serverUrl
      else unavailable ||= openId.error === 'unavailable'
    }
  }

  if (issuer !== null) {
    if (issuer !== cached) writeCachedIssuer(storage, serverUrl, issuer)
    return {
      ok: true,
      value: {
        ...config,
        oidc: { ...oidc, issuerUrl: issuer },
        issuerDiscovery: null
      }
    }
  }
  if (unavailable) return { ok: false, error: 'sso-unreachable' }
  if (fallbackToBasic) {
    return {
      ok: true,
      value: { ...config, authMode: 'basic', oidc: null, issuerDiscovery: null }
    }
  }
  return { ok: true, value: { ...config, issuerDiscovery: null } }
}

/**
 * What the runtime configuration cannot tell by itself, found before the app
 * starts: the SSO of the server when `SSO_BASE_URL` is not given. Reports
 * `sso-unreachable` when the server did not answer, rather than guessing a
 * sign-in mode.
 */
export async function completeConfig(
  config: AppConfig,
  dependencies: CompleteConfigDependencies = makeDefaultDependencies()
): Promise<CompleteConfigResult> {
  return discoverIssuer(config, dependencies)
}
