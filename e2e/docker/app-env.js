// Runtime configuration of the app under test (see public/.env.example.js).
// The stack's nginx serves this file as /.env.js (docker/nginx/default.conf),
// whatever .env.js the build contains.
//
// JMAP is reached on the origin of the app, through the same nginx: no CORS,
// and it follows E2E_PUBLIC_URL (http://127.0.0.1:18302 by default).
var JMAP_SESSION_URL = window.location.origin + '/jmap/session'
var AUTH_MODE = 'basic'
var LANG = 'en'
// Shown in Settings > Forwarding (SET-07)
var FORWARD_WARNING_MESSAGE = 'Forwarding outside example.com breaks the e2e charter.'
// "See in your Calendar" of the invitation cards (CAL-03)
var CALENDAR_SPA_URL = 'https://calendar.example.com'
