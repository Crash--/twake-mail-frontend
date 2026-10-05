// Runtime configuration of Twake Mail.
// Copy this file to `public/.env.js` (development) or mount it as
// `/usr/share/nginx/html/.env.js` (Docker image), then adapt the values.
// The values are typed in `common/src/window.d.ts` and validated at startup
// by `common/src/config/config.ts`.

// URL of the JMAP session resource (RFC 8620), e.g. tmail-backend.
var JMAP_SESSION_URL = 'https://jmap.example.com/jmap/session'

// How the user signs in: 'oidc' (default) or 'basic'.
// - oidc: Authorization Code + PKCE against SSO_BASE_URL.
// - basic: email + password form, sent as HTTP Basic to the JMAP server.
var AUTH_MODE = 'oidc'

// OpenID Connect settings, required when AUTH_MODE is 'oidc'.
// Ask for `offline_access` to get a refresh token: without it the session
// ends when the access token expires and the user goes back to the SSO.
var SSO_BASE_URL = 'https://sso.example.com'
var SSO_CLIENT_ID = 'twake-mail'
var SSO_SCOPE = 'openid profile email offline_access'
// Defaults to `<origin>/callback`.
var SSO_REDIRECT_URI = 'https://mail.example.com/callback'
// Defaults to `<origin>/`.
var SSO_POST_LOGOUT_REDIRECT = 'https://mail.example.com/'

// Error reporting, disabled when empty.
var SENTRY_DSN = ''

// Enables the TanStack Query devtools and disables nginx caching.
var DEBUG = false

// Default UI language when the user has not chosen one: en, fr, ru or vi.
var LANG = 'en'

// URLs of the other Twake applications, as RFC 6570-style URI templates.
// Supported expressions: {localpart}, {workplaceFqdn},
// {workplaceFqdn.localpart}, {workplaceFqdn.domain}.
// CALENDAR_SPA_URL: "See in your Calendar" of an invitation opens
// <CALENDAR_SPA_URL>/events/<uid> (the route of Twake Calendar).
var CALENDAR_SPA_URL = 'https://calendar.example.com'
var CHAT_SPA_URL =
  'https://{workplaceFqdn.localpart}-chat.{workplaceFqdn.domain}/#/bridge/web/#/chat/@{target}:{workplaceFqdn.domain}'

// Optional. Used by the URI templates when the SSO does not expose the
// workplace FQDN of the user. Supports {localpart}.
var WORKPLACE_FQDN_FALLBACK = '{localpart}.twake.example.com'

// Optional. Shown in Settings > Forwarding, e.g. the rules of your
// organisation on forwarding emails outside.
var FORWARD_WARNING_MESSAGE = ''

// Inside an iframe of Twake Workplace, leave the logotype and the app grid to
// the container (the account button becomes a gear), as Twake Calendar does.
// Has no effect outside an iframe. The Workplace must be allowed to frame the
// app: do not send `X-Frame-Options`, nor a `frame-ancestors` that leaves out
// its origin.
var WORKPLACE_EMBEDDING = false
