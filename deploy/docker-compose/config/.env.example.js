// Runtime configuration of Twake Mail, mounted as /usr/share/nginx/html/.env.js.
// Every variable is documented in public/.env.example.js.
var JMAP_SESSION_URL = 'https://jmap.example.com/jmap/session'

var AUTH_MODE = 'oidc'
var SSO_BASE_URL = 'https://sso.example.com'
var SSO_CLIENT_ID = 'twake-mail'
var SSO_SCOPE = 'openid profile email offline_access'

var LANG = 'en'
var DEBUG = false
