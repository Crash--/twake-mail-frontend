# Twake Mail frontend

React webmail of [Twake Workplace](https://twake.app), the rewrite of the web
version of [tmail-flutter](https://github.com/linagora/tmail-flutter). It is a
standalone single-page application talking [JMAP](https://jmap.io) to
[tmail-backend](https://github.com/linagora/tmail-backend) (Apache James).

Status: phase 0. Sign-in (OIDC or basic), folder tree, email list and reading
work against tmail-backend, kept up to date by JMAP push, on top of
[jmap-client-ts](https://github.com/linagora/jmap-client-ts) v2. Composing,
search, actions on emails and settings come next.

## Stack

Rsbuild, React 18, TypeScript (strict), react-router 7,
[`@linagora/twake-mui`](https://github.com/linagora/twake-ui) and
`@linagora/twake-icons`, TanStack Query 5, `twake-i18n`, `openid-client` 6,
jmap-client-ts 2, DOMPurify, Sentry, Jest 30 + Testing
Library, Playwright. Contributors and AI agents: read
[AGENTS.md](AGENTS.md) first.

## Getting started

Requirements: Node 24 (`nvm use`) and npm.

```bash
npm ci
cp public/.env.example.js public/.env.js         # then edit it
cp public/appList.example.js public/appList.js   # optional: app grid
npm start                                        # http://localhost:5000
```

`HOST` and `PORT` change the address of the development server, e.g.
`HOST=127.0.0.1 PORT=18200 npm start`.

For a local backend without SSO, use the basic mode:

```js
// public/.env.js
var SERVER_URL = 'http://localhost'
var AUTH_MODE = 'basic'
```

The JMAP server must then allow the origin of the app in its CORS settings.

### Same origin through the development proxy

`JMAP_PROXY_TARGET` makes the development server proxy `/jmap` (WebSocket
included), `/upload`, `/download`, `/eventSource` and `/.well-known/jmap` to
a JMAP server. The URLs the JMAP session advertises are rewritten to the
origin of the development server, so the browser only talks to it: no CORS,
and the push WebSocket goes through the proxy too. For instance against the
backend of the end-to-end stack (`e2e/scripts/start.sh`, tmail-backend on
`127.0.0.1:18300`; accounts created through its WebAdmin, see
[`e2e/README.md`](e2e/README.md)):

```js
// public/.env.js
var SERVER_URL = window.location.origin
var AUTH_MODE = 'basic'
```

```bash
JMAP_PROXY_TARGET=http://127.0.0.1:18300 HOST=127.0.0.1 PORT=18200 npm start
```

## Configuration

The configuration is read at runtime, so one image serves every deployment:

- `.env.js`: settings, documented in
  [`public/.env.example.js`](public/.env.example.js) and
  [`upgrade-instructions/0.1.0.md`](upgrade-instructions/0.1.0.md), typed in
  `common/src/window.d.ts` and validated at startup by
  `common/src/config/config.ts`. An invalid configuration shows an explicit
  screen listing the problems.
- `appList.js`: the applications of the app grid
  ([example](public/appList.example.js)).
- `version.js`: the released version, written by the Docker build.

None of them is cached by nginx.

## Authentication

`AUTH_MODE` selects the mode:

- `oidc` (default): Authorization Code flow with PKCE (S256) through
  `openid-client`. The SSO comes back to `/callback`, then the user lands on
  the page first asked for. Tokens stay in memory: a reload goes through the
  SSO again, silently while the SSO session lasts. The access token is
  renewed with the refresh token one minute before it expires, and when the
  JMAP server answers 401; the user is sent back to the SSO only if that
  renewal fails. Logging out ends the session in every tab
  (BroadcastChannel `twake-mail-session`), then at the SSO (`id_token_hint`).
- `basic`: an email and password form (`/login`), checked by fetching the
  JMAP session with an HTTP Basic header. Meant for parity with tmail-flutter,
  local development and end-to-end tests. Credentials stay in memory.

## Scripts

| Script | Description |
|---|---|
| `npm start` | Development server |
| `npm run build` | Production build in `apps/private/dist` |
| `npm run serve` | Serve the production build on port 5000 |
| `npm test` | Unit tests (Jest, `dom` and `node` projects) |
| `npm run test:scripts` | Tests of the Node scripts (`node --test`) |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm run typecheck` | `tsc -b` on every workspace |
| `npm run import-flutter-arb` | Import translations from tmail-flutter, see [docs/i18n.md](docs/i18n.md) |
| `npm run copy-from-common` | Copy a `common` module into the app to override it (`@injected`) |

## Project structure

```
apps/private/        the application: entry point, routes, pages, Dockerfile
common/src/
  app/               query client, Sentry, top-level providers
  ds/                local design system (`@/ds/`): UI twake-mui lacks, no business logic
  components/        shared screens (loader, errors)
  config/            runtime configuration
  features/auth/     OIDC and basic authentication, login pages, route guard
  features/mailbox/  folder tree, default folder
  features/thread/   email list of a folder
  features/email/    reading view, keywords (read, starred)
  features/push/     JMAP push over WebSocket
  features/<name>/   one folder per feature, with its queries.ts
  i18n/ locales/     translations (en, fr, ru, vi)
  jmap/              JMAP client and session providers
  layout/            top bar, sidebar, app layout
  testing/           test helpers (renderWithProviders, fake JMAP server)
deploy/docker/       nginx configuration and entrypoint script of the image
deploy/docker-compose/ Docker Compose examples: the app alone, a demo with tmail-backend
deploy/helm/         Helm chart
docs/                deployment, twake-mui gaps, translations
scripts/             project scripts
upgrade-instructions/ configuration changes per release
e2e/                 end-to-end tests, separate npm package (not a workspace)
```

## Docker

```bash
docker build -f apps/private/Dockerfile --build-arg BUILD_VERSION=0.1.0 -t twake-mail-frontend .
docker run -p 127.0.0.1:8080:80 --read-only --tmpfs /tmp \
  -v $PWD/my.env.js:/usr/share/nginx/html/.env.js:ro \
  -v $PWD/my.appList.js:/usr/share/nginx/html/appList.js:ro \
  twake-mail-frontend
```

The image builds the app itself (Node 24) and serves it with an unprivileged
nginx on port 80 (`LISTEN_PORT`; user 101, read-only root filesystem supported, health
endpoint `/healthz`). It sends security headers, a Content-Security-Policy
included, configured by environment variables; the origins of the JMAP server
and of the SSO are derived from the configuration (more in `CSP_CONNECT_SRC`). nginx
caches hashed assets for a year (not when `DEBUG = true`) and masks OIDC
codes, states, tokens and tickets in its access log.

Everything about deploying (image, variables, CSP, reverse proxy, iframe
embedding in Twake Workplace, Docker Compose, Helm) is in
[`docs/deployment.md`](docs/deployment.md). To try it out with a demo
backend: `cd deploy/docker-compose/demo && docker compose up -d --build`, then
<http://localhost:8080> as `alice@example.com` / `alice`.

## Error reporting

Set `SENTRY_ENABLED = true` and `SENTRY_DSN` in `.env.js` to report errors; events are scrubbed of query
strings, tokens and email addresses before leaving the browser. To upload
source maps at build time, set `SENTRY_URL`, `SENTRY_AUTH_TOKEN`,
`SENTRY_ORG` and `SENTRY_PROJECT`: the maps are uploaded, then deleted from
the build output.

## JMAP

The app talks JMAP through
[jmap-client-ts](https://github.com/linagora/jmap-client-ts) v2, installed
from `github:Crash--/jmap-client-ts#v2` until it is published: npm builds it
with its `prepare` script, approved for the locked commit in the
`allowScripts` field of `package.json`. After moving the dependency to a new
commit (`npm install jmap-client-ts@github:Crash--/jmap-client-ts#v2 -w
@mail/common`), approve it again with `npm approve-scripts jmap-client-ts`.

One client is created per sign-in (`common/src/jmap/JmapClientProvider.tsx`),
authenticated by the auth service (`makeJmapAuth.ts`: Bearer or Basic header,
token renewal on 401). The JMAP session is loaded before the mail screens
(`JmapSessionProvider.tsx`).

## Mail features

- **Folders** (`Mailbox/get`): nested under their parent, system folders
  first in the order of tmail-flutter (inbox, drafts, outbox, sent, trash,
  spam, templates, archive), then `sortOrder`, then name; translated names
  for system folders, unread counters, collapsible levels. The app opens on
  the inbox.
- **Email list**: one JMAP request per page (`Email/query` sorted by
  `receivedAt`, then `Email/get` of its ids by back-reference), loaded as
  the end of the list comes into view; unread and starred state, star
  toggle, mark as read or unread on hover. The list is the `VirtualizedTable`
  of twake-mui, as in Twake Contacts, through the `VirtualizedListTable` of
  the local design system (`common/src/ds/`), which adds what a message list
  needs (see [docs/twake-mui-gaps.md](docs/twake-mui-gaps.md)): each row is
  a real link (middle click, keyboard), arrow keys move between rows, column
  headers exist for screen readers only, and new emails are announced.
- **Reading**: as tmail-flutter on desktop, the email replaces the list.
  The HTML body is sanitized with DOMPurify, then shown in an iframe
  sandboxed without `allow-scripts` and under a Content Security Policy
  forbidding scripts; links open in a new tab (`noopener`). Inline `cid:`
  images and attachments are downloaded with the session credentials. An
  unread email is marked read when opened, the counters and the list being
  updated before the server answers.
- **Push**: a JMAP WebSocket (with the Linagora ticket when the server
  offers it) refetches the folders and emails the server says changed, and
  everything when the connection (re)opens.

## Known issues

- `twake-i18n` imports every `date-fns` 2 locale and the whole of lodash,
  which makes the largest chunk of the bundle (about 170 kB gzipped).
- The app is designed for desktop first; small screens come later.
- Push refetches the whole folder list and every loaded page of the email
  lists: with 2 000 emails loaded, one new email costs 69 requests and 6 s
  before it shows ([docs/perf/phase0.md](docs/perf/phase0.md)). Incremental
  updates (`Mailbox/changes`, `Email/changes`; James has no
  `Email/queryChanges`) come next.
- Team and shared mailboxes are not listed yet (`Mailbox/get` without the
  James `shares` capability).
- Remote images of an email are loaded as soon as it is opened.

## License

[AGPL-3.0](LICENSE), as tmail-flutter.
