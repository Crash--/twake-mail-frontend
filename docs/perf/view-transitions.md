# Opening an email with a view transition

Opening and closing an email run as view transitions (issue #12): a
swipe-like slide below 900 px, a fade through on wider screens, nothing with
`prefers-reduced-motion: reduce` or in a browser without the API. Measured
on 2026-10-05 with `e2e/perf/transition.perf.ts` (`PERF-03`): production
build, end-to-end stack, 5 000 emails in the Inbox, Chromium (new headless),
5 runs each, median and p95 (the worst of 5), before the change (`main`) and
after it, each on a fresh stack.

```bash
npm run build                                   # at the repo root
cd e2e && ./scripts/stop.sh && E2E_APP_DIR=../apps/private/dist ./scripts/start.sh
npx playwright test -c playwright.perf.config.ts perf/transition.perf.ts
./scripts/stop.sh                               # the seeded stack is not fit for the suite
```

`perf/instrument.js` timestamps the click, the subject entering the DOM and
taking the focus, the email body frame loaded, the row taking the focus
back, and the end of each view transition (`finished` of
`document.startViewTransition`). "Animation over" is the end of the
transition, or the subject (the row) when there is none.

## Results

| ms, median / p95 | before | after |
|---|---|---|
| Phone (390 × 844): click → subject in the DOM | 42.6 / 51.5 | 54.3 / 70.0 |
| Phone: click → subject focused | 42.1 / 51.0 | 53.9 / 69.4 |
| Phone: click → body frame loaded | 46.9 / 55.1 | 57.9 / 73.9 |
| Phone: click → animation over | 42.6 / 51.5 | 297.3 / 297.7 |
| Phone: back → row focused | 139.3 / 140.1 | 156.7 / 157.6 |
| Phone: back → animation over | 139.3 / 140.1 | 297.4 / 297.6 |
| Desktop (1 440 × 900): click → subject in the DOM | 55.9 / 66.7 | 83.9 / 99.6 |
| Desktop: click → subject focused | 55.2 / 65.8 | 83.0 / 98.5 |
| Desktop: click → animation over | 55.9 / 66.7 | 325.3 / 327.2 |
| Desktop: back → row focused | 183.4 / 199.7 | 210.6 / 238.2 |
| Phone, reduced motion: click → subject focused | 35.5 / 37.4 | 35.4 / 37.9 |
| Desktop, reduced motion: click → subject focused | 54.1 / 59.5 | 52.3 / 85.8 |

- The new view is in the DOM and focused 12 ms (phone) to 28 ms (desktop)
  later: the browser captures the old view before React renders the new
  one. Keyboard and screen reader users get the subject (or the row) at
  once, the animation runs over a page that is already the new one (the
  pseudo-elements let the pointer through).
- The animation itself lasts 220 ms; with the capture and the first frames
  the move is over about 300 ms after the click.
- Reduced motion: no transition at all, the same timings as before.
- The back and forward buttons of the browser: React Router replays a
  transition between paths it already animated, without asking; the
  direction is cleared on `popstate` and a transition without one does not
  move (and the `prefers-reduced-motion` media query stops any animation
  that would still start).

## Browsers

- Chromium: as measured above.
- Firefox 155 (Playwright): the API is there and the e2e specs `EML-32` and
  `EML-33` pass; the pseudo-elements get the same transforms and opacities
  as in Chromium at every instant. The headless screenshots of Firefox do
  not render the pseudo-elements faithfully while a transition runs
  (clipped, blank pane): to check by eye in a desktop Firefox.
- Without the API (`EML-33` removes it): no transition, same behaviour.
