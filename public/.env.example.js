// Runtime configuration of Twake Mail.
// Copy this file to `public/.env.js` (development) or mount it as
// `/usr/share/nginx/html/.env.js` (Docker image), then adapt the values.
// The values are typed in `common/src/window.d.ts` and validated at startup
// by `common/src/config/config.ts`.

// The keys marked [tmail-flutter] have the name and the value format of the
// `env.file` of tmail-flutter: the same deployment configuration works for
// both apps (the image also reads an `env.file`, see docs/deployment.md).
// Values of an `env.file` are strings ('true', not true): both work here.

// [tmail-flutter] Base URL of the JMAP server, e.g. tmail-backend. The JMAP
// session is read from `<SERVER_URL>/.well-known/jmap` (RFC 8620).
var SERVER_URL = 'https://jmap.example.com'

// How the user signs in: 'oidc' or 'basic'. Not in tmail-flutter. Unset, the
// app looks for an OIDC provider with WebFinger on SERVER_URL and falls back
// to the form, as tmail-flutter does.
// - oidc: Authorization Code + PKCE against SSO_BASE_URL (else found by
//   WebFinger; no form then).
// - basic: email + password form, sent as HTTP Basic to the JMAP server.
var AUTH_MODE = 'oidc'

// OpenID Connect settings.
// Issuer URL, where `/.well-known/openid-configuration` is served. Not in
// tmail-flutter, which finds it with WebFinger on SERVER_URL as this app does
// when it is not set.
var SSO_BASE_URL = 'https://sso.example.com'
// [tmail-flutter] Public client of the app.
var WEB_OIDC_CLIENT_ID = 'twake-mail'
// [tmail-flutter] Scopes separated by commas (spaces work too). Ask for
// `offline_access` to get a refresh token: without it the session ends when
// the access token expires and the user goes back to the SSO.
var OIDC_SCOPES = 'openid,profile,email,offline_access'
// [tmail-flutter] URL of the app. The redirect URIs to register on the SSO
// client are `<DOMAIN_REDIRECT_URL>/login-callback.html` and the post-logout
// `<DOMAIN_REDIRECT_URL>/logout-callback.html`. Without it: `<origin>/callback`
// and `<origin>/`.
var DOMAIN_REDIRECT_URL = 'https://mail.example.com'
// Optional. Replace the redirect URIs built from DOMAIN_REDIRECT_URL.
// var SSO_REDIRECT_URI = 'https://mail.example.com/callback'
// var SSO_POST_LOGOUT_REDIRECT = 'https://mail.example.com/'

// Error reporting. [tmail-flutter] SENTRY_ENABLED=true with a DSN starts
// Sentry; SENTRY_ENVIRONMENT names the environment of the events. There is no
// reporting preference: a configured Sentry reports.
var SENTRY_ENABLED = 'false'
var SENTRY_DSN = ''
var SENTRY_ENVIRONMENT = ''

// [tmail-flutter] 'supported' shows the app grid (the apps of appList.js),
// anything else hides it.
var APP_GRID_AVAILABLE = 'supported'

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

// Optional. TwakeSpace, whose Mail tab frames the facade of a team mailbox
// (/embed/team-mailboxes/<id>): the facade sends its navigation and
// "sign in again" to it through cozy-external-bridge. Allow it in
// CSP_FRAME_ANCESTORS too.
// var TWAKE_SPACE_URL = 'https://space.example.com'

// Optional. Used by the URI templates when the SSO does not expose the
// workplace FQDN of the user. Supports {localpart}.
var WORKPLACE_FQDN_FALLBACK = '{localpart}.twake.example.com'

// [tmail-flutter] Optional. Shown in Settings > Forwarding, e.g. the rules of
// your organisation on forwarding emails outside.
var FORWARD_WARNING_MESSAGE = ''

// Inside an iframe of Twake Workplace, leave the logotype and the app grid to
// the container (the account button becomes a gear), as Twake Calendar does.
// Has no effect outside an iframe. The Workplace must be allowed to frame the
// app: do not send `X-Frame-Options`, nor a `frame-ancestors` that leaves out
// its origin.
var WORKPLACE_EMBEDDING = false

// Twake Drive picker of the composer ("Attach from Drive"), as Twake Calendar:
// add files as a link (a card in the message) or as attachments. Needs the
// OIDC mode: the ID token of the user is traded for a Drive token
// (`POST <Drive>/auth/token_exchange`), which the cozy-stack of the Drive must
// allow for this OIDC client and this origin. TDRIVE_INTENT_URL is the address
// of the Drive (cozy-stack) of the user, a URI template: {localpart},
// {workplaceFqdn}, {workplaceFqdn.localpart}, {workplaceFqdn.domain}.
var TDRIVE_ENABLED = false
var TDRIVE_INTENT_URL = 'https://{workplaceFqdn}'

// Keys of tmail-flutter that this app ignores: FCM_AVAILABLE, IOS_FCM,
// FIREBASE_* (push notifications of the mobile apps), PLATFORM, WS_ECHO_PING,
// COZY_INTEGRATION, COZY_EXTERNAL_BRIDGE_VERSION, FORCE_EMAIL_QUERY.
//
// Former names, still read with a warning in the console: JMAP_SESSION_URL
// (use SERVER_URL), SSO_CLIENT_ID (WEB_OIDC_CLIENT_ID), SSO_SCOPE (OIDC_SCOPES).
