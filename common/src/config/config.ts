export type AuthMode = 'oidc' | 'basic'

export interface OidcConfig {
  /** Issuer URL, where `/.well-known/openid-configuration` is served */
  issuerUrl: string
  clientId: string
  scope: string
  redirectUri: string
  postLogoutRedirectUri: string
}

/**
 * The SSO is not given (`SSO_BASE_URL`): it is looked up at runtime from the
 * JMAP server, as tmail-flutter does (`completeConfig`)
 */
export interface IssuerDiscovery {
  /** `SERVER_URL`, without trailing slash: WebFinger is asked there */
  serverUrl: string
  /**
   * Sign in with the Basic form when no SSO is found, as tmail-flutter does.
   * Off when `AUTH_MODE=oidc` is explicit: the SSO is then required.
   */
  fallbackToBasic: boolean
}

export type SentrySource = 'env' | 'ecosystem'

export interface AppConfig {
  jmapSessionUrl: string
  authMode: AuthMode
  /** Set when `authMode` is `oidc`, null otherwise */
  oidc: OidcConfig | null
  /**
   * Set while `oidc.issuerUrl` is only a guess (`SERVER_URL` itself): the
   * issuer is to be discovered. Null when `SSO_BASE_URL` gives it.
   */
  issuerDiscovery: IssuerDiscovery | null
  /**
   * Where the error reporting configuration comes from, as in tmail-flutter
   * on the web: `env` as soon as one of the `SENTRY_*` keys is filled (even
   * to turn it off), `ecosystem` (`.well-known/linagora-ecosystem` of the
   * server) when all three are absent or blank
   */
  sentrySource: SentrySource
  /** The DSN of the `env` source; null when it is off, or from the ecosystem */
  sentryDsn: string | null
  /** tmail-flutter `SENTRY_ENVIRONMENT`, null when blank */
  sentryEnvironment: string | null
  /**
   * `SENTRY_FEEDBACK_ENABLED`: offers the feedback widget to the users who
   * opted in to error reporting. Independent of where the DSN comes from;
   * off by default
   */
  sentryFeedbackEnabled: boolean
  /** The Linagora ecosystem document of the server (`SERVER_URL` based) */
  ecosystemUrl: string
  debug: boolean
  defaultLanguage: string | null
  calendarSpaUrl: string | null
  chatSpaUrl: string | null
  workplaceFqdnFallback: string | null
  /**
   * Shown in Settings > Forwarding, e.g. the rules of the organisation on
   * forwarding emails outside (tmail-flutter `FORWARD_WARNING_MESSAGE`)
   */
  forwardWarningMessage: string | null
  /**
   * Inside an iframe (Twake Workplace), the top bar leaves the logotype and
   * the app grid to the container, as Twake Calendar does. On with
   * `WORKPLACE_EMBEDDING` or `COZY_INTEGRATION` (tmail-flutter, which loads
   * cozy-external-bridge when it is `true`: this app bundles it)
   */
  workplaceEmbedding: boolean
  /**
   * The Twake Drive picker of the composer: the URI template of the Drive
   * (cozy-stack) of the user, null when `TDRIVE_ENABLED` is off
   */
  tdriveIntentUrl: string | null
  appVersion: string
}

/**
 * The keys shared with the `env.file` of tmail-flutter, with its names and
 * its value formats
 */
export type FlutterConfigKey =
  | 'SERVER_URL'
  | 'DOMAIN_REDIRECT_URL'
  | 'WEB_OIDC_CLIENT_ID'
  | 'OIDC_SCOPES'
  | 'FORWARD_WARNING_MESSAGE'
  | 'COZY_INTEGRATION'
  | 'SENTRY_ENABLED'
  | 'SENTRY_DSN'
  | 'SENTRY_ENVIRONMENT'

/** Former names of the keys above, still read with a deprecation warning */
export type DeprecatedConfigKey =
  'JMAP_SESSION_URL' | 'SSO_CLIENT_ID' | 'SSO_SCOPE'

