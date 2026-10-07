import * as client from 'openid-client'

import type { OidcConfig } from '@common/config/config'
import {
  getCurrentPath,
  redirectTo,
  replaceWith
} from '@common/utils/navigation'

import { makeAuthStore } from './authStore'
import { endLocalSession } from './localSession'
import { sanitizeReturnTo } from './returnTo'
import {
  ANONYMOUS,
  type AuthUser,
  type LoginCallbackResult,
  type OidcAuthService,
  type StartLoginResult
} from './types'

/** sessionStorage key of the PKCE verifier, state and return path of a login */
export const PENDING_LOGIN_STORAGE_KEY = 'twake-mail.oidc.pending-login'

/** Timeout of the discovery, then of every request to the SSO, in seconds */
const SSO_TIMEOUT_S = 10
/** Tolerated clock difference between the browser and the SSO, in seconds */
const CLOCK_SKEW_S = 300
/** Tokens are renewed this long before they expire */
const REFRESH_AHEAD_MS = 60_000
/** A token closer than this to its expiry is renewed before being sent */
const EXPIRY_LEEWAY_MS = 10_000
/**
 * Answers of the SSO to a silent login (`prompt=none`) when it would need
 * to show a page: no session, consent, account choice (OpenID Connect Core
 * 1.0, 3.1.2.6)
 */
const LOGIN_REQUIRED_ERRORS = new Set([
  'login_required',
  'interaction_required',
  'consent_required',
  'account_selection_required'
])

interface OidcTokens {
  accessToken: string
  refreshToken: string | null
  idToken: string | null
  /** Epoch milliseconds, null when the SSO does not tell */
  expiresAt: number | null
}

interface PendingLogin {
  codeVerifier: string
  state: string
  returnTo: string
  /** A login without any page of the SSO (`prompt=none`) */
  silent?: boolean
}

type TokenResponse = client.TokenEndpointResponse &
  client.TokenEndpointResponseHelpers

export interface OidcDependencies {
  /** Holds the pending login across the SSO round trip */
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  redirect: (url: string) => void
  /** Leaves for the SSO without adding a history entry */
  replace: (url: string) => void
  getCurrentPath: () => string
  now: () => number
}

export interface OidcOptions {
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
  return {
    storage: window.sessionStorage,
    redirect: redirectTo,
    replace: replaceWith,
    getCurrentPath,
    now: () => Date.now()
  }
}

function isPendingLogin(value: unknown): value is PendingLogin {
  return (
    typeof value === 'object' &&
    value !== null &&
    'codeVerifier' in value &&
    typeof value.codeVerifier === 'string' &&
    'state' in value &&
    typeof value.state === 'string' &&
    'returnTo' in value &&
    typeof value.returnTo === 'string' &&
    (!('silent' in value) || typeof value.silent === 'boolean')
  )
}

/**
 * Where the pending login comes back to, without consuming it: the app
 * reads it on its callback page to know which screen the login is for.
 */
export function peekPendingLoginReturnTo(
  storage: Pick<Storage, 'getItem'> = window.sessionStorage
): string | null {
  const raw = storage.getItem(PENDING_LOGIN_STORAGE_KEY)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isPendingLogin(parsed) ? sanitizeReturnTo(parsed.returnTo) : null
  } catch {
    return null
  }
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

