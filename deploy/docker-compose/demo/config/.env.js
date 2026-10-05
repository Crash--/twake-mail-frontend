// Runtime configuration of the demo (public/.env.example.js documents every variable).
// JMAP is reached on the origin of the app, through the proxy of docker-compose.yaml.
var JMAP_SESSION_URL = window.location.origin + '/jmap/session'
var AUTH_MODE = 'basic'
var LANG = 'en'
var DEBUG = false