export type RuntimeConfigKey =
  | FlutterConfigKey
  | DeprecatedConfigKey
  | 'AUTH_MODE'
  | 'SSO_BASE_URL'
  | 'SSO_REDIRECT_URI'
  | 'SSO_POST_LOGOUT_REDIRECT'
  | 'DEBUG'
  | 'LANG'
  | 'CALENDAR_SPA_URL'
  | 'CHAT_SPA_URL'
  | 'WORKPLACE_FQDN_FALLBACK'
  | 'WORKPLACE_EMBEDDING'
  | 'SENTRY_FEEDBACK_ENABLED'
  | 'TDRIVE_ENABLED'
  | 'TDRIVE_INTENT_URL'
  | 'APP_VERSION'

/**
 * The runtime configuration entries as written by operators in
 * `public/.env.js`: any of them may be missing or of the wrong type.
 */
export type RuntimeConfigSource = Partial<Record<RuntimeConfigKey, unknown>>

export type ConfigResult =
  { ok: true; value: AppConfig } | { ok: false; errors: string[] }

const AUTH_MODES: readonly AuthMode[] = ['oidc', 'basic']

export const DEFAULT_SSO_SCOPE = 'openid profile email offline_access'

/** Path of the OIDC redirect, relative to `DOMAIN_REDIRECT_URL` (tmail-flutter) */
export const LOGIN_CALLBACK_PATH = 'login-callback.html'
/** Path of the post-logout redirect, relative to `DOMAIN_REDIRECT_URL` */
export const LOGOUT_CALLBACK_PATH = 'logout-callback.html'

/** Reports a deprecated key, once per key and per resolution */
export type DeprecationWarner = (message: string) => void

/** The JMAP session of a server, found at this path (RFC 8620, 2.2) */
const JMAP_SESSION_WELL_KNOWN_PATH = '/.well-known/jmap'

/** The Linagora ecosystem document of a server, next to its JMAP session */
const ECOSYSTEM_WELL_KNOWN_PATH = '/.well-known/linagora-ecosystem'

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function toAuthMode(value: unknown): AuthMode | null {
  const raw = normalizeString(value) ?? 'oidc'
  return (AUTH_MODES as readonly string[]).includes(raw)
    ? (raw as AuthMode) // SAFETY: membership checked above
    : null
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 'true'
}

function removeTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * The value of a key named as in tmail-flutter, else of its former name
 * (reported once). A blank value counts as absent.
 */
function readKey(
  source: RuntimeConfigSource,
  key: FlutterConfigKey,
  deprecatedKey: DeprecatedConfigKey | null,
  warn: DeprecationWarner
): string | null {
  const value = normalizeString(source[key])
  if (value !== null || deprecatedKey === null) return value

  const deprecatedValue = normalizeString(source[deprecatedKey])
  if (deprecatedValue !== null) {
    warn(`${deprecatedKey} is deprecated, use ${key} instead`)
  }
  return deprecatedValue
}

/**
 * The scopes of `OIDC_SCOPES`, which tmail-flutter writes separated by
 * commas (`openid,profile,email`); spaces are accepted too.
 */
function parseScopes(value: string | null): string | null {
  const scopes = (value ?? '').split(/[\s,]+/).filter(scope => scope !== '')
  return scopes.length === 0 ? null : scopes.join(' ')
}

/**
 * `SERVER_URL` is the base URL of the JMAP server, as in tmail-flutter, which
 * reads the session from `<SERVER_URL>/.well-known/jmap`. The paths are
 * joined, not resolved: a prefix without trailing slash is kept.
 */
function toSessionUrl(serverUrl: string): string {
  return `${removeTrailingSlashes(serverUrl)}${JMAP_SESSION_WELL_KNOWN_PATH}`
}

/**
 * The redirect URIs: `SSO_REDIRECT_URI` and `SSO_POST_LOGOUT_REDIRECT` when
 * set, else built from `DOMAIN_REDIRECT_URL` as tmail-flutter does
 * (`<DOMAIN_REDIRECT_URL>/login-callback.html`, `.../logout-callback.html`),
 * else those of the origin.
 */
