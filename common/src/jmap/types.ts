/**
 * Local, minimal subset of the jmap-client-ts v2 contract
 * (jmap-client-ts/docs/v2-api.md), enough to wire the client into the app
 * before the library is published.
 *
 * TODO(jmap-client-ts v2): add the dependency, then replace these types by
 * the ones the library exports (`createClient`, `JmapClient`, `Session`…)
 * and delete this file. Only the names below are used by the app.
 */

export interface JmapAuth {
  /** Called before every HTTP request (API, upload, download, ticket) */
  getAuthorizationHeader: () => Promise<string>
  /**
   * Called once on HTTP 401. Resolves true when the credentials were
   * refreshed: the request is then retried once.
   */
  onUnauthorized?: () => Promise<boolean>
}

export interface JmapClientOptions {
  sessionUrl: string
  auth: JmapAuth
  fetch?: typeof fetch
  /** Replaces the `apiUrl` the session advertises, e.g. an internal host */
  overrideApiUrl?: string
}

/** The fields of the JMAP session (RFC 8620 §2) the app relies on so far */
export interface JmapSession {
  username: string
  apiUrl: string
  state: string
  capabilities: Record<string, unknown>
  primaryAccounts: Record<string, string>
}

export interface JmapClient {
  /** Fetched once, then cached */
  getSession: () => Promise<JmapSession>
  refreshSession: () => Promise<JmapSession>
  /** Throws when the session has no primary account for the capability */
  getPrimaryAccountId: (capability: string) => string
  hasCapability: (capability: string) => boolean
}

/** Signature of `createClient` from jmap-client-ts */
export type JmapClientFactory = (options: JmapClientOptions) => JmapClient
