# Error reporting (Sentry)

Twake Mail reports its errors to a Sentry the operator runs, **only when the
deployment configures it and the user consented**, as tmail-flutter does on
the web. This page is the contract: what starts it, what is sent, what is
never sent, and the test that proves each point.

## Rules that do not bend

| Rule | Where | Test |
|---|---|---|
| No Sentry unless configured **and** consented. Before that the SDK is not initialised: no client, no queue, no network call | `common/src/app/sentry.ts` (`SentryLifecycle`), `index.tsx` no longer starts it | `sentry.spec.ts` "has no client...", e2e `SET-10` |
| The consent of each user is stored with their account (JMAP `Settings`, `sentry.user-opt-in`), never in the browser, never global | `useSentryReporting.ts` | `SentryReportingSync.spec.tsx`, e2e `SET-11` |
| Unknown means off: settings not read yet, ecosystem not answered yet, server without the `settings` capability or with the key read-only | `useSentryReporting.ts` | `SentryReportingSync.spec.tsx` |
| The preference starts and stops the reports at once, without reloading | `SentryReportingSync.tsx` | `sentry.spec.ts`, e2e `SET-10` |
| Withdrawing the consent closes the gate first, so whatever has not been through `beforeSend` is dropped; events already handed to the transport get 100 ms to leave when the client closes | `SentryLifecycle.apply` | `sentry.spec.ts` "stops allowing at once" |
| Signing out (or another tab signing out, or changing account) stops the reports, clears the user and the breadcrumbs, closes the client | `AuthProvider.tsx`, `SentryReportingSync.tsx` | `SentryReportingSync.spec.tsx`, e2e `SET-11` |
| No default PII (`dataCollection.userInfo: false`, the replacement of `sendDefaultPii` in the SDK v11), no cookies, headers, request bodies nor query parameters collected | `sentry.ts` options | `sentry.spec.ts` |
| No session replay, no profiling, no tracing, no logs, no release health sessions: none of their integrations is added and no sample rate is set | `sentry.ts` options | `sentry.spec.ts` "only sends error events", e2e `SET-10` |
| The user feedback widget (ADR 011) is added only when the deployment sets `SENTRY_FEEDBACK_ENABLED=true` **and** the user opted in, so it follows the same gate as the errors. It is the synchronous integration, bundled with the app: nothing loads from Sentry's CDN, no worker, no change to `script-src`, `worker-src` or `img-src`. The button is the shared one of `@linagora/twake-feedback` (the integration comes from its `makeFeedbackIntegration`, the form is plugged on the button with `attachFeedback`), mounted by the standalone webmail shell only: never in the facade of a team mailbox, never inside Twake Workplace | `sentry.ts` (`makeFeedbackIntegration`, `attachFeedback`), `FeedbackWidget.tsx`, `AppLayout.tsx` | `sentry.feedback.spec.tsx`, `FeedbackWidget.spec.tsx`, e2e `SET-15`, `smoke-test.sh` (no `worker-src`) |
| The SDK never gives a feedback to `beforeSend`: a gate of its own (`TwakeFeedbackGate`) drops it when the reporting is not allowed and rebuilds it with `scrubFeedbackEvent` | `sentry.ts`, `sentryEvents.ts` | `sentry.feedback.spec.tsx` |
| Every event and breadcrumb is rebuilt, not filtered: only known fields leave | `common/src/app/sentryEvents.ts` | `sentry.spec.ts`, `scrubSensitiveData.spec.ts`, e2e `SET-10` |
| The user is a pseudonym of the account (first 16 hex digits of the SHA-256 of the JMAP account id): never the address, name nor login, and not reversible without a candidate list of accounts | `sentryUserId.ts` | `SentryReportingSync.spec.tsx`, e2e `SET-10` |
| Source maps are never served | Dockerfile, `nginx.conf`, `common/sentryBuildUtils.ts` | `smoke-test.sh` |
| The ingest origin is added to the CSP `connect-src` only from the configured DSN, only when enabled | `40-twake-mail-runtime.sh` | `smoke-test.sh`, Helm `_helpers.tpl` |

