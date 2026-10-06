// Runtime configuration of the app under test (see public/.env.example.js).
// The stack's nginx serves this file as /.env.js (docker/nginx/default.conf),
// whatever .env.js the build contains.
//
// JMAP is reached on the origin of the app, through the same nginx: no CORS,
// and it follows E2E_PUBLIC_URL (http://127.0.0.1:18302 by default). The
// session is read from <SERVER_URL>/.well-known/jmap, as tmail-flutter does.
var SERVER_URL = window.location.origin
var AUTH_MODE = 'basic'
var LANG = 'en'
// Shown in Settings > Forwarding (SET-07)
var FORWARD_WARNING_MESSAGE = 'Forwarding outside example.com breaks the e2e charter.'
// "See in your Calendar" of the invitation cards (CAL-03)
var CALENDAR_SPA_URL = 'https://calendar.example.com'
// "Chat" of the contact card of an address (CRD-03); {target} is the local part of the address
var CHAT_SPA_URL = 'https://chat.example.com/#/chat/@{target}'
// Workplace of each user for the URI templates of docker/app-list.js (APPGRID-01)
var WORKPLACE_FQDN_FALLBACK = '{localpart}.workplace.example.test'
// Inside an iframe the top bar leaves the logotype and the app grid (APPGRID-02)
var WORKPLACE_EMBEDDING = true
// Error reporting (SET-10 to SET-13): configured, but nothing is sent until a user opts in.
// The ingest host does not exist: the specs answer it themselves (page.route), and the
// image of the app allows its origin (docker-compose.image.yaml, CSP_CONNECT_SRC)
var SENTRY_ENABLED = 'true'
var SENTRY_DSN = 'https://e2epublickey@sentry-stub.example.test/42'
var SENTRY_ENVIRONMENT = 'e2e'
// User feedback (SET-15): the button is offered only to a user who opted in
var SENTRY_FEEDBACK_ENABLED = 'true'
