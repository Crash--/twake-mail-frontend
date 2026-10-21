import {
  clearTokenSet,
  completeLogin,
  configureAuth,
  getAccessToken,
  getIdToken,
  getPendingReturnTo,
  LoginRequiredError,
  logOut,
  setTokenSet,
  startLogin as startSsoLogin,
  type TokenSet
} from '@linagora/twake-oidc'
import * as client from 'openid-client'

import type { OidcConfig } from '@common/config/config'

import { makeAuthStore } from './authStore'
import { endLocalSession } from './localSession'
import { sanitizeReturnTo } from './returnTo'
import {
  ANONYMOUS,
  SIGNED_OUT,
  type AuthUser,
  type LoginCallbackResult,
  type OidcAuthService,
  type SessionEndReason,
  type StartLoginResult
} from './types'

/** Timeout of the discovery, then of every request to the SSO, in seconds */
const SSO_TIMEOUT_S = 10
/** Tolerated clock difference between the browser and the SSO, in seconds */
const CLOCK_SKEW_S = 300
/** Tokens are renewed this long before they expire */
const REFRESH_AHEAD_MS = 60_000
/** A token closer than this to its expiry is renewed before being sent */
const EXPIRY_LEEWAY_MS = 10_000

/**
 * What the refresh needs besides the access and ID tokens, which
 * `@linagora/twake-oidc` holds
 */
interface RefreshState {
  refreshToken: string | null
  /** Epoch milliseconds, null when the SSO does not tell */
  expiresAt: number | null
}

export interface OidcDependencies {
  now: () => number
}

export interface OidcOptions {
  /** The JMAP server: the only one `@linagora/twake-oidc` gives the token to */
  apiUrl: string
  /**
   * The app is shown in the frame of another app (TwakeSpace, ADR 010): the
   * SSO refuses to show its portal there, so every login is silent, and
   * leaves no entry in the history the frame shares with the page around
   * it. When the SSO needs the user, the callback says `login-required`
   * and the page around the frame signs the user in again.
   */
  framed?: boolean
  /**
   * Where the SSO comes back, instead of the redirect URI of the
   * configuration: the intents page has its own (`/intents/callback`), that
   * other apps may frame
   */
  redirectUri?: string
}

function makeDefaultDependencies(): OidcDependencies {
  return { now: () => Date.now() }
}

/**
 * Where the pending login comes back to, without consuming it: the app
 * reads it on its callback page to know which screen the login is for.
 */
export function peekPendingLoginReturnTo(): string | null {
  const returnTo = getPendingReturnTo()
  return returnTo === null ? null : sanitizeReturnTo(returnTo)
}

/** Claims of an ID token or of a userinfo response */
type UserClaims = Readonly<Record<string, unknown>>

function getStringClaim(
  claims: UserClaims | undefined,
  name: string
): string | null {
  const value = claims?.[name]
  return typeof value === 'string' && value !== '' ? value : null
}

function normalizeUser(claims: UserClaims | undefined): AuthUser {
  return {
    email: getStringClaim(claims, 'email'),
    name:
      getStringClaim(claims, 'name') ??
      getStringClaim(claims, 'preferred_username'),
    workplaceFqdn: getStringClaim(claims, 'workplaceFqdn')
  }
}

