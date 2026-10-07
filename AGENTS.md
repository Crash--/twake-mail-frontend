# Twake Mail frontend

React rewrite of the web version of [tmail-flutter](https://github.com/linagora/tmail-flutter):
a standalone webmail (not a Cozy app) talking JMAP to tmail-backend / James.

## Stack (decided, do not re-discuss)

- npm workspaces: `apps/private` (the application) and `common` (shared
  code). Node 24 (`nvm use 24`), npm.
- Rsbuild, React 19, TypeScript strict, react-router 7.
- UI: `@linagora/twake-mui` 10.x, `@linagora/twake-icons`,
  `@linagora/twake-css` utility classes, `twake-i18n`, `@linagora/twake-utils`.
- Data: TanStack Query v5. No Redux.
- JMAP: `jmap-client-ts` v2 (contract: `jmap-client-ts/docs/v2-api.md`),
  installed from `github:Crash--/jmap-client-ts#v2` until it is published.
- Auth: OIDC (`openid-client` v6) by default, HTTP Basic as an option.
- Tests: Jest 30 + ts-jest + Testing Library. End-to-end tests (Playwright)
  live in `e2e/`, a separate npm package outside the workspaces: never add
  anything there from this package, and keep it out of lint and Jest.

## UI rules

- **Never use cozy-ui.**
- Import components from `@linagora/twake-mui` only. Never import
  `@mui/material`, `@mui/lab` or `@mui/icons-material` directly (ESLint
  enforces it): twake-mui re-exports MUI. Icons come from
  `@linagora/twake-icons`.
- Outside `@/ds/`: no `sx`, no `style`, no `styled`, no local MUI override,
  no custom CSS: plain components with their standard API. If layout truly
  needs it, use twake-css classes (`u-flex`, `u-p-1`, `u-h-100`…).
- When twake-mui lacks a component or variant, build it in the local design
  system `common/src/ds/`, imported as `@/ds/<Component>/<Component>`: the
  only place where raw MUI, `sx` and `styled` are allowed, and where no
  business logic is (no JMAP, TanStack Query, router, i18n, nor import from
  `features/`, `jmap/`, `app/`, `config/`); labels and values come as props.
  Rules: [`common/src/ds/README.md`](common/src/ds/README.md). Record the
  gap in `docs/twake-mui-gaps.md` (component, variant, intended usage, where
  it is implemented, the twake-ui change it calls for).
- All user-facing strings are translated from the start, in the four locales
  (en, fr, ru, vi). Reuse tmail-flutter translations when they exist: see
  `docs/i18n.md`.
- Icon buttons have a tooltip (except obvious ones, like closing a dialog).
- Interactive elements that end-to-end tests drive get a stable kebab-case
  `data-testid`. The ids are a contract with the end-to-end suite, listed in
  `e2e/pages/README.md` (derived from the tmail-flutter keys): use the id it
  lists, and never rename one without updating `e2e/`.

## Accessibility (RGAA 4.1)

The whole webmail must be accessible and comply with RGAA 4.1 (the French
state standard, close to WCAG 2.1 AA). This is a requirement, not a polish
step: a feature is not done until it is accessible.

- **Keyboard**: everything works without a mouse (Tab, Shift+Tab, Enter,
  Space, Escape, arrows where the pattern expects them), in a logical order,
  with a visible focus.
- **Focus indicator**: the theme draws it, for the whole app, from
  `@/ds/FocusIndicator/focusIndicator` (one `:focus-visible` /
  `.Mui-focusVisible` rule). Two looks, chosen in Settings > Preferences >
  Accessibility (kept in the browser, off by default): discreet, a 1 px
  line and nothing in a text field (a click shows `:focus-visible` there
  too); enhanced, a 3 px outline on everything that takes the focus. A
  component never sets an `outline` on focus; in `@/ds/` only, it may change
  the `--focus-ring-*` custom properties (another colour, drawn inside with
  `FOCUS_RING_INSET`) or put `FOCUS_RING` on another element (`::after`).
- **Focus management**: opening a view or a dialog moves the focus into it
  (its heading or first control); closing it gives the focus back to what
  opened it. Changing route moves the focus to the new main content.
- **Semantics**: native elements first (`button`, `a`, `table`, headings,
  landmarks), then ARIA, and then the complete pattern (`role`, states,
  `aria-*` kept in sync).
- **Names**: every control has an accessible name. Every icon button has an
  `aria-label` and a tooltip with the same text.
- **Contrast and colour**: colour contrast is deferred to a dedicated
  theme: until then, use the official Twake palette (Figma "Teammail 1.1")
  as is, without darkening colours, and the e2e axe helper reports
  `color-contrast` as an annotation instead of failing. No information
  carried by colour alone (an unread email is bold
  and its row says "Unread"; starred is announced through `aria-pressed`
  and the row name).
- **Language and titles**: `<html lang>` follows the UI language; each view
  sets its own `<title>` with `useDocumentTitle` (`<view> - Twake Mail`,
  after the unread count of the Inbox: `(3) Inbox - Twake Mail`).
- **Frames**: the email body iframe has a `title`.
- **Live regions**: notifications (snackbars, errors) and new emails arriving
  by push are announced through a live region (`role="status"`,
  `aria-live="polite"`; `role="alert"` for errors).
- **Motion**: respect `prefers-reduced-motion` (no smooth scrolling or
  animation when it is set).
- **Tooling**: ESLint runs the jsx-a11y rules (`eslint-plugin-jsx-a11y-x`)
  as errors; the end-to-end specs check each screen with axe
  (`expectNoA11yViolations(page)`, WCAG 2.0/2.1 A and AA) and a spec drives
  the main path with the keyboard only. A violation coming from twake-mui is
  recorded in `docs/twake-mui-gaps.md`, never hidden.
- `@/ds/` components are accessible by construction (see its README).

## Code rules

Follow the Twake skills: `twake-react-conventions`,
`twake-typescript-conventions`, `twake-javascript-conventions`,
`twake-javascript-naming`, `twake-frontend-testing`, `twake-git-conventions`.
In short:

- Named exports only (tool configs that require a default export excepted).
  Function components only. One non-trivial component per file.
- Explicit return types, no `any`, no `as unknown as T`, no enums, `unknown`
  in `catch`, `null` for absent values, `===` only.
- Errors: `null`, a meaningful value, or `{ ok: true, value } | { ok: false,
  error }`; `throw` only for broken invariants.
- `async`/`await`, fire-and-forget promises get a `.catch()`.
- Imports: external, then Twake/internal packages, then local. Use the
  aliases `@/` (app), `@/ds/` (design system, in `common/src/ds/`),
  `@common/` and `@injected/`. No barrel files.
- `window.location` only for external URLs (SSO); in-app navigation goes
  through react-router.

## Data: TanStack Query

- `common/src/app/queryClient.ts` creates the client (no retry on 4xx).
- Each feature has a `queries.ts` exporting a key factory and
  `queryOptions()` factories; the `useXxx` hooks live next to it and only call
  `useQuery(xxxQueryOptions(...))`. Keys start with the feature name and the
  JMAP account id (see `common/src/features/mailbox/queries.ts`).
- The cache is cleared when the session ends.

## Auth

`common/src/features/auth/`:

- `oidcAuth.ts`: Authorization Code + PKCE (S256); verifier, state and return
  path in `sessionStorage` during the SSO round trip; tokens in memory only;
  refresh before expiry and on 401 (`refresh()` is shared by concurrent
  callers); back to the SSO only when the refresh fails; logout with
  `id_token_hint`.
- `basicAuth.ts`: form credentials checked with a GET on the JMAP session URL
  (200 ok, 401 refused), kept in memory only. A new tab or a reload gets
  them from another signed-in tab over the `twake-mail-basic-session`
  BroadcastChannel (`basicSessionSharing.ts`), and shows the login form
  when no tab answers.
- Both expose `getAuthorizationHeader()` and `onUnauthorized()`, which the
  JMAP client consumes (`common/src/jmap/makeJmapAuth.ts`).
- `localSession.ts`: `endLocalSession()` broadcasts on the
  `twake-mail-session` BroadcastChannel so every tab signed in with the same
  account signs out (a tab signed in with another account stays signed in).

Never store tokens or passwords in web storage, never log them.

## JMAP

`common/src/jmap/`:

- `JmapClientProvider` creates one jmap-client-ts client per sign-in
  (`createClient` from the library, `makeJmapAuth` adapting the auth
  service); `useJmapClient()` returns it.
- `JmapSessionProvider` loads the JMAP session before the mail screens;
  `useJmapSession()` gives the session and the mail `accountId`.
- Use the library types (`Mailbox`, `Email`…), narrowed with `Pick` to the
  `properties` a query asks for.
- Tests talk to a fake JMAP server through the real client
  (`common/src/testing/fakeJmapServer.ts`, `renderWithProviders({
  jmapServer, withJmapSession })`), never to a mocked client.

## `@injected` modules

`common` code may import `@injected/<path>`: it resolves to
`common/src/<path>` unless the app overrides it. To override, run
`npm run copy-from-common <path>` and list the path in
`apps/private/injectedAliases.ts`.

## Tests

- Colocated `*.spec.ts` (Node environment) and `*.spec.tsx` (jsdom), never a
  `__tests__` folder, never snapshots.
- Render with `renderWithProviders` (`common/src/testing/`); query by role or
  label first, `data-testid` otherwise; `queryBy…` + `toBe(null)` for
  absence.
- Mock at the boundaries (`openid-client`, `fetch`, the auth service), not
  the code under test.

## Before committing

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:scripts && npm run build
```

Commits follow Conventional Commits, one subject per commit
(`twake-git-conventions`). Dependencies: no `overrides` to silence
`npm audit` (`twake-package-manager-audit`).
