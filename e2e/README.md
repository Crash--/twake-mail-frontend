# Twake Mail web — end to end tests

A real browser driving the real React app against a real tmail-backend. No mock, no stub.
TypeScript + [Playwright](https://playwright.dev/), in a standalone npm package: `e2e/` has its
own `package.json` and lockfile and is not one of the app workspaces.

The backlog of scenarios to write is [`e2e.md`](e2e.md): one line per Patrol integration test
of tmail-flutter, with a stable identifier.

---

## Running it

Node 24 (`nvm use`), Docker with compose v2.

```bash
cd e2e
npm ci
npx playwright install chromium        # once; skipped if ~/.cache/ms-playwright has it

./scripts/start.sh                     # backend + placeholder page, ~30 s
npx playwright test                    # whole suite
./scripts/stop.sh                      # removes containers, network and volumes
```

To test the app, build it and hand its bundle to the stack:

```bash
npm run build                          # at the repo root: apps/private/dist
E2E_APP_DIR=../apps/private/dist ./scripts/start.sh
```

Or test the production Docker image of the app (its nginx, cache policy and security headers),
as the CI does:

```bash
docker build -f apps/private/Dockerfile -t twake-mail-frontend:e2e .   # at the repo root
E2E_APP_IMAGE=twake-mail-frontend:e2e ./scripts/start.sh
```

The image runs as in production (user 101, read-only root filesystem, `/tmp` tmpfs) behind
the stack's nginx, which still serves `/.env.js` and `/appList.js`. Every test fails on a
violation of the Content-Security-Policy of the app logged in the browser console
(`support/fixtures.ts`); the stricter policy of the email body frames is not checked, blocking
remote content there is expected.

Run a subset:

```bash
npx playwright test tests/infra.spec.ts     # the harness smoke tests, no UI
npx playwright test -g MBX-05               # one backlog entry
npx playwright test --project mobile        # the phone screen (390 × 844); also tablet, chromium
npx playwright test --ui                    # watch mode, time travel
npx playwright show-report                  # last HTML report
npx playwright show-trace test-results/artifacts/<test>/trace.zip
```

### Screen sizes

Three Playwright projects, all in Chromium: `chromium` (a desktop, the whole suite), `mobile`
(390 × 844, touch) and `tablet` (820 × 1180, touch). The last two replay the main path
(`LOGIN-01`, `MBX-05`, `EML-01`, `A11Y-01`), the `RESP` specs and the search on a small screen (`SRCH-01`, `SRCH-03`, `SRCH-13`) only (`grep` in
`playwright.config.ts`). Below 1200 px the folders are in a drawer: `MailboxPage` opens it when a
method needs the tree (`showFolders`, `openFolder`, `expectFolderSelected`).

### The stack

`docker/docker-compose.yaml`, compose project **`twakemail-e2e`**. Every port is bound to
`127.0.0.1` only.

| Service | Port | What |
|---|---|---|
| `james` | `127.0.0.1:18300` | tmail-backend `memory-1.0.21.2`, JMAP (direct, used by the provisioning client) |
| `james` | `127.0.0.1:18301` | WebAdmin (users, domains, quotas, team mailboxes) |
| `proxy` | `127.0.0.1:18302` | **the browser facing origin**: nginx serving the app and its runtime configuration, proxying `/jmap`, `/upload`, `/download`, `/eventSource`, `/.well-known/*` to James and `/dex/` to Dex |
| `app` | — | the Docker image of the app, only with `E2E_APP_IMAGE`, reached through the proxy |
| `dex` | — | OIDC provider, only with `E2E_OIDC=1` (profile `oidc`), reached through `/dex/` |

The James configuration is copied from tmail-flutter `backend-docker/` (`docker/james/`);
`jmap.properties` is rendered by `start.sh` from `jmap.properties.template`, and the JWT keys
are generated as in `scripts/patrol-web-integration-test-with-docker.sh`, all into
`docker/.generated/` (git ignored). `start.sh` waits for the James healthcheck, creates the
`example.com` domain, checks that JMAP answers through the proxy, then waits until a throwaway
account opens a session and reads its mailboxes three times in a row: right after start, James
may still answer 401 to the first authenticated requests.

**App configuration.** nginx serves `/.env.js` from [`docker/app-env.js`](docker/app-env.js),
whatever `.env.js` the build holds: basic auth, JMAP session on the origin of the app
(`window.location.origin + '/jmap/session'`), English UI. `/appList.js` comes from
[`docker/app-list.js`](docker/app-list.js): three apps on hosts that do not exist (the specs
answer them), the Drive one a URI template resolved per user. The same nginx serves a fake
Twake Drive on `http://localhost:<port>/e2e/drive/` (token exchange, intent, picker, a file)
for the Drive specs, which need the app in OIDC mode:
`E2E_OIDC=1 E2E_APP_ENV=docker/app-env-oidc.js ./scripts/start.sh`.

**Same origin.** The app and JMAP share `http://127.0.0.1:18302`, so the browser never
makes a cross origin call and the JMAP session advertises `http://127.0.0.1:18302/jmap`
(`url.prefix`). tmail-backend does answer CORS itself (`Access-Control-Allow-Origin: *`,
methods `GET, POST, OPTIONS`, headers `Content-Type, Authorization, Accept`), so a cross
origin setup would work too, but that is not what runs here. `127.0.0.1` is a secure context:
`crypto.subtle` (PKCE) is available without https.

### Variables

| Variable | Default | Used by |
|---|---|---|
| `E2E_APP_DIR` | `docker/app-placeholder` | `start.sh`: directory with the built app (`index.html`) |
| `E2E_APP_IMAGE` | | `start.sh`: Docker image of the app, proxied instead of `E2E_APP_DIR` (`docker/docker-compose.image.yaml`) |
| `E2E_OIDC` | `0` | `start.sh` (Dex + `OidcAuthenticationStrategy`), the OIDC specs |
| `E2E_PUBLIC_URL` | `http://127.0.0.1:18302` | `start.sh`: origin advertised by JMAP and used as Dex issuer |
| `E2E_JMAP_PORT` / `E2E_WEBADMIN_PORT` / `E2E_APP_PORT` | `18300` / `18301` / `18302` | `start.sh` |
| `E2E_BASE_URL` | `http://127.0.0.1:18302` | Playwright `baseURL` |
| `E2E_JMAP_URL` | `http://127.0.0.1:18300` | provisioning JMAP client |
| `E2E_WEBADMIN_URL` | `http://127.0.0.1:18301` | user fixtures |
| `E2E_DOMAIN` | `example.com` | user fixtures |
| `E2E_OIDC_ISSUER` | `$E2E_BASE_URL/dex` | `support/oidc.ts` |
| `E2E_WORKERS` | CPU based (2 on CI) | Playwright workers |
| `E2E_HEADLESS=false` / `E2E_SLOWMO=300` | | watch the browser |
| `E2E_TRACE` | `retain-on-failure` | `on` to record a trace for every test |

A failing test keeps a trace, a video and a screenshot under `test-results/artifacts/`;
reports are written to `playwright-report/` (HTML) and `test-results/junit.xml`. The
`globalSetup` refuses to start when the stack does not answer, with the command to run.

---

## Writing a test

```ts
import { expect, test } from '../support/fixtures';
import { LoginPage } from '../pages';

test('MBX-05 switching folder shows that folder emails', async ({ page, user, jmap }) => {
  await jmap.sendEmail({ to: user.email, subject: 'In sent', text: 'hello' });
  await jmap.sendEmail({ to: user.email, subject: 'In trash', text: 'hello', saveTo: 'trash' });

  const mailbox = await new LoginPage(page).loginAs(user);
  await mailbox.openFolder({ role: 'trash' });

  await expect(mailbox.emailRow('In trash')).toBeVisible();
  await expect(mailbox.emailRow('In sent')).toBeHidden();
});
```

### Conventions

- **The backlog ID starts the title**: `test('MBX-05 …')`. Tick the line of `e2e.md` once the
  spec passes in CI. A behaviour not in the backlog gets a new line there first.
- **Import `test` and `expect` from `support/fixtures`**, never from `@playwright/test`.
- **One user per test.** The `user` fixture creates `user-<uuid>@example.com` with a random
  password through WebAdmin and deletes it after the test. Nothing is shared, nothing is reset
  globally: tests run in parallel (`fullyParallel`) on one stack and can run in any order.
  Never use a fixed address (`bob@example.com`) in a basic auth test.
- **Seed through JMAP, assert through the UI** (and through JMAP when the screen could lie).
  A test sets up what it needs in a few milliseconds instead of clicking through the app.
- **Locate through page objects** (`pages/`), which use `data-testid` in kebab-case or the
  accessible role and name. A spec holds no selector. The ids the app must expose are listed in
  [`pages/README.md`](pages/README.md): extend it with the page object.
- **Accessibility (RGAA 4.1)**: once a screen is rendered, `await expectNoA11yViolations(page)`
  (`support/a11y.ts`) runs axe on it (WCAG 2.0 / 2.1, A and AA) and fails on any violation.
  The violations of twake-mui itself are listed in `TWAKE_MUI_KNOWN_VIOLATIONS`: reported as
  annotations of the test, and in `docs/twake-mui-gaps.md`. Drive with the keyboard where
  the scenario allows it (`tests/a11y.spec.ts`).
- **Web-first assertions** (`await expect(locator).toBeVisible()`), which retry, rather than
  reading a value and comparing it. No `waitForTimeout`. For backend state, `expect.poll` or
  `jmap.waitForEmail`.
- TypeScript conventions of Twake: strict, explicit return types, named exports (Playwright's
  config and `globalSetup` default exports are the only exceptions), `unknown` + guards for JSON.
- Every test starts on a clean browser context (Playwright default): no state leaks through
  local storage or cookies.

### Fixtures

| Fixture | What |
|---|---|
| `user` | A brand new account (`E2EUser`: `email`, `password`, `localPart`) |
| `users` | `users.create({ prefix: 'alice', quota })` for more accounts, `users.createTeamMailbox({ members })` for a team mailbox, `users.createAlias(user)` for an alias of an account (James gives the account an identity of it, as it does of the team mailboxes it belongs to); all deleted after the test, their emails (team mailboxes included) destroyed first |
| `jmap` | JMAP client authenticated as `user` |
| `jmapFor(other)` | JMAP client of another account, e.g. the sender of an email |
| `webadmin` | WebAdmin client, for the rest |
| `userQuota` (option) | `test.use({ userQuota: { count: 200, size: 50_000_000 } })` |

`support/jmap.ts` is a small hand written JMAP client (`fetch`, Basic or Bearer auth, no
dependency on the app's JMAP layer): `getSession`, `getMailboxes`, `findMailboxByRole`,
`findMailboxByName`, `createMailbox`, `sendEmail({ to, cc, bcc, subject, text, html,
attachments, saveTo, headers })`, `importEml(path, role)`, `getEmail(s)`, `queryEmails`, `setKeywords`,
`waitForEmail({ subject, mailboxRole, timeout })`, `getQuotas`, `upload`, and `request` for
any other method call. `importEml('reply_email/reply-all.eml')` reads from `fixtures/eml/`,
copied from tmail-flutter `provisioning/integration_test/eml/`.

`saveTo` reproduces a Patrol trick: an email sent to oneself with `saveTo: 'trash'` lands both
in the Inbox and, as its sent copy, in Trash (or Spam with `'junk'`).

---

## OIDC

**Feasible with Dex, and running** behind `E2E_OIDC=1` (profile `oidc`). Basic auth stays the
default mode of the phase 0 suite.

What tmail-backend 1.0.21.2 does (`com.linagora.tmail.james.jmap.oidc.OidcAuthenticationStrategy`,
a thin wrapper around James' `org.apache.james.jmap.http.OidcAuthenticationStrategy`, see the
tmail-backend doc `docs/modules/ROOT/pages/tmail-backend/jmap-extensions/oidcAuthentication.adoc`):
for a `Authorization: Bearer <token>` request, it calls in parallel

- `oidc.introspect.url` (RFC 7662, form `token=…`, with `oidc.introspect.credentials` as the
  `Authorization` header): requires `active: true` and an `exp`; checks `aud` against
  `oidc.audience` when the response carries one;
- `oidc.userInfo.url` with the bearer token: the `oidc.claim` claim (`email`) becomes the JMAP
  username. A `sid` claim, if any, enables backchannel logout.

The result is cached (`oidc.token.cache.expiration`, 60 s here). No JWT validation, no issuer
check: an opaque token would do, as long as the provider introspects it.

Dex (v2.41.1) has both endpoints: `/dex/token/introspect` (returns `active`, `exp`, `aud`,
`iss`…) and `/dex/userinfo` (returns `email`). Measured end to end:

- `INFRA-10`: a Dex token (password grant) opens a JMAP session as `alice@example.com`;
- `INFRA-11`: a forged token gets 401;
- `INFRA-12`: the SPA flow in the browser — authorization code + PKCE for the public client
  `twake-mail`, Dex login form, token exchange on `/dex/token` and JMAP call with the bearer,
  all on the app origin — ends in a JMAP session as `bob@example.com`.

Configuration (`docker/dex/config.yaml`, `docker/james/oidc.properties.fragment`):

| | |
|---|---|
| Issuer | `http://127.0.0.1:18302/dex` (browser facing, through nginx) |
| SPA client | `twake-mail`, public, PKCE, redirect URIs `/`, `/callback`, `/login/callback`, `/auth/callback` of the app origin (Dex has no wildcard: add the app's real callback there) |
| Introspection client | `tmail-backend` / `secret123` (`oidc.introspect.credentials=Basic …`) |
| Harness client | `e2e-harness`, password grant, for `support/oidc.ts` |
| `oidc.audience` | `twake-mail,e2e-harness` (Dex sets `aud` to the requesting client id) |
| Accounts | Dex static passwords `alice@example.com` and `bob@example.com`, password `secret`; `start.sh` creates their James counterparts |

Limits, and how to lift them:

- **No user per test in OIDC mode.** Dex static passwords live in its config file. Per-test
  accounts need Dex's LDAP connector plus an OpenLDAP container, exactly what Twake Calendar's
  e2e does (`E2EUserFactory` writes an LDAP entry; Dex reads the directory at each login):
  the factory would create the LDAP entry and the James user (`PUT /users/<email>`, any
  password). Worth doing when OIDC specs go beyond login/logout; until then OIDC specs use
  alice/bob and must not depend on mailbox content they did not create.
- **No `sid` in Dex tokens**: James logs a warning and backchannel logout cannot be tested.
  Dex v2.41 advertises no `end_session_endpoint` either (no RP-initiated logout): logout specs
  can only assert that the app drops its own session.
- **Refresh tokens**: Dex issues them (`offline_access`), but with the James cache (60 s) a
  revoked token stays accepted for up to a minute.
- If Dex ever falls short (claims mapping, logout), LemonLDAP::NG (the Twake Workplace SSO,
  introspection + `sid` + backchannel logout) or Keycloak (the reference of the tmail-backend
  doc) fit the same James configuration; both are heavier to boot than Dex.

---

## Performance (`perf/`)

A separate Playwright project, `playwright.perf.config.ts`, out of the default suite and of
CI: one worker, no retry, no trace nor video, `channel: 'chromium'` (the new headless mode, a
full browser: the default headless shell stops producing frames during a scripted scroll).
Run it against a **production build** on a **fresh stack**:

```bash
npm run build                                   # at the repo root
./scripts/stop.sh && E2E_APP_DIR=../apps/private/dist ./scripts/start.sh
npm run perf                                    # ~6 min, results in test-results/perf/results.json
./scripts/stop.sh                               # the seeded stack is not fit for the suite, see below
```

Its global setup seeds a user once (`scripts/seed-perf.ts`: 5 000 emails in the Inbox, 500
in "Perf folder", in about 30 s) and keeps its credentials in `perf/.perf-user.json` (git
ignored) while the stack keeps it. `npm run perf:seed -- --inbox 2000 --other 0 --out
/tmp/user.json` seeds another one by hand. `perf/mailbox.perf.ts` runs each measure 5 times
in a fresh browser context and prints the median and the p95 (nearest rank: with 5 samples,
the maximum); `perf/instrument.js` timestamps the first row, the clicks and the email body
frame in the page, and records long tasks. `PERF_RUNS=1` and `PERF_SCROLL_TARGET=300` make a
quick try. The method and the numbers are in [`docs/perf/phase0.md`](../docs/perf/phase0.md).

`perf/transition.perf.ts` (`PERF-03`) measures opening and closing an email with its view
transition, on a phone and a desktop, with and without reduced motion
([`docs/perf/view-transitions.md`](../docs/perf/view-transitions.md)): `npx playwright test -c
playwright.perf.config.ts perf/transition.perf.ts`.

`perf/composer.perf.ts` (`PERF-04`) measures answering a 200 KB newsletter: from the click on
Reply to the caret in the text, then the latency of each key typed above the quote, at full
speed and with the CPU slowed down 4 times.

`perf/threads.perf.ts` measures pushes on lists of conversations: `PERF-04` with 2 000 of
them loaded, and `PERF-05` during a grouped search with 400 loaded, an email that cannot match
it and one the client cannot tell (`PERF_SEARCH_TARGET`; seed with `PERF_THREADS=1`;
[`docs/perf/sync.md`](../docs/perf/sync.md)). The memory image may answer `serverFail` to the
parallel creations of the seed (`ConcurrentModificationException`): stop and start the stack,
then run again.

`perf/flutter.perf.ts` measures the same login and scroll on tmail-flutter web, as a
reference, when `PERF_FLUTTER_URL` is set: serve `linagora/tmail-web` on a free port of
`127.0.0.1` with an `env.file` whose `SERVER_URL` is the stack origin
(`http://127.0.0.1:18302/`), in its own compose project, and remove it afterwards.

---

## Layout

```
e2e/
├── e2e.md                    backlog: one line per Patrol test, stable IDs
├── playwright.config.ts
├── package.json              standalone package (Node 24, @playwright/test 1.63)
├── docker/
│   ├── docker-compose.yaml   project twakemail-e2e
│   ├── james/                tmail-backend configuration (from tmail-flutter backend-docker/)
│   ├── docker-compose.image.yaml   overlay: the app from its Docker image (E2E_APP_IMAGE)
│   ├── nginx/default.conf    single origin: app + /jmap + /dex
│   ├── nginx/app-{dist,image}.conf   the app location: bundle or image
│   ├── app-env.js            runtime configuration of the app under test (/.env.js)
│   ├── app-list.js           apps of its app grid (/appList.js)
│   ├── app-env-oidc.js       the same in OIDC mode with the Drive picker (E2E_APP_ENV, DRIVE-*)
│   ├── drive-picker.html     a fake Twake Drive picker (/e2e/drive/picker.html)
│   ├── dex/config.yaml       OIDC provider (profile oidc)
│   ├── app-placeholder/      served when E2E_APP_DIR is not set
│   └── .generated/           rendered config and keys (git ignored)
├── scripts/{start,stop}.sh
├── scripts/seed-perf.ts      big mailbox for the performance measures
├── playwright.perf.config.ts performance project (npm run perf)
├── perf/                     performance measures, not run by default
├── fixtures/
│   ├── eml/                  .eml files from tmail-flutter provisioning/integration_test/eml/
│   └── files/                attachments
├── support/
│   ├── fixtures.ts           test, expect and the fixtures
│   ├── jmap.ts               provisioning JMAP client
│   ├── users.ts              per-test accounts and team mailboxes
│   ├── webadmin.ts           WebAdmin client
│   ├── oidc.ts               Dex tokens without a browser
│   ├── env.ts                environment variables
│   └── global-setup.ts       fails fast when the stack is down
├── pages/                    page objects + README.md (the data-testid contract)
└── tests/                    the specs (infra.spec.ts: harness smoke tests, no UI; login,
                              mailbox, email, push: phase 0)
```

---

## CI

[`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml): builds the Docker image of the app, starts the stack with
`E2E_APP_IMAGE` (the suite runs against the production image and its security headers), runs the suite on Chromium, publishes the HTML report (always) and the
traces, videos and backend logs (on failure), and a JUnit summary. Run manually with `oidc`
checked to add Dex and the OIDC specs.

## Known backend quirks

- `view.email.query.enabled` is `false` (`docker/james/jmap.properties.template`) and must
  stay so. Two backend problems, reproduced by
  `tmail-backend-issues/team-mailbox-email-query-view/repro.sh`:
  - the memory image of tmail-backend enables the email query view
    (`view.email.query.enabled=true`) but its `listeners.xml` does not register
    `PopulateEmailQueryViewListener`: the view is never filled, and an `Email/query` with
    `inMailbox` (alone or with `after` / `before`) sorted by `receivedAt` descending returns
    **no ids, for every mailbox**, personal ones included. Registering the listener, as the
    distributed and postgres sample configurations do, fixes it;
  - the WebAdmin task `populateEmailQueryView` does not rebuild the view of **team
    mailboxes**: with the view enabled, a team mailbox filled before the listener ran stays
    empty to such a query.

  With the view disabled, `Email/query` is always answered by the search index. A
  deployment enabling the view must register the listener, and keep the team mailbox gap in
  mind.
- **`Email/set` updates on the memory image**
  ([linagora/tmail-backend#2684](https://github.com/linagora/tmail-backend/issues/2684); the
  postgres and distributed backends are not affected, and neither is the app):
  - *They hang* once (messages of the other accounts) × (ids of the update) reaches about 256:
    every `Email/set` *update* (keywords, `mailboxIds`, hence `onSuccessUpdateEmail` of
    `jmap.sendEmail`) never answers, while creates, reads, queries and local delivery keep
    working. Repro: `tmail-backend-issues/memory-email-set-update-hang/repro.mjs`. Destroying
    messages brings the updates back, so the `users` fixture destroys the emails of every
    account it created when the test ends (`JmapClient.destroyAllEmails`): the count stays at
    what the running tests hold. **Never run the suite after the perf seed** all the same:
    `stop.sh`, then `start.sh` again.
  - *They change other messages*: an update of more than 3 ids with the same patch applies to
    **every** message of the account when they all sit in a single mailbox (4 of 10 drafts
    flagged, all 10 changed and listed in `updated`). It does not happen once the account has
    messages in two mailboxes. A spec acting on more than 3 emails at once must give its user a
    message in another mailbox (an email sent to oneself also lands in Sent), with a comment
    pointing to #2684; never work around it in the app.
- **Search on the memory image** (Lucene in memory):
  - a `text` (or `subject`) condition of more than three or four words, or
    whose words follow a `<`, finds nothing: the search specs type shorter,
    distinctive queries, and `waitForEmail` (a `subject` query) cannot wait
    for long subjects (list the mailbox instead);
  - `SearchSnippet/get` answers `serverFail` (a `NullPointerException` in
    `LuceneSearchHighlighter.getHighlightAttachmentTextBody`) for some emails
    with an attachment: the app then shows the results without highlights;
  - under many parallel workers (16), uploads are sometimes lost
    ("Attachment not found") and concurrent `Email/set` moves fail with a
    `ConcurrentModificationException`; the suite is stable with the 2
    workers of CI (`E2E_WORKERS=2`).
- **Creating emails** (`tests/backend.spec.ts`, `INFRA-13` to `INFRA-17`, what the composer
  relies on): `bodyStructure` is ignored on creation (tmail-backend#2685), so the composer sends
  `htmlBody` + `textBody` + `attachments`; one `Email/set` creates before it destroys and
  `Email/get` reads `#creationId`; `Email/get` answers `serverFail` when `attachments` comes
  before any body property (#2686); a refused creation does not stop the destroy of the same
  `Email/set` (`INFRA-16`), so a draft is saved in two requests, the previous version destroyed
  only once the new one exists (`CMP-37`); destroying two emails in one `Email/set` drops the
  other emails of their mailbox from `Email/query` (`INFRA-17`, memory image: they are still
  there for `Email/get` and `Email/changes`).
- **Properties left out**: `Email/get` leaves out the properties it has no value for (`from` and
  `to` of a template or a draft without recipients, the `name` of an address) instead of
  returning `null`; the app reads them as `null`. A folder created with the name "Templates"
  gets the `templates` role from James.
- Deleting a user (`DELETE /users/…`) removes the account (it can no longer authenticate,
  `INFRA-02`) but James does not purge its mailboxes; harmless here (memory backend, random
  addresses, `stop.sh` drops everything).
