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
 * An application of the app grid (`appList.js`). `link` and `icon` may be
 * URI templates (`{localpart}`, `{workplaceFqdn}`…), resolved for the user:
 * a Twake Drive lives at an address of its own.
 */
export interface AppListEntry {
  name: string
  link: string
  icon: string
}

export interface AppConfig {
  jmapSessionUrl: string
  authMode: AuthMode
  /** Set when `authMode` is `oidc`, null otherwise */
  oidc: OidcConfig | null
  sentryDsn: string | null
  /** tmail-flutter `SENTRY_ENVIRONMENT`, null when blank */
  sentryEnvironment: string | null
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
   * the app grid to the container, as Twake Calendar does
   */
  workplaceEmbedding: boolean
  /**
   * The Twake Drive picker of the composer: the URI template of the Drive
   * (cozy-stack) of the user, null when `TDRIVE_ENABLED` is off
   */
  tdriveIntentUrl: string | null
  appVersion: string
  appList: AppListEntry[]
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
  | 'APP_GRID_AVAILABLE'
  | 'FORWARD_WARNING_MESSAGE'
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
  | 'TDRIVE_ENABLED'
  | 'TDRIVE_INTENT_URL'
  | 'APP_VERSION'
  | 'appList'

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

function isAppListEntry(value: unknown): value is AppListEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'link' in value &&
    typeof value.link === 'string' &&
    'icon' in value &&
    typeof value.icon === 'string'
  )
}

function readEntryString(entry: object, key: string): string | undefined {
  const value: unknown = Object.getOwnPropertyDescriptor(entry, key)?.value
  return typeof value === 'string' ? value : undefined
}

/**
 * An app as tmail-flutter writes it in `configurations/app_dashboard.json`
 * (`appName`, `appLink`, `publicIconUri`) becomes an entry of `appList.js`.
 * Its `icon` is the name of an asset of the Flutter app: only a
 * `publicIconUri` can serve as an icon here.
 */
function fromFlutterAppEntry(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const name = readEntryString(value, 'appName')
  const link = readEntryString(value, 'appLink')
  const icon = readEntryString(value, 'publicIconUri')
  return name !== undefined && link !== undefined && icon !== undefined
    ? { name, link, icon }
    : value
}

function normalizeAppList(value: unknown): AppListEntry[] {
  return Array.isArray(value)
    ? value.map(fromFlutterAppEntry).filter(isAppListEntry)
    : []
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
  warn: DeprecationWarner
): OidcConfig | null {
  const issuerUrl = normalizeString(source.SSO_BASE_URL)
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

/**
 * Error reporting. With `SENTRY_ENABLED` in the configuration, as in
 * tmail-flutter, it starts only with `SENTRY_ENABLED=true` and a DSN. Without
 * the key (a configuration from before it existed), a DSN is enough: reported
 * as deprecated.
 */
function resolveSentry(
  source: RuntimeConfigSource,
  warn: DeprecationWarner
): Pick<AppConfig, 'sentryDsn' | 'sentryEnvironment'> {
  const dsn = normalizeString(source.SENTRY_DSN)
  if (source.SENTRY_ENABLED === undefined) {
    if (dsn !== null) {
      warn(
        'SENTRY_DSN without SENTRY_ENABLED is deprecated, set SENTRY_ENABLED=true'
      )
    }
    return {
      sentryDsn: dsn,
      sentryEnvironment: normalizeString(source.SENTRY_ENVIRONMENT)
    }
  }
  return toBoolean(source.SENTRY_ENABLED)
    ? {
        sentryDsn: dsn,
        sentryEnvironment: normalizeString(source.SENTRY_ENVIRONMENT)
      }
    : { sentryDsn: null, sentryEnvironment: null }
}

/**
 * `APP_GRID_AVAILABLE=supported` shows the app grid, anything else hides it
 * (tmail-flutter). Without the key, the grid shows when `appList.js` has apps.
 */
function isAppGridAvailable(source: RuntimeConfigSource): boolean {
  return (
    source.APP_GRID_AVAILABLE === undefined ||
    normalizeString(source.APP_GRID_AVAILABLE) === 'supported'
  )
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

  const oidc =
    authMode === 'oidc' ? resolveOidcConfig(source, origin, errors, warn) : null

  if (errors.length > 0 || !jmapSessionUrl || !authMode) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      jmapSessionUrl,
      authMode,
      oidc,
      ...resolveSentry(source, warn),
      debug: toBoolean(source.DEBUG),
      defaultLanguage: normalizeString(source.LANG),
      calendarSpaUrl: normalizeString(source.CALENDAR_SPA_URL),
      chatSpaUrl: normalizeString(source.CHAT_SPA_URL),
      workplaceFqdnFallback: normalizeString(source.WORKPLACE_FQDN_FALLBACK),
      forwardWarningMessage: normalizeString(source.FORWARD_WARNING_MESSAGE),
      workplaceEmbedding: toBoolean(source.WORKPLACE_EMBEDDING),
      tdriveIntentUrl: toBoolean(source.TDRIVE_ENABLED)
        ? normalizeString(source.TDRIVE_INTENT_URL)
        : null,
      appVersion: normalizeString(source.APP_VERSION) ?? 'dev',
      appList: isAppGridAvailable(source)
        ? normalizeAppList(source.appList)
        : []
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
