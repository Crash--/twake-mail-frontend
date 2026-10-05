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

export type RuntimeConfigKey =
  | 'JMAP_SESSION_URL'
  | 'AUTH_MODE'
  | 'SSO_BASE_URL'
  | 'SSO_CLIENT_ID'
  | 'SSO_SCOPE'
  | 'SSO_REDIRECT_URI'
  | 'SSO_POST_LOGOUT_REDIRECT'
  | 'SENTRY_DSN'
  | 'DEBUG'
  | 'LANG'
  | 'CALENDAR_SPA_URL'
  | 'CHAT_SPA_URL'
  | 'WORKPLACE_FQDN_FALLBACK'
  | 'FORWARD_WARNING_MESSAGE'
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

function normalizeAppList(value: unknown): AppListEntry[] {
  return Array.isArray(value) ? value.filter(isAppListEntry) : []
}

function resolveOidcConfig(
  source: RuntimeConfigSource,
  origin: string,
  errors: string[]
): OidcConfig | null {
  const issuerUrl = normalizeString(source.SSO_BASE_URL)
  const clientId = normalizeString(source.SSO_CLIENT_ID)
  const redirectUri =
    normalizeString(source.SSO_REDIRECT_URI) ?? `${origin}/callback`
  const postLogoutRedirectUri =
    normalizeString(source.SSO_POST_LOGOUT_REDIRECT) ?? `${origin}/`

  if (!issuerUrl || !isAbsoluteHttpUrl(issuerUrl)) {
    errors.push('SSO_BASE_URL must be an absolute http(s) URL')
  }
  if (!clientId) {
    errors.push('SSO_CLIENT_ID is required')
  }
  if (!isAbsoluteHttpUrl(redirectUri)) {
    errors.push('SSO_REDIRECT_URI must be an absolute http(s) URL')
  }
  if (!issuerUrl || !clientId) return null

  return {
    issuerUrl,
    clientId,
    scope: normalizeString(source.SSO_SCOPE) ?? DEFAULT_SSO_SCOPE,
    redirectUri,
    postLogoutRedirectUri
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
  origin: string
): ConfigResult {
  const errors: string[] = []

  const jmapSessionUrl = normalizeString(source.JMAP_SESSION_URL)
  if (!jmapSessionUrl || !isAbsoluteHttpUrl(jmapSessionUrl)) {
    errors.push('JMAP_SESSION_URL must be an absolute http(s) URL')
  }

  const authMode = toAuthMode(source.AUTH_MODE)
  if (!authMode) {
    errors.push(`AUTH_MODE must be one of: ${AUTH_MODES.join(', ')}`)
  }

  const oidc =
    authMode === 'oidc' ? resolveOidcConfig(source, origin, errors) : null

  if (errors.length > 0 || !jmapSessionUrl || !authMode) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      jmapSessionUrl,
      authMode,
      oidc,
      sentryDsn: normalizeString(source.SENTRY_DSN),
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
      appList: normalizeAppList(source.appList)
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
