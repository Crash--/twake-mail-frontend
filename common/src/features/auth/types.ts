import type { AuthMode } from '@common/config/config'

export interface AuthUser {
  email: string | null
  name: string | null
  /**
   * The Twake Workplace of the user (`workplaceFqdn` claim of the SSO, as
   * tmail-flutter reads it), for the URI templates of the other apps
   */
  workplaceFqdn: string | null
}

/**
 * `restoring`: a new tab of the basic mode asks the other tabs for their
 * session before showing the login form (`basicSessionSharing.ts`).
 * `signedOut`: the user signed out, in this tab or another one, rather than
 * the session being lost: the next sign-in, maybe someone else's, starts
 * afresh.
 */
export type AuthState =
  | { status: 'anonymous'; signedOut?: boolean }
  | { status: 'restoring' }
  | { status: 'authenticated'; user: AuthUser }

export const ANONYMOUS: AuthState = { status: 'anonymous' }
export const SIGNED_OUT: AuthState = { status: 'anonymous', signedOut: true }

/** Why a tab drops its session: `signed-out` when the user signed out */
export type SessionEndReason = 'signed-out' | 'lost'

/**
 * What every authentication mode offers. The JMAP client consumes
 * `getAuthorizationHeader` and `onUnauthorized`, the UI the rest.
 */
export interface AuthServiceBase {
  readonly mode: AuthMode
  getState: () => AuthState
  /** Calls the listener on every state change; returns the unsubscribe function */
  subscribe: (listener: () => void) => () => void
  /** Value of the `Authorization` header for the JMAP server, null when signed out */
  getAuthorizationHeader: () => Promise<string | null>
  /**
   * Called when the JMAP server answers 401. Resolves true when the
   * credentials were renewed and the request can be retried once.
   */
  onUnauthorized: () => Promise<boolean>
  /**
   * Drops the credentials held by this tab, without telling the other tabs
   * (`lost` by default)
   */
  clearLocalSession: (reason?: SessionEndReason) => void
  /**
   * Ends the session in every tab of the application, then leaves for the
   * SSO logout endpoint in OIDC mode. Resolves once that navigation is
   * requested: there is nothing more to report.
   */
  logout: () => Promise<void>
}

export type StartLoginResult = { ok: true } | { ok: false; error: string }

export type LoginCallbackResult =
  | { ok: true; value: { returnTo: string } }
  | {
      ok: false
      error: 'missing-login-state' | 'token-exchange-failed'
      detail?: string
    }
  /** A silent login the SSO cannot complete without the user */
  | { ok: false; error: 'login-required'; returnTo: string }

export interface OidcAuthService extends AuthServiceBase {
  readonly mode: 'oidc'
  /** Leaves for the SSO, which comes back to the current page afterwards */
  startLogin: () => Promise<StartLoginResult>
  /** Exchanges the authorization code of the callback page for tokens */
  handleCallback: () => Promise<LoginCallbackResult>
  /**
   * Renews the tokens with the refresh token. Concurrent calls share the
   * same request. Resolves false when there is no refresh token or the SSO
   * refuses it.
   */
  refresh: () => Promise<boolean>
  /**
   * The ID token of the session, for the token exchanges of the other
   * Twake apps (Drive); null without one. Never stored nor logged.
   */
  getIdToken: () => string | null
}

export type BasicLoginError =
  'invalid-credentials' | 'network-error' | 'unexpected-response'

export type BasicLoginResult =
  { ok: true } | { ok: false; error: BasicLoginError }

export interface BasicAuthService extends AuthServiceBase {
  readonly mode: 'basic'
  /** Checks the credentials against the JMAP session endpoint, keeps them if valid */
  login: (username: string, password: string) => Promise<BasicLoginResult>
}

export type AuthService = OidcAuthService | BasicAuthService
