# Composer: large drafts

Measures and budgets of the composer on big messages ([#65](https://github.com/Crash--/twake-mail-frontend/issues/65),
point 2). Specs: `e2e/perf/composer-large.perf.ts` (`PERF-06`, `PERF-07`), helpers
`e2e/perf/largeDrafts.ts` (the messages), `e2e/perf/composerProbe.ts` (the probes in the page),
budgets `e2e/perf/budgets.ts` (checked at the end of each test).

## Method

```bash
cd e2e
./scripts/stop.sh && E2E_APP_IMAGE=twake-mail-frontend:e2e ./scripts/start.sh   # the Docker image, as the CI
npm run perf:large        # the large drafts only, ~12 min; `npm run perf` runs them first, then the rest
PERF_LARGE=thread-2mb PERF_LARGE_RUNS=1 npm run perf:large   # a case, one run
PERF_PROFILE=/tmp/prof PERF_LARGE=thread-2mb PERF_LARGE_RUNS=1 npm run perf:large   # + .cpuprofile and top functions
PERF_NO_BUDGET=1 ...      # measure without failing on the budgets
```

- The app is served by its **Docker image**, not by the static server: the nginx of the image
  serves the pdf worker `.mjs` with the right MIME type.
- The cases run **on a fresh stack, before the 5 000 email seed** (`PERF_PHASE=large` skips it):
  on a seeded memory backend, `EmailSubmission/set` with `onSuccessUpdateEmail` stalls for
  minutes, whatever the size. The cases make their own users.
- Each run imports a message into Drafts (an `.eml` built in memory: `largeDrafts.ts`), signs in,
  opens the draft from the list, types 62 keys at the top of the body (60 ms apart), waits for the
  save in the browser, presses "Save draft", then Send. 3 runs, median and p95 (nearest rank) of
  the runs. Each case at **CPU x1** and **x4** (`Emulation.setCPUThrottlingRate`).
- Cases: 1, 2 and 5 MB of quoted thread (nested blockquotes, as another client writes them: the
  editor parses all of it), 2 MB of big tables (12 columns), 2 MB of inline images (40 `cid:`
  PNGs), 50 attachments, 200 recipients; `PERF-07` pastes 200 addresses into To.
- Measures: open (click on the draft to the content shown), key to next frame (probe in the page),
  long tasks, calls to `innerHTML` over 100 KB (a whole-document serialization, which is what
  `editor.getHTML()` does), big `JSON.stringify`, IndexedDB `put` (count and cost of the
  structured clone), request bytes of the save and of the send, longest task of each.
- **Not Playwright locators on the page being measured**: `toBeVisible`, `getByRole` and the like
  walk the accessibility tree of a 2 MB document (seconds, seen in the profile:
  `getCSSContent`, `isElementHiddenForAria`). The open and the send are timed with
  `page.waitForFunction`.

## What it found, and what was done

| Cause | Where | Fix |
|---|---|---|
| Layout and paint of thousands of nodes at each key (the profile of a key: `(program)`, native) | the whole editor | `content-visibility: auto` on the top level blocks of the editor (`ds/RichTextEditor`): what is out of view is not laid out. Still in the accessibility tree and found by the page search |
| `editor.getHTML()` serializes the whole document: 28 ms at x1, 110 ms at x4 for 2 MB, called 2 to 3 times by each write in the browser and 4 times by a save | `ComposerForm` | `features/composer/editorHtml.ts`: the HTML of each top level block is kept against the (immutable) block, so a key serializes one paragraph. The storage form (`cid:`) is kept against the document. Tested equal to `editor.getHTML()` |
| The whole form rendered at each key (`setChanges`), so 200 chips and 50 files drawn again: 50 ms at x4 | `ComposerForm` | the editor schedules the autosave itself (`handleEditorUpdate`: same timers, the closures of the last render in a ref), no render. The fields keep `markChanged` |
| The window said nothing when the server refuses a request over `maxSizeRequest` | `composeEmail.ts` | `isRequestTooLarge`: the existing "too large" messages for the save and the send |

Not touched on purpose: the safety of the autosave (IndexedDB written 0.8 s after the first change,
`sessionStorage` on `pagehide`, Web Locks, 5 minutes for the server). `draftPolicy.spec.tsx` has two
new tests that type **in the body** (until then only the subject) and check the record in the
browser after 1.5 s and the draft on the server after the idle delay, which restarts at each key.

Attribution, thread of 2 MB, median key to frame, x1 / x4: before 22 / 92 ms; `content-visibility`
alone (injected in the page, one run) 16 / 58 ms; with the block serialization 11 / 52 ms
(one run); with the form no longer rendered 4.8 / 17 ms (3 runs, below).

## Numbers (3 runs, median; before → after)

Machine of the run: 16 threads, Chromium 1243 of Playwright 1.63 (new headless), tmail-backend
`memory-1.0.21.2`, same origin. Times in ms.

Key to next frame, median / p95:

| Case | x1 median | x1 p95 | x4 median | x4 p95 |
|---|---|---|---|---|
| 1 MB thread | 13.9 → 3.2 | 15.8 → 4.0 | 56.8 → 11.7 | 66 → 16.2 |
| 2 MB thread | 22.2 → 4.8 | 25.2 → 5.9 | 91.9 → 17.1 | 108 → 24.1 |
| 5 MB thread | 47.1 → 9.5 | 52.4 → 11.5 | 809 → 35.8 | 1610 → 53.8 |
| 2 MB tables | 38.5 → 2.3 | 41.1 → 2.8 | 3300 → 8.9 | 4495 → 11.0 |
| 2 MB images | 5.7 → 1.9 | 7.1 → 2.5 | 23.1 → 6.8 | 30.1 → 9.6 |
| 50 attachments | 12.7 → 2.6 | 15.5 → 3.3 | 51.4 → 8.9 | 60.6 → 13.1 |
| 200 recipients | 11.5 → 1.6 | 14.4 → 2.2 | 47.0 → 5.6 | 57.2 → 8.8 |

Long tasks (> 50 ms) while typing, x4: 72 → 0 (2 MB thread), 127 → 0 (tables), 132 → 1 (5 MB).

Open, save and send (click to the result):

| Case | open x1 | open x4 | save x1 | save x4 | send x1 | send x4 |
|---|---|---|---|---|---|---|
| 1 MB thread | 474 → 216 | 1712 → 656 | 604 → 583 | 1097 → 1083 | 377 → 348 | 899 → 728 |
| 2 MB thread | 840 → 317 | 2971 → 1092 | 771 → 702 | 1682 → 1458 | 702 → 606 | 1890 → 1363 |
| 5 MB thread | 1890 → 656 | 7495 → 2465 | refused | refused | refused | refused |
| 2 MB tables | 1539 → 815 | 5726 → 2908 | 1058 → 783 | 3253 → 1883 | 881 → 606 | 3754 → 1785 |
| 2 MB images | 173 → 182 | 354 → 322 | 573 → 582 | 752 → 823 | 225 → 223 | 357 → 346 |
| 50 attachments | 107 → 114 | 332 → 314 | 497 → 500 | 846 → 847 | 157 → 158 | 399 → 416 |
| 200 recipients | 116 → 118 | 350 → 351 | 399 → 416 | 720 → 758 | 122 → 111 | 330 → 375 |

Autosave, 2 MB thread (x1): whole-document serializations while typing 12 → 0 (48 ms → 0), 5 → 1
for a save (the one that builds the message); IndexedDB: one `put` after the typing stops, about
1 ms of structured clone (a body over 2 million characters is not kept in the browser, by design:
`MAX_BODY_LENGTH`; the server draft is the fallback). Typing for 4 seconds makes 4 or 5 writes (the
first change arms a 0.8 s timer that the following keys do not move).

Request size: the body is sent twice (HTML and text alternative) plus the inline styles the editor
adds: 2.06 MB for a 1 MB body, 4.1 MB for 2 MB, 3.8 MB for 2 MB of tables. Saving and sending a
draft replace the draft (one creation, one destruction): two requests of that size.

## The limit that is not ours: 10 MB per request

tmail-backend advertises `maxSizeRequest` = 10 000 000 and answers `urn:ietf:params:jmap:error:limit`
(HTTP 400) above it. A **5 MB HTML body makes a 10.27 MB request**: it cannot be saved nor sent
(JMAP creates a message from `bodyValues` in the request; the other way, `Blob/upload` of an
`.eml` then `Email/import`, would need the message built as MIME in the browser). Before, the
window said "Draft not saved" and a generic error; it now says the message is too large. Refused in
0.5 s (x1), 1.6 s (x4). Decision left to the product (below).

## Budgets

`checkBudgets` fails the test when a **median** is over (about 2 to 3 times the figures above, so
that a noisy runner does not fail it but a regression does). `x1` / `x4`:

| Measure | Budget x1 / x4 | Why |
|---|---|---|
| key to frame, median | 50 / 50 | the target of #65: 50 ms on a 2 MB draft. Held at x4 as well (worst 35.8, the 5 MB thread) |
| key to frame, p95 | 100 / 100 | twice the median |
| long tasks while typing | 5 / 5 | saves and render stay out of the keys |
| whole-document serializations while typing | 1 / 1 | a key serializes its paragraph |
| open | 2000 / 6000 ms | worst 815 / 2908 (2 MB of tables) |
| local save, longest task | 150 / 300 ms | |
| save draft, send | 3000 / 6000 ms | worst 783 / 1883 and 606 / 1785 |
| save draft, send, longest task | 400 / 1500 ms | building the message is one task (tables: 253 / 1060) |
| refused over `maxSizeRequest` | 3000 / 6000 ms | the window says so at once |
| request bytes, 1 MB / 2 MB body | 2.3 / 4.5 MB | the body goes twice |
| `PERF-07` paste of 200 addresses | 500 / 1500 ms | measured 57 / 237 |
| `PERF-07` key in Subject with 200 chips | 50 / 150 ms | measured 22 / 92: **the chips are still drawn again at each key of the subject** |

The 50 ms target of the issue is met with a wide margin (2 MB: 4.8 ms at x1, 17 ms at x4), so it is
not relaxed.

## Known, not done

- The subject (and the recipients) still render the whole form: 200 chips cost 92 ms per key at
  x4. The chip of `ds/RecipientField` takes inline handlers; making it a memoized component with
  stable handlers is a change of the design system on its own.
- Opening a 5 MB or 2 MB-of-tables draft at x4 takes 2.5 to 2.9 s (parsing of the HTML three
  times: `fromEmailHtml`, `blockRemoteImages`, TipTap). One pass would save about a third.
- With 200 recipients the chips take the window: the body keeps about 66 px of a 634 px window
  (screenshot in the audit). A cap on the height of the recipients, with its own scroll, is a
  geometry decision (CMP-84 to CMP-98).
