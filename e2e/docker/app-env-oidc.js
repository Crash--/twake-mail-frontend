// Runtime configuration of the app under test in OIDC mode (Dex), for the
// specs that need an ID token: the Twake Drive picker (DRIVE-*), on the Workplace.
//   E2E_OIDC=1 E2E_APP_ENV=docker/app-env-oidc.js ./scripts/start.sh
// The specs of the basic mode do not run against it.
var SERVER_URL = window.location.origin
var AUTH_MODE = 'oidc'
// Dex over HTTPS on its own port (docker/nginx/sso.conf): start.sh writes its origin
var SSO_BASE_URL = '@SSO_URL@/dex'
var WEB_OIDC_CLIENT_ID = 'twake-mail'
var OIDC_SCOPES = 'openid,profile,email,offline_access'
// The redirect URIs are <DOMAIN_REDIRECT_URL>/login-callback.html and
// /logout-callback.html, registered on the Dex client (docker/dex/config.yaml)
var DOMAIN_REDIRECT_URL = window.location.origin
var LANG = 'en'
// The fake Twake Workplace of the stack (docker/nginx/sso.conf), next to Dex: Dex
// sends no workplaceFqdn claim
var WORKPLACE_FQDN_FALLBACK = '@SSO_URL@'
var TDRIVE_ENABLED = true
