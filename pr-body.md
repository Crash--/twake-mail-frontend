Closes #228

## What
- **Skip link (RGAA 12.7 / WCAG 2.4.1)**: new `@/ds/SkipLink`. It is the first Tab stop of the signed-in layout and only shows while focused ("Skip to main content", in en/fr/ru/vi). Following it focuses the main content. It calls `focus()` instead of changing the URL hash, because the router would treat a hash change as a navigation.
- **Focus after a navigation**: the main content (`data-testid="main-content"`) now has `id="main-content"` and `tabIndex={-1}`. `layout/useFocusMainOnNavigation` focuses it after a route change that left the focus on `<body>` or on a removed element. That covers signing in, when the "Sign In" button goes away with the login page. Views that set the focus themselves (an open email or conversation, the row to come back to, the settings heading) and links that keep it (the folder tree) still win: their effects run first, so the focus is no longer lost.
- Docs: a row in `docs/twake-mui-gaps.md` (SkipLink, a component to move upstream) and the `skip-to-content` test id in `e2e/pages/README.md`.

## Tests
- `common/src/ds/SkipLink/SkipLink.spec.tsx`: it is the first Tab stop, and Enter focuses the target.
- `common/src/layout/AppLayout.spec.tsx`: the main content gets the focus when it arrives on `<body>`. The skip link starts the Tab order and moves the focus to the main content.

## Checks
**Nothing has been run.** Node 24 was not reachable in this automated session (system Node is v12, and nvm needed an approval it could not get), so `npm ci` failed and lint, format, typecheck, Jest and build all still need to run. Please rely on CI and check in particular:
- that twake-mui `Content` passes `id` and `tabIndex` through (it already passes `data-testid`)
- the `sx` typing of `SkipLink`
- the new specs

---
*Generated automatically*