function resolveRedirectUris(
  source: RuntimeConfigSource,
  origin: string
): { redirectUri: string; postLogoutRedirectUri: string } {
  const domain = normalizeString(source.DOMAIN_REDIRECT_URL)
  const base = domain === null ? null : removeTrailingSlashes(domain)
  return {
    redirectUri:
      normalizeString(source.SSO_REDIRECT_URI) ??
      (base === null ? `${origin}/callback` : `${base}/${LOGIN_CALLBACK_PATH}`),
    postLogoutRedirectUri:
      normalizeString(source.SSO_POST_LOGOUT_REDIRECT) ??
      (base === null ? `${origin}/` : `${base}/${LOGOUT_CALLBACK_PATH}`)
  }
}

function resolveOidcConfig(
  source: RuntimeConfigSource,
  origin: string,
  errors: string[],
  warn: DeprecationWarner,
  discoveryServerUrl: string | null
): OidcConfig | null {
  // Without SSO_BASE_URL, tmail-flutter guesses the SSO is the server itself
  // when WebFinger finds none
  const issuerUrl = normalizeString(source.SSO_BASE_URL) ?? discoveryServerUrl
  const clientId = readKey(source, 'WEB_OIDC_CLIENT_ID', 'SSO_CLIENT_ID', warn)
  const { redirectUri, postLogoutRedirectUri } = resolveRedirectUris(
    source,
    origin
  )

  if (!issuerUrl || !isAbsoluteHttpUrl(issuerUrl)) {
    errors.push('SSO_BASE_URL must be an absolute http(s) URL')
  }
  if (!clientId) {
    errors.push('WEB_OIDC_CLIENT_ID is required')
  }
  if (!isAbsoluteHttpUrl(redirectUri)) {
    errors.push(
      'DOMAIN_REDIRECT_URL (or SSO_REDIRECT_URI) must be an absolute http(s) URL'
    )
  }
  if (!isAbsoluteHttpUrl(postLogoutRedirectUri)) {
    errors.push(
      'DOMAIN_REDIRECT_URL (or SSO_POST_LOGOUT_REDIRECT) must be an absolute http(s) URL'
    )
  }
  if (!issuerUrl || !clientId) return null

  return {
    issuerUrl,
    clientId,
    scope:
      parseScopes(readKey(source, 'OIDC_SCOPES', 'SSO_SCOPE', warn)) ??
      DEFAULT_SSO_SCOPE,
    redirectUri,
    postLogoutRedirectUri
  }
}

/** A key filled in: a boolean, or a string that is not blank */
function isFilled(value: unknown): boolean {
  return typeof value === 'boolean' || normalizeString(value) !== null
}

/**
 * Error reporting. As in tmail-flutter on the web, one filled `SENTRY_*` key
 * makes the configuration come from the environment, with no fallback to the
 * ecosystem even when it is off or incomplete; all three absent or blank
 * leave it to the ecosystem of the server. From the environment it starts
 * only with `SENTRY_ENABLED=true` and a DSN. Without `SENTRY_ENABLED` (a
 * configuration from before it existed), a DSN is enough: reported as
 * deprecated. `SENTRY_FEEDBACK_ENABLED` is not one of these keys: it does not
 * choose the source, and works with the DSN of the ecosystem as well.
 */
function resolveSentry(
  source: RuntimeConfigSource,
  warn: DeprecationWarner
): Pick<AppConfig, 'sentrySource' | 'sentryDsn' | 'sentryEnvironment'> {
  const isFromEnv = [
    source.SENTRY_ENABLED,
    source.SENTRY_DSN,
    source.SENTRY_ENVIRONMENT
  ].some(isFilled)
  if (!isFromEnv) {
    return {
      sentrySource: 'ecosystem',
      sentryDsn: null,
      sentryEnvironment: null
    }
  }
  const dsn = normalizeString(source.SENTRY_DSN)
  const environment = normalizeString(source.SENTRY_ENVIRONMENT)
  const isDeprecatedDsnOnly =
    source.SENTRY_ENABLED === undefined && dsn !== null
  if (isDeprecatedDsnOnly) {
    warn(
      'SENTRY_DSN without SENTRY_ENABLED is deprecated, set SENTRY_ENABLED=true'
    )
  }
  const isOn = isDeprecatedDsnOnly || toBoolean(source.SENTRY_ENABLED)
  return {
    sentrySource: 'env',
    sentryDsn: isOn ? dsn : null,
    sentryEnvironment: isOn ? environment : null
  }
}

