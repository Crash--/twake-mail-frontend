// Runtime configuration of the app under test in OIDC mode (Dex), for the
// specs that need an ID token: the Twake Drive picker (DRIVE-*).
//   E2E_OIDC=1 E2E_APP_ENV=docker/app-env-oidc.js ./scripts/start.sh
// The specs of the basic mode do not run against it.
var SERVER_URL = window.location.origin
var AUTH_MODE = 'oidc'
var SSO_BASE_URL = window.location.origin + '/dex'
var WEB_OIDC_CLIENT_ID = 'twake-mail'
var OIDC_SCOPES = 'openid,profile,email,offline_access'
// The redirect URIs are <DOMAIN_REDIRECT_URL>/login-callback.html and
// /logout-callback.html, registered on the Dex client (docker/dex/config.yaml)
var DOMAIN_REDIRECT_URL = window.location.origin
var LANG = 'en'
// The fake Drive of the stack (docker/nginx/default.conf), on localhost: another
// origin than the app on 127.0.0.1
var TDRIVE_ENABLED = true
var TDRIVE_INTENT_URL = 'http://localhost:' + window.location.port + '/e2e/drive'
