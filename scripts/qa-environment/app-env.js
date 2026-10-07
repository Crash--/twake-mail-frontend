// Runtime configuration of the app in the QA environment, served as /.env.js by the nginx of
// the e2e stack (see e2e/docker/app-env.js for the e2e one).
//
// JMAP is reached on the origin of the app, through the same nginx.
var SERVER_URL = window.location.origin
var AUTH_MODE = 'basic'
var LANG = 'en'
var FORWARD_WARNING_MESSAGE = 'Forwarding outside example.com is not allowed.'
// Links to the other Twake apps lead nowhere: only their URL can be checked
var CALENDAR_SPA_URL = 'https://calendar.example.com'
var CHAT_SPA_URL = 'https://chat.example.com/#/chat/@{target}'
var WORKPLACE_FQDN_FALLBACK = '{localpart}.workplace.example.test'