/**
 * Validates the runtime configuration and fills in its defaults.
 *
 * @param source the configuration entries, usually `window`
 * @param origin origin of the application, used for the default OIDC redirect URIs
 */
export function resolveConfig(
  source: RuntimeConfigSource,
  origin: string,
  warn: DeprecationWarner = message => console.warn(`[config] ${message}`)
): ConfigResult {
  const errors: string[] = []

  const serverUrl = normalizeString(source.SERVER_URL)
  const sessionUrlAlias = normalizeString(source.JMAP_SESSION_URL)
  if (serverUrl === null && sessionUrlAlias !== null) {
    warn(
      'JMAP_SESSION_URL is deprecated, use SERVER_URL (the base URL of the JMAP server) instead'
    )
  }
  const jmapSessionUrl =
    serverUrl === null ? sessionUrlAlias : toSessionUrl(serverUrl)
  if (!jmapSessionUrl || !isAbsoluteHttpUrl(jmapSessionUrl)) {
    errors.push('SERVER_URL must be an absolute http(s) URL')
  }

  const authMode = toAuthMode(source.AUTH_MODE)
  if (!authMode) {
    errors.push(`AUTH_MODE must be one of: ${AUTH_MODES.join(', ')}`)
  }

  const hasSsoBaseUrl = normalizeString(source.SSO_BASE_URL) !== null
  const discoveryServerUrl =
    authMode === 'oidc' && !hasSsoBaseUrl && serverUrl !== null
      ? removeTrailingSlashes(serverUrl)
      : null
  const oidc =
    authMode === 'oidc'
      ? resolveOidcConfig(source, origin, errors, warn, discoveryServerUrl)
      : null

  if (errors.length > 0 || !jmapSessionUrl || !authMode) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      jmapSessionUrl,
      authMode,
      oidc,
      issuerDiscovery:
        discoveryServerUrl === null
          ? null
          : {
              serverUrl: discoveryServerUrl,
              fallbackToBasic: normalizeString(source.AUTH_MODE) === null
            },
      ...resolveSentry(source, warn),
      sentryFeedbackEnabled: toBoolean(source.SENTRY_FEEDBACK_ENABLED),
      ecosystemUrl:
        serverUrl === null
          ? new URL(ECOSYSTEM_WELL_KNOWN_PATH, jmapSessionUrl).href
          : `${removeTrailingSlashes(serverUrl)}${ECOSYSTEM_WELL_KNOWN_PATH}`,
      debug: toBoolean(source.DEBUG),
      defaultLanguage: normalizeString(source.LANG),
      calendarSpaUrl: normalizeString(source.CALENDAR_SPA_URL),
      chatSpaUrl: normalizeString(source.CHAT_SPA_URL),
      workplaceFqdnFallback: normalizeString(source.WORKPLACE_FQDN_FALLBACK),
      forwardWarningMessage: normalizeString(source.FORWARD_WARNING_MESSAGE),
      workplaceEmbedding:
        toBoolean(source.WORKPLACE_EMBEDDING) ||
        toBoolean(source.COZY_INTEGRATION),
      tdriveIntentUrl: toBoolean(source.TDRIVE_ENABLED)
        ? normalizeString(source.TDRIVE_INTENT_URL)
        : null,
      appVersion: normalizeString(source.APP_VERSION) ?? 'dev'
    }
  }
}

let cachedResult: ConfigResult | null = null

/**
 * The validated runtime configuration of the page, resolved once.
 */
export function getConfigResult(): ConfigResult {
  cachedResult ??= resolveConfig(window, window.location.origin)
  return cachedResult
}
