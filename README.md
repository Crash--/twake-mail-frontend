# Twake Mail frontend

React webmail of [Twake Workplace](https://twake.app), the rewrite of the web
version of [tmail-flutter](https://github.com/linagora/tmail-flutter). It is a
standalone single-page application talking [JMAP](https://jmap.io) to
[tmail-backend](https://github.com/linagora/tmail-backend) (Apache James).

Status: skeleton. Authentication, configuration, layout and tooling are in
place; mail features come next, on top of
[jmap-client-ts](https://github.com/linagora/jmap-client-ts) v2.

## Stack

Rsbuild, React 18, TypeScript (strict), react-router 7,
[`@linagora/twake-mui`](https://github.com/linagora/twake-ui) and
`@linagora/twake-icons`, TanStack Query 5, `twake-i18n`, `openid-client` 6,
Sentry, Jest 30 + Testing Library. Contributors and AI agents: read
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
var JMAP_SESSION_URL = 'http://localhost/jmap/session'
var AUTH_MODE = 'basic'
```

The JMAP server must allow the origin of the app in its CORS settings.

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
  components/        shared screens (loader, errors)
  config/            runtime configuration
  features/auth/     OIDC and basic authentication, login pages, route guard
  features/<name>/   one folder per feature, with its queries.ts
  i18n/ locales/     translations (en, fr, ru, vi)
  jmap/              JMAP client provider (contract of jmap-client-ts v2)
  layout/            top bar, sidebar, app layout
  testing/           test helpers (renderWithProviders, fakes)
docs/                twake-mui gaps, translations
scripts/             project scripts
upgrade-instructions/ configuration changes per release
e2e/                 end-to-end tests, separate npm package (not a workspace)
```

## Docker

```bash
npm ci && npm run build
docker build -f apps/private/Dockerfile --build-arg BUILD_VERSION=0.1.0 -t twake-mail-frontend .
docker run -p 8080:80 \
  -v $PWD/my.env.js:/usr/share/nginx/html/.env.js:ro \
  -v $PWD/my.appList.js:/usr/share/nginx/html/appList.js:ro \
  twake-mail-frontend
```

nginx serves the SPA with long-lived caching for hashed assets (disabled when
`DEBUG = true`) and masks OIDC codes, states, tokens and tickets in its access
log.

## Error reporting

Set `SENTRY_DSN` in `.env.js` to report errors; events are scrubbed of query
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

## Known issues

- `twake-i18n` imports every `date-fns` 2 locale and the whole of lodash,
  which makes the largest chunk of the bundle (about 170 kB gzipped).
- The app is designed for desktop first; small screens come later.

## License

[AGPL-3.0](LICENSE), as tmail-flutter.
