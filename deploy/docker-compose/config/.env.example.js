// Runtime configuration of Twake Mail, mounted as /usr/share/nginx/html/.env.js.
// Every variable is documented in public/.env.example.js.
var SERVER_URL = 'https://jmap.example.com'

var AUTH_MODE = 'oidc'
var SSO_BASE_URL = 'https://sso.example.com'
var WEB_OIDC_CLIENT_ID = 'twake-mail'
var OIDC_SCOPES = 'openid,profile,email,offline_access'
var DOMAIN_REDIRECT_URL = 'https://mail.example.com'

var LANG = 'en'
var DEBUG = false