/** What `primary` knows, completed by `fallback` */
function mergeUsers(primary: AuthUser, fallback: AuthUser): AuthUser {
  return {
    email: primary.email ?? fallback.email,
    name: primary.name ?? fallback.name,
    workplaceFqdn: primary.workplaceFqdn ?? fallback.workplaceFqdn
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The SSO, for the refresh that `@linagora/twake-oidc` does not do */
async function discoverConfiguration(
  config: OidcConfig
): Promise<client.Configuration> {
  const issuer = new URL(config.issuerUrl)
  return client.discovery(
    issuer,
    config.clientId,
    { [client.clockSkew]: CLOCK_SKEW_S },
    client.None(),
    {
      timeout: SSO_TIMEOUT_S,
      execute:
        issuer.protocol === 'http:'
          ? // An http issuer is a deliberate choice of the deployment (local stack)
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            [client.allowInsecureRequests]
          : []
    }
  )
}

/**
 * OpenID Connect authentication: `@linagora/twake-oidc` signs the user in
 * (Authorization Code flow with PKCE), holds the tokens and signs out; this
 * service renews the tokens with the refresh token.
 *
 * The tokens are held in memory only: web storage is readable by any script
 * of the page, so a single XSS would hand them over. A reload goes through
 * the SSO again, which signs the user back in silently while their SSO
 * session lasts.
 */
export function createOidcAuthService(
  config: OidcConfig,
  { apiUrl, framed = false, redirectUri = config.redirectUri }: OidcOptions,
  dependencies: OidcDependencies = makeDefaultDependencies()
): OidcAuthService {
  configureAuth({
    ssoUrl: config.issuerUrl,
    clientId: config.clientId,
    scope: config.scope,
    redirectUri,
    postLogoutRedirectUri: config.postLogoutRedirectUri,
    apiUrl,
    framed
  })
  const store = makeAuthStore()
  let tokens: RefreshState | null = null
  let configurationPromise: Promise<client.Configuration> | null = null
  let pendingRefresh: Promise<boolean> | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let isRedirecting = false

  async function fetchConfiguration(): Promise<client.Configuration> {
    configurationPromise ??= discoverConfiguration(config)
    try {
      return await configurationPromise
    } catch (error) {
      configurationPromise = null
      throw error
    }
  }

  function cancelScheduledRefresh(): void {
    if (refreshTimer !== null) clearTimeout(refreshTimer)
    refreshTimer = null
  }

  function scheduleRefresh(): void {
    cancelScheduledRefresh()
    if (!tokens?.refreshToken || tokens.expiresAt === null) return

    const remaining = tokens.expiresAt - dependencies.now()
    const delay = Math.max(remaining - REFRESH_AHEAD_MS, remaining / 2, 0)
    refreshTimer = setTimeout(refreshInBackground, delay)
  }

  function refreshInBackground(): void {
    refresh().catch((error: unknown) => {
      console.warn('[auth] Background token refresh failed', error)
    })
  }

  /**
   * Saves the tokens and signs the user in. The user is read from the ID
   * token, completed by `knownUser` (userinfo, or the user signed in before
   * a refresh): a renewed ID token may carry fewer claims.
   */
  function saveTokens(tokenSet: TokenSet, knownUser: AuthUser): void {
    const expiresIn = tokenSet.expiresIn()
    // A refresh response may carry no ID token: keep the one of the session,
    // for the logout and the token exchanges of the other apps
    const idToken = tokenSet.id_token ?? getIdToken()
    setTokenSet({
      access_token: tokenSet.access_token,
      ...(idToken === undefined ? {} : { id_token: idToken })
    })
    tokens = {
      refreshToken: tokenSet.refresh_token ?? tokens?.refreshToken ?? null,
      expiresAt:
        expiresIn === undefined ? null : dependencies.now() + expiresIn * 1000
    }
    const user = mergeUsers(normalizeUser(tokenSet.claims()), knownUser)
    store.setState({ status: 'authenticated', user })
    scheduleRefresh()
  }

  function getSignedInUser(): AuthUser {
    const state = store.getState()
    return state.status === 'authenticated'
      ? state.user
      : { email: null, name: null, workplaceFqdn: null }
  }

  async function startLogin(): Promise<StartLoginResult> {
    if (isRedirecting) return { ok: true }
    isRedirecting = true
    try {
      await startSsoLogin()
      return { ok: true }
    } catch (error) {
      isRedirecting = false
      return { ok: false, error: getErrorMessage(error) }
    }
  }

  async function handleCallback(): Promise<LoginCallbackResult> {
    // The SSO round trip is over: a later 401 may start a new one
    isRedirecting = false
    try {
      const result = await completeLogin()
      if (result === null) return { ok: false, error: 'missing-login-state' }
      saveTokens(result.tokenSet, normalizeUser(result.userinfo))
      return {
        ok: true,
        value: { returnTo: sanitizeReturnTo(result.returnTo) }
      }
    } catch (error) {
      if (error instanceof LoginRequiredError) {
        return {
          ok: false,
          error: 'login-required',
          returnTo: sanitizeReturnTo(error.returnTo)
        }
      }
      return {
        ok: false,
        error: 'token-exchange-failed',
        detail: getErrorMessage(error)
      }
    }
  }

  async function performRefresh(): Promise<boolean> {
    const refreshToken = tokens?.refreshToken
    if (!refreshToken) return false
    try {
      const configuration = await fetchConfiguration()
      const response = await client.refreshTokenGrant(
        configuration,
        refreshToken
      )
      // Signed out while the request was in flight
      if (tokens === null) return false
      saveTokens(response, getSignedInUser())
      return true
    } catch (error) {
      console.warn('[auth] Token refresh failed', getErrorMessage(error))
      return false
    }
  }

  async function refresh(): Promise<boolean> {
    pendingRefresh ??= performRefresh()
    const current = pendingRefresh
    try {
      return await current
    } finally {
      if (pendingRefresh === current) pendingRefresh = null
    }
  }

  async function getAuthorizationHeader(): Promise<string | null> {
    const expiresAt = tokens?.expiresAt ?? null
    if (
      expiresAt !== null &&
      expiresAt - dependencies.now() < EXPIRY_LEEWAY_MS
    ) {
      await refresh()
    }
    const accessToken = getAccessToken()
    return accessToken === undefined ? null : `Bearer ${accessToken}`
  }

  async function onUnauthorized(): Promise<boolean> {
    if (await refresh()) return true
    await startLogin()
    return false
  }

  /** Signs this tab out, the tokens of `@linagora/twake-oidc` aside */
  function endSession(reason: SessionEndReason = 'lost'): void {
    cancelScheduledRefresh()
    tokens = null
    store.setState(reason === 'signed-out' ? SIGNED_OUT : ANONYMOUS)
  }

  function clearLocalSession(reason: SessionEndReason = 'lost'): void {
    endSession(reason)
    clearTokenSet()
  }

  const service: OidcAuthService = {
    mode: 'oidc',
    getState: store.getState,
    subscribe: store.subscribe,
    getAuthorizationHeader,
    onUnauthorized,
    clearLocalSession,
    logout,
    startLogin,
    handleCallback,
    refresh,
    getIdToken: () => getIdToken() ?? null
  }

  async function logout(): Promise<void> {
    // Leaving for the SSO logout: the anonymous state must not start a login
    // (RequireAuth does), whose redirection would replace this one
    isRedirecting = true
    // The other tabs of the account sign out, the composers go; the tokens
    // stay for `logOut`, which hands the ID token to the SSO (`id_token_hint`)
    endLocalSession({ getState: store.getState, clearLocalSession: endSession })
    await logOut()
  }

  return service
}
