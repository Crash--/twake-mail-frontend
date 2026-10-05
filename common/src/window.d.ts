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
    /**
     * Keys shared with the `env.file` of tmail-flutter: same names, same
     * value formats. `env.file` values are strings (`'true'`, not `true`).
     */
    /** Base URL of the JMAP server: the session is `<SERVER_URL>/.well-known/jmap` */
    SERVER_URL?: string
    /** URL of the app: the redirect URIs are `<it>/login-callback.html` and `<it>/logout-callback.html` */
    DOMAIN_REDIRECT_URL?: string
    WEB_OIDC_CLIENT_ID?: string
    /** Separated by commas, e.g. `openid,profile,email,offline_access` (spaces work too) */
    OIDC_SCOPES?: string
    /** `supported` shows the app grid, anything else hides it */
    APP_GRID_AVAILABLE?: string
    /** Shown in Settings > Forwarding when set */
    FORWARD_WARNING_MESSAGE?: string
    /** `true` starts Sentry (with a DSN) */
    SENTRY_ENABLED?: boolean | string
    SENTRY_DSN?: string
    SENTRY_ENVIRONMENT?: string

    /** @deprecated use SERVER_URL */
    JMAP_SESSION_URL?: string
    /** @deprecated use WEB_OIDC_CLIENT_ID */
    SSO_CLIENT_ID?: string
    /** @deprecated use OIDC_SCOPES */
    SSO_SCOPE?: string

    /** Defaults to 'oidc' */
    AUTH_MODE?: AuthMode
    /** OIDC issuer URL; without it the issuer is found by WebFinger on SERVER_URL (tmail-flutter) */
    SSO_BASE_URL?: string
    /** Overrides the redirect URI built from DOMAIN_REDIRECT_URL (default `<origin>/callback`) */
    SSO_REDIRECT_URI?: string
    /** Overrides the post-logout URI built from DOMAIN_REDIRECT_URL (default `<origin>/`) */
    SSO_POST_LOGOUT_REDIRECT?: string

    DEBUG?: boolean | string
    /** Default UI language: en, fr, ru or vi */
    LANG?: string

    /** URI templates of the other Twake applications */
    CALENDAR_SPA_URL?: string
    CHAT_SPA_URL?: string
    WORKPLACE_FQDN_FALLBACK?: string

    /** Adapts the top bar inside an iframe of Twake Workplace */
    WORKPLACE_EMBEDDING?: boolean | string
    /** Same as WORKPLACE_EMBEDDING, as named by tmail-flutter */
    COZY_INTEGRATION?: boolean | string
    /** The Twake Drive picker of the composer (as Twake Calendar) */
    TDRIVE_ENABLED?: boolean | string
    /** URI template of the Drive (cozy-stack) of the user */
    TDRIVE_INTENT_URL?: string

    APP_VERSION?: string

    appList?: AppListEntry[]
  }
}