## Where the configuration comes from

`SENTRY_FEEDBACK_ENABLED` (off by default) is not one of the keys below: it
does not choose the source, and applies to the DSN of the environment as well
as to the one of the ecosystem. It only offers the feedback widget; it starts
nothing by itself.

As tmail-flutter on the web (its ADR 0110):

1. **The environment** (`.env.js` or the `env.file`) as soon as one of
   `SENTRY_ENABLED`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT` is filled, even to turn
   it off. It starts with `SENTRY_ENABLED=true` and a DSN (`SENTRY_ENVIRONMENT`
   names the environment of the events). An off or incomplete environment
   configuration never falls back to the ecosystem.
2. **The Linagora ecosystem of the server** when the three keys are absent or
   blank: the `sentry` section of
   `<SERVER_URL>/.well-known/linagora-ecosystem` (the same URL as
   tmail-flutter, `SERVER_URL` joined with the path):

   ```json
   { "sentry": { "enabled": true, "dsn": "https://key@sentry.example.com/1",
                 "environment": "production", "userOptInByDefault": false } }
   ```

   It is used only with `enabled` true, a DSN and a non blank environment. The
   DSN must be `https` with a public key and a numeric project (the one of the
   environment is the operator's and not checked). Booleans may be written as
   strings (`"true"`), anything else is unknown.

The document is read once the user is signed in, **without credentials**
(`credentials: 'omit'`, no referrer, no `Authorization`), with a 5 s timeout,
refused above 64 kB, and any failure counts as "no section".

`userOptInByDefault` is the starting position of each user's toggle, not a
master switch. Missing means `false`.

## Consent: where it lives and what the default is

- Stored in the JMAP `Settings` of the account (`sentry.user-opt-in`, `"true"`
  or `"false"`), the same place and key as tmail-flutter, so the choice follows
  the user from one device and one app to the other.
- Effective consent = the stored choice, else `userOptInByDefault` of the
  ecosystem, else off.
- Settings > Preferences > "Error reporting" shows the switch when a valid
  configuration exists and the server keeps the setting. The wording is
  tmail-flutter's (`errorReporting`, `errorReportingSettingExplanation`,
  `errorReportingToggleDescription`); tmail-flutter has no French, Russian nor
  Vietnamese translation of these strings, they are translated here.
- Switching it starts or stops the SDK at once (`Sentry.init` / `Sentry.close`):
  the app is not reloaded. A fast on/off/on is serialised and only the last
  wish counts.

## What is sent

An event is made of: the release (`APP_VERSION`), the environment, the
message or the exceptions (type, scrubbed value cut at 300 characters, handled
flag, stack frames with the file name, function, line and column, and no source
lines nor local variables), the URL of the page without query string, fragment
nor identifiers, the browser and language contexts the SDK adds, the
pseudonymous user id, the tag `app=twake-mail` (the DSN may be shared with
other apps), and up to 30 scrubbed breadcrumbs. Nothing else.

Breadcrumbs are limited to the requests (`fetch`, `xhr`: method, status, URL
scrubbed) and the navigation. Console breadcrumbs and interaction ones (clicks,
inputs, which carry the accessible name of the element, e.g. a message row with
its sender and subject) are dropped.

`console.error(...)` is reported (the equivalent of `logError` in
tmail-flutter), `console.warn`, `info` and `log` are not. Only the message
string is kept: the other arguments, where the JMAP objects land, are dropped
before anything else is looked at.

## User feedback

With `SENTRY_FEEDBACK_ENABLED` on and the user opted in, a "Something
wrong?" button ("Un problème ?" in French: an icon and its label) floats at
the bottom of the webmail, on the right by default
(above the compose button on phones and tablets, under dialogs and panels). It
is the shared button of `@linagora/twake-feedback`: it can be dragged, it
snaps to the left or right edge, and its position is kept per browser (local
storage key `twake-feedback:twake-mail`, nothing is sent). Without a pointer,
`Shift+F10` (or the context menu key) opens a menu to move it to the left or
to the right, or to reset it. Its form has a message, an optional email
(empty, never pre-filled: the app puts no address nor name on its events),
and, where the browser can share a tab, a screenshot with a highlight tool
and a hide tool that masks a part of the page before it is sent. Every text of
the form comes from the package, in the language of the app (en, fr, de, es,
it, ru and vi; English otherwise), and the form follows the colour scheme of
the app.

The shell mounts the button (`FeedbackWidget`) only while the lifecycle says
the feedback is running; `SentryLifecycle` creates the integration at each
start, hands the form to the button (`attachFeedback`) and forgets it at each
stop, when it also removes the host of the form from the page.

What is sent for a feedback: what the user typed (the message, and the email
when they gave one), as typed; the screenshot they chose to attach (the
browser asks which tab to share, and it can show mail: the "Error reporting"
setting promises what the *reports* never hold, the screenshot is the user's
own choice); the release,
the environment, the tag `app`, the pseudonymous user id, the browser and
system contexts, the URL of the page without query string, fragment nor
identifiers, and the scrubbed breadcrumbs. HTTP headers and `extra` data are
left out. Sending the form is the consent for that feedback: the opt-in is
still what makes the button exist.

The feedback event does not go through `beforeSend` (the SDK only gives it
errors), so the scrubbing of the errors does not apply to it: the message and
the email must stay readable, and `scrubFeedbackEvent` rebuilds the rest of
the event instead. A feedback cannot be related to the errors of an embedded
app: the apps shown inside TwakeSpace have no button of their own.

The SDK does not remove the host of the widget when it is closed: the
lifecycle does it, so a new opt-in does not add a second button.

## What is scrubbed

Everything goes through `common/src/utils/scrubSensitiveData.ts` (strings and
keys) and `common/src/app/sentryEvents.ts` (the shape of events).

- **Credentials**: `Authorization`, `Cookie` and `Set-Cookie` are never part of
  an event; `Bearer`/`Basic` values, JWTs, and the parameters `code`, `state`,
  `session_state`, `ticket`, `access_token`, `id_token`, `refresh_token`,
  `code_verifier`, `login_hint`, `password`, `email` in any text; the keys
  `token`, `accessToken`, `refresh_token`, `code`, `state`, `secret`... in any
  object.
- **Mail content**: the keys `subject`, `preview`, `textBody`, `htmlBody`,
  `bodyValues`, `body`, `text`, `from`, `to`, `cc`, `bcc`, `replyTo`, `sender`,
  `attachments`, `search`, `query`, `q` are replaced by `[Filtered]` whatever
  they hold; the `name` of anything that has a `blobId` (an attachment) too.
- **People**: email addresses (also percent encoded) in any text become
  `[email]`; the `email`, `username`, `displayName` keys are replaced; request
  headers, cookies, bodies and query strings of the SDK request data are
  dropped, only the URL and method stay.
- **Identifiers in URLs**: `/mailbox/<id>`, `/label/<id>`, `/email/<id>` become
  `:id`, everything after `/download/` and `/upload/` (account, blob, file
  name) is replaced, query strings and fragments are cut, also inside the URLs
  quoted in a message. The JMAP ids (`accountId`, `blobId`, `emailId`,
  `threadId`, `mailboxIds`) are replaced as keys. Flutter keeps query strings
  and ids (its ADR 0077); the React app is stricter.
- **JMAP client errors** (`JmapMethodError`, `JmapRequestError`...): only what
  comes before the first `": "` of the message is kept (`Email/get (c0) failed
  with invalidArguments`), the description the server adds can quote a subject
  or a folder name.

Residual risk: free text written by a call site in a `console.error` message
is only scrubbed for credentials and addresses. Do not put user text in these
messages. Ask the Sentry project to prevent storing IP addresses and enable
its server side data scrubbing as a second line.

## What is not reported

As tmail-flutter (ADR 0076: expected network errors are warnings, 401 is
handled by the refresh flow), and checked in `beforeSend`
(`isExpectedError`, on the captured error and on the arguments of the
`console.error` call):

- aborted requests (`AbortError`) and network failures (`TypeError: Failed to
  fetch`, `NetworkError`, `Load failed`, `Network request failed`);
- the errors of the JMAP client that carry an HTTP status of 400 or more
  (`JmapHttpError`, `JmapRequestError`): a 401 has been through
  `onUnauthorized` (the token refresh) already, the other statuses are the
  server's answer;
- the refresh failures and other auth messages of `oidcAuth.ts`: they are
  `console.warn`, which is not reported;
- errors raised by browser extensions (`chrome-extension://`...).