function isCompleteUser(user: AuthUser): boolean {
  return user.email !== null && user.name !== null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

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
 * OpenID Connect authentication: Authorization Code flow with PKCE (S256).
 *
 * The tokens are held in memory only: web storage is readable by any script
 * of the page, so a single XSS would hand them over. A reload goes through
 * the SSO again, which signs the user back in silently while their SSO
 * session lasts.
 */
export function createOidcAuthService(
  config: OidcConfig,
  dependencies: OidcDependencies = makeDefaultDependencies(),
  { framed = false, redirectUri = config.redirectUri }: OidcOptions = {}
): OidcAuthService {
  const store = makeAuthStore()
  let tokens: OidcTokens | null = null
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
  function saveTokens(response: TokenResponse, knownUser: AuthUser): void {
    const expiresIn = response.expiresIn()
    tokens = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? tokens?.refreshToken ?? null,
      idToken: response.id_token ?? tokens?.idToken ?? null,
      expiresAt:
        expiresIn === undefined ? null : dependencies.now() + expiresIn * 1000
    }
    const user = mergeUsers(normalizeUser(response.claims()), knownUser)
    store.setState({ status: 'authenticated', user })
    scheduleRefresh()
  }

  function getSignedInUser(): AuthUser {
    const state = store.getState()
    return state.status === 'authenticated'
      ? state.user
      : { email: null, name: null, workplaceFqdn: null }
  }

  /**
   * Who signed in, when the ID token does not say (LemonLDAP::NG puts the
   * profile in userinfo only, depending on its configuration): asks the
   * userinfo endpoint. Null fields when it cannot tell either.
   */
  async function fetchUserInfo(
    configuration: client.Configuration,
    response: TokenResponse
  ): Promise<AuthUser> {
    const claims = response.claims()
    if (isCompleteUser(normalizeUser(claims))) return normalizeUser(claims)
    try {
      const userInfo = await client.fetchUserInfo(
        configuration,
        response.access_token,
        claims?.sub ??
          // No ID token to compare the subject with: the access token was
          // just obtained from the token endpoint over TLS
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          client.skipSubjectCheck
      )
      return normalizeUser(userInfo)
    } catch (error) {
      console.warn('[auth] Userinfo unavailable', getErrorMessage(error))
      return { email: null, name: null, workplaceFqdn: null }
    }
  }

  async function startLogin(returnTo: string): Promise<StartLoginResult> {
    if (isRedirecting) return { ok: true }
    isRedirecting = true
    try {
      const configuration = await fetchConfiguration()
      const codeVerifier = client.randomPKCECodeVerifier()
      const codeChallenge =
        await client.calculatePKCECodeChallenge(codeVerifier)
      const state = client.randomState()
      const pendingLogin: PendingLogin = {
        codeVerifier,
        state,
        returnTo: sanitizeReturnTo(returnTo),
        ...(framed ? { silent: true } : {})
      }
      dependencies.storage.setItem(
        PENDING_LOGIN_STORAGE_KEY,
        JSON.stringify(pendingLogin)
      )
      const authorizationUrl = client.buildAuthorizationUrl(configuration, {
        redirect_uri: redirectUri,
        scope: config.scope,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        ...(framed ? { prompt: 'none' } : {})
      })
      if (framed) {
        dependencies.replace(authorizationUrl.href)
      } else {
        dependencies.redirect(authorizationUrl.href)
      }
      return { ok: true }
    } catch (error) {
      isRedirecting = false
      return { ok: false, error: getErrorMessage(error) }
    }
  }

  function takePendingLogin(): PendingLogin | null {
    const raw = dependencies.storage.getItem(PENDING_LOGIN_STORAGE_KEY)
    dependencies.storage.removeItem(PENDING_LOGIN_STORAGE_KEY)
    if (raw === null) return null
    try {
      const parsed: unknown = JSON.parse(raw)
      return isPendingLogin(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  async function handleCallback(
    callbackUrl: URL
  ): Promise<LoginCallbackResult> {
    // The SSO round trip is over: a later 401 may start a new one
    isRedirecting = false
    const pendingLogin = takePendingLogin()
    if (!pendingLogin) return { ok: false, error: 'missing-login-state' }

    const returnTo = sanitizeReturnTo(pendingLogin.returnTo)
    const ssoError = callbackUrl.searchParams.get('error')
    if (
      pendingLogin.silent === true &&
      ssoError !== null &&
      LOGIN_REQUIRED_ERRORS.has(ssoError) &&
      callbackUrl.searchParams.get('state') === pendingLogin.state
    ) {
      return { ok: false, error: 'login-required', returnTo }
    }

    try {
      const configuration = await fetchConfiguration()
      const response = await client.authorizationCodeGrant(
        configuration,
        callbackUrl,
        {
          pkceCodeVerifier: pendingLogin.codeVerifier,
          expectedState: pendingLogin.state
        }
      )
      saveTokens(response, await fetchUserInfo(configuration, response))
      return { ok: true, value: { returnTo } }
    } catch (error) {
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
    return tokens ? `Bearer ${tokens.accessToken}` : null
  }

  async function onUnauthorized(): Promise<boolean> {
    if (await refresh()) return true
    await startLogin(dependencies.getCurrentPath())
    return false
  }

  function clearLocalSession(): void {
    cancelScheduledRefresh()
    tokens = null
    store.setState(ANONYMOUS)
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
    getIdToken: () => tokens?.idToken ?? null
  }

  async function logout(): Promise<void> {
    const idToken = tokens?.idToken ?? null
    // Leaving for the SSO logout: the anonymous state must not start a login
    // (RequireAuth does), whose redirection would replace this one
    isRedirecting = true
    endLocalSession(service)
    try {
      const configuration = await fetchConfiguration()
      const parameters: Record<string, string> = {
        post_logout_redirect_uri: config.postLogoutRedirectUri
      }
      if (idToken) parameters.id_token_hint = idToken
      dependencies.redirect(
        client.buildEndSessionUrl(configuration, parameters).href
      )
    } catch (error) {
      // No end_session_endpoint, or the SSO is unreachable
      console.warn('[auth] SSO logout unavailable', getErrorMessage(error))
      dependencies.redirect(config.postLogoutRedirectUri)
    }
  }

  return service
}
