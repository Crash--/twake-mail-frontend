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

## Accessibility (RGAA 4.1)

The design system is accessible by construction: an app using it correctly
cannot produce an inaccessible screen. Every component here must:

- work with the keyboard alone (Tab, Shift+Tab, Enter, Space, Escape, arrows
  where the pattern expects them), with a visible focus indicator;
- move the focus sensibly when it opens or closes (dialogs, menus, views)
  and give it back to the element that opened it;
- use native semantics first (`button`, `a`, `table`, `nav`, headings), ARIA
  only when no element fits, and then the complete ARIA pattern;
- require an accessible name for every control: icon buttons take a
  `label` that becomes both their `aria-label` and their tooltip;
- meet AA contrast (4.5:1 text, 3:1 large text and UI parts) with the theme
  colours, and never carry information by colour alone (an unread row is
  bold *and* says "Unread");
- announce changes that happen away from the focus through a live region
  (`role="status"` / `aria-live="polite"`, `role="alert"` for errors);
- respect `prefers-reduced-motion` for any animation or smooth scrolling it
  adds.