## Source maps

They are generated only when `SENTRY_URL`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`
and `SENTRY_PROJECT` are given to the build (not at all otherwise), uploaded,
and deleted from the build output by the plugin. The Dockerfile deletes any
`*.map` left, and nginx answers 404 to `*.map` requests anyway.

## Content-Security-Policy

`connect-src` carries the ingest origin of `SENTRY_DSN` only when
`SENTRY_ENABLED` is true (or missing with a DSN, the deprecated form), added
by `40-twake-mail-runtime.sh` (Docker) or `csp.autoConnectSrc` (Helm). The
DSN of an ecosystem configuration is not known at deploy time: add its
origin to `CSP_CONNECT_SRC`, else the browser blocks the reports (and nothing
is sent).

## Deviations from tmail-flutter, on purpose

| tmail-flutter | Twake Mail | Why |
|---|---|---|
| A valid environment configuration starts the SDK at once on the web (`isReportingAllowed: isWeb`), startup events are reported before the consent is known | Nothing starts before the consent of the signed-in user | Non negotiable: nothing sent before consent. The cost: errors before the sign-in and the settings are not reported |
| `SentryUser` with the account id, name, username and email | Pseudonymous id only | Privacy |
| Query strings and ids kept in URLs and `app.url` | Dropped | Privacy |
| Traces sampled at 10 %, profiling 10 %, logs on | None | Privacy. Flutter's own web fallback has no tracing either (ADR 0110) |
| Warnings reported? No. Errors: yes | Same, but console arguments are dropped | The arguments hold JMAP objects |
| Environment configuration needs a non blank environment | A DSN is enough | Existing deployments; the environment only labels events |
| Consent unknown or ecosystem unreachable: the default (off), an explicit opt-in is honoured | Same. If the server keeps no settings (no `com:linagora:params:jmap:settings`) the toggle is hidden and nothing is sent, even with `userOptInByDefault` | An opt-out the user cannot reach is no consent |
| `sendDefaultPii: false` | `dataCollection.userInfo: false` | `sendDefaultPii` does not exist in the SDK v11 |
| No feedback widget | An optional one, off by default (`SENTRY_FEEDBACK_ENABLED`) | ADR 011: feedback from the people who use the new frontends, in the Sentry the team already reads |

## For the operator

1. Create a Sentry project with "Prevent storing of IP addresses" and the
   server side scrubbing on. Nothing here creates one.
2. Either set `SENTRY_ENABLED=true`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT` in
   `.env.js` (Helm: `config.sentry.*`), or serve the `sentry` section in the
   ecosystem and add the ingest origin to `CSP_CONNECT_SRC`.
3. Decide `userOptInByDefault` (off unless users must opt out).
4. Serve the app over HTTPS: the pseudonym uses Web Crypto, which browsers
   only offer on secure origins (and `localhost`); elsewhere the reporting never
   starts.
5. Optional: the user feedback widget. Needs a Sentry 24.4.2 or later
   (feature-complete mode for screenshots). Set `SENTRY_FEEDBACK_ENABLED=true`
   (Helm: `config.sentry.feedbackEnabled`). Nothing else changes in the
   policy: `connect-src` already carries the ingest origin, and the widget
   needs no worker, no CDN and no other source. The Sentry project holds
   screenshots, which can show mail and names: set its retention
   accordingly.
6. Optional: source maps (`SENTRY_URL`, `SENTRY_ORG`, `SENTRY_PROJECT` build
   arguments and the `sentry_auth_token` build secret).
