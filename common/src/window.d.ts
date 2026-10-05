import type { AppListEntry, AuthMode } from '@common/config/config'

export {}

/**
 * Runtime configuration, set by `public/.env.js`, `public/appList.js` and
 * `public/version.js` before the bundle loads. These files are written by
 * operators: read the entries through `getConfigResult()`, which validates
 * them, never directly.
 */
declare global {
  interface Window {
    /** URL of the JMAP session resource */
    JMAP_SESSION_URL?: string
    /** Defaults to 'oidc' */
    AUTH_MODE?: AuthMode

    /** OIDC issuer URL, required when AUTH_MODE is 'oidc' */
    SSO_BASE_URL?: string
    SSO_CLIENT_ID?: string
    /** Defaults to 'openid profile email offline_access' */
    SSO_SCOPE?: string
    /** Defaults to `<origin>/callback` */
    SSO_REDIRECT_URI?: string
    /** Defaults to `<origin>/` */
    SSO_POST_LOGOUT_REDIRECT?: string

    SENTRY_DSN?: string
    DEBUG?: boolean
    /** Default UI language: en, fr, ru or vi */
    LANG?: string

    /** URI templates of the other Twake applications */
    CALENDAR_SPA_URL?: string
    CHAT_SPA_URL?: string
    WORKPLACE_FQDN_FALLBACK?: string

    /** Shown in Settings > Forwarding when set */
    FORWARD_WARNING_MESSAGE?: string
    /** Adapts the top bar inside an iframe of Twake Workplace */
    WORKPLACE_EMBEDDING?: boolean

    APP_VERSION?: string

    appList?: AppListEntry[]
  }
}
