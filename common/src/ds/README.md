# `@/ds/`: the local design system

UI that Twake Mail needs and that `@linagora/twake-mui` does not provide yet.
Import it with the `@/ds/` alias (`import { AppTitle } from
'@/ds/AppTitle/AppTitle'`), from `apps/` as well as from `common/`.

Everything here is meant to move to [twake-ui](https://github.com/linagora/twake-ui)
one day, or to disappear when twake-mui catches up: keep it generic.

## Rules

- **UI only, no business logic.** MUI, styles and behaviour; nothing that
  knows about email. No JMAP (`jmap-client-ts`), no data (`@tanstack/*`), no
  routing (`react-router`), no translations (`twake-i18n`), no import from
  `features/`, `jmap/`, `app/`, `config/`, `i18n/` nor `@injected/`. Labels,
  values and links arrive as props; a link takes a `component` (e.g. the
  router `Link`) the way MUI does. ESLint enforces it.
- **Raw MUI is allowed here, and only here**: `@mui/material`, `sx`,
  `styled`. Prefer what `@linagora/twake-mui` re-exports and the theme
  values (`theme.palette`, `theme.spacing`) over hard-coded values. Inline
  `style` stays forbidden.
- **Compose, do not fork.** When a twake-mui component almost fits, wrap it
  (see `VirtualizedListTable`) rather than copying its code.
- **One folder per component**: `ds/<Component>/<Component>.tsx`, its
  colocated `<Component>.spec.tsx` (rendered with `ds/testing/renderDs`,
  theme only), and a header comment saying whether it should go upstream to
  twake-ui, and why.
- Named exports, explicit types, `data-testid` passed through as a prop by
  the caller (the ids are a contract of the app, not of the design system).
- Record each component in [`docs/twake-mui-gaps.md`](../../../docs/twake-mui-gaps.md)
  (column "Where").
