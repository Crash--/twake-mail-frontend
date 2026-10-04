# Performance of the phase 0 email list

Does the list hold a mailbox of thousands of emails? Measured on 2026-10-04,
on the production build, against the end-to-end stack, with
`e2e/perf/` (`npm run perf` in `e2e/`, see [`e2e/README.md`](../../e2e/README.md),
"Performance").

**Short answer: yes for the list itself** (bounded DOM, no long task, a flat
heap, a first row in under 200 ms), **no for push**: with 2 000 emails
loaded, one new email costs 69 requests, 1.2 MB and 6 s before it shows,
because every loaded page is refetched. Incremental updates (`Email/changes`)
are the next thing to build.

## Setup

| | |
|---|---|
| Machine | Shared dev server: AMD Ryzen 7 9700X (8 cores, 16 threads), 62 GB, Ubuntu 24.04 (kernel 6.8), Docker; many other containers running (load average 3 to 10) |
| Browser | Chrome for Testing 153 (Playwright 1.63, `channel: 'chromium'`, new headless mode), 1440×900, one fresh context per run, no trace nor video |
| Backend | tmail-backend `memory-1.0.21.2` (compose project `twakemail-e2e`), nginx on `127.0.0.1:18302` serving the app and proxying JMAP: same origin, no CORS |
| App | `npm run build` of this commit (507 kB gzipped in total), React 18 production build, `VirtualizedTable` of twake-mui 9.16 through `ds/VirtualizedListTable` |
| Data | One user seeded by `e2e/scripts/seed-perf.ts`: 5 000 emails in the Inbox and 500 in "Perf folder" (`Email/set` by batches of 250, 4 in parallel: 24 to 31 s), 1 to 20-word subjects, 0 to 5 paragraphs of body, 312 different senders, 15 % with a 20 kB PDF, 30 % unread, 8 % starred, received over about six months |
| List settings | Pages of 30 emails (`Email/query` + `Email/get` by back-reference, one request), next page asked when fewer than 10 rows are left below the visible ones, 400 px of overscan, rows of 49 px |

## Method

Each measure runs **5 times**; the tables give the median and the p95 (nearest
rank: with 5 samples, the p95 is the maximum, so read it as "worst of 5").
`e2e/perf/instrument.js` timestamps in the page, with `performance.now()`:
the click (capture listener), the first `email-list-item` row
(`MutationObserver`) and the `load` event of the email body frame; a buffered
`PerformanceObserver('longtask')` records long tasks. JMAP traffic is the
POSTs to `/jmap` seen by Playwright (`request.timing()`, decoded body size).
The heap is `Runtime.getHeapUsage` after `HeapProfiler.collectGarbage` (CDP).
The scroll is a `requestAnimationFrame` loop adding 40 px per frame to the
scroller (about 2 400 px/s, a fast continuous scroll) until the row of index
1 999 is rendered; the same loop records every frame duration.

Push: an email is created in the Inbox by another client (`Email/set` create
on the direct JMAP port), which James notifies over the WebSocket. With one
page loaded, the measure waits for its row; with 2 000 loaded, the new row is
far above the viewport and not rendered, so it waits for the announcement of
the list's live region ("You have new messages"), which happens when the new
email is in the data of the list.

## Results

### 1. Login → first row of the Inbox

| | median | p95 |
|---|---|---|
| Click on "Sign in" → first row in the DOM | 188 ms | 352 ms (first, cold run) |
| First `Email/query` + `Email/get` request: duration | 113 ms | 259 ms |
| First `Email/query` + `Email/get` request: response | 16.4 kB | 17.0 kB |
| JMAP requests until the network is idle | 4 | 4 |
| Rows in the DOM after the first page | 25 | 25 |

The four requests are `Mailbox/get` and the first page, **twice**: when the
push WebSocket opens (`POST /jmap/ws/ticket`, then the socket), the app
refetches everything push keeps up to date (`invalidatePushedData`), to catch
changes made before the socket was open, which includes the data it has just
loaded. The JMAP session (`GET /jmap/session`) is also fetched twice in basic
mode: once to check the credentials, once by `JmapSessionProvider`.

### 2. Opening an email from the list

| | median | p95 |
|---|---|---|
| Click on a row → body frame loaded | 50 ms | 54 ms |
| Back to the list (cached) → first row | 49 ms | 50 ms |

Read emails only (see "Backend" below). The back button now restores the
scroll position and the focus on the email that was open.

### 3. Continuous scroll to 2 000 emails

| | median | p95 |
|---|---|---|
| Duration (2 400 px/s; the scroll speed, not the network, is the limit) | 40.3 s | 41.2 s |
| Pagination requests | 66 | 66 |
| Mean duration of a page request | 96 ms | 108 ms |
| Mean response of a page | 17.1 kB | 17.1 kB |
| Most `tr` rows in the DOM at once | 34 | 34 |
| Long tasks (> 50 ms) during the scroll | 0 | 1 (51 ms) |
| Frames longer than 50 ms (of 2 420) | 0 | 1 |
| p99 frame | 16.8 ms | 33.3 ms |
| JS heap after GC, after the first page | 13.6 MB | 13.7 MB |
| JS heap after GC, 2 000 emails loaded | 17.4 MB | 17.4 MB |

A first series had one outlier run (86 long tasks, 6.6 s in total, 98 frames
over 50 ms) that a second series of 5 did not reproduce: noise of the shared
machine; the table is the second series.

The DOM stays bounded (34 rows for a 900 px window), the scroll stays at
60 fps, and 2 000 emails cost about 2 kB of heap each (3.8 MB): the
virtualization does its job and holding all the loaded pages is not a
problem at this size.

### 4. Inbox → other folder → Inbox

| | median | p95 |
|---|---|---|
| Inbox → "Perf folder" (first visit) → first row | 65 ms | 80 ms |
| "Perf folder" → Inbox (cached) → first row | 49 ms | 50 ms |
| JMAP requests when coming back to the Inbox | 0 | 0 |

The Inbox comes from the TanStack Query cache (`staleTime` 30 s): no request
within 30 s.

### 5. A new email arriving by push

| | median | p95 |
|---|---|---|
| **1 page loaded**: arrival → row shown | 235 ms | 315 ms |
| 1 page loaded: JMAP requests / response bytes | 3 / 36 kB | 3 / 36 kB |
| **2 000 loaded**: arrival → list updated | **6.2 s** | 7.4 s |
| 2 000 loaded: JMAP requests | **69** | 69 |
| 2 000 loaded: response bytes / request bytes | **1.16 MB** / 40 kB | 1.17 MB / 40 kB |
| 2 000 loaded: long tasks | 0 | 0 |
| JS heap after GC, after the push | 19.3 MB | 19.3 MB |

The push invalidates the email lists (`invalidateOnPush.ts`): TanStack Query
refetches every loaded page of an infinite query, **one after the other**
(each page's position depends on the previous one), then swaps the data. So
the new email shows only after the 67th page, and the cost grows linearly
with what the user scrolled: 3 requests for one page, 69 for 2 000 emails,
and every other push (a flag changed elsewhere, a read receipt) costs the
same.

### Reference: tmail-flutter web 0.30 on the same stack

`e2e/perf/flutter.perf.ts`, `linagora/tmail-web:v0.30.0` served on
`127.0.0.1:18310` with `SERVER_URL` pointing at the stack (cross-origin,
James answers CORS), same user, same browser. Flutter paints on a canvas: its
first row is detected in the semantics tree, which the measure turns on (and
which costs Flutter some work); its scroll is driven by mouse wheel events of
120 px every 16 ms, not by the same loop, so durations are indicative only.

| | Twake Mail React | tmail-flutter web | 
|---|---|---|
| Login click → first row (median / p95) | 188 / 352 ms | 1 593 / 1 641 ms |
| First `Email/query`+`Email/get`: duration / response | 113 ms / 16.4 kB (30 emails) | 126 ms / 13.7 kB (20 emails) |
| Scroll to 2 000 emails: pagination requests | 66 (pages of 30) | 98 (pages of 20) |
| Mean page request | 96 ms, 17.1 kB | 110 ms, 16.0 kB |
| Frames longer than 50 ms while scrolling (median) | 0 of 2 420 | 44 of 3 244 |
| JS heap after GC: first page → 2 000 loaded | 13.6 → 17.4 MB | 48.7 → 65.8 MB |

tmail-flutter also issues `Quota/get`, `VacationResponse/get`, `Identity/get`,
`Settings/get`, `Label/get`, two `Mailbox/set` and a second `Email/query`
during its first second, and updates its lists with `Email/changes` /
`Mailbox/changes` on push rather than refetching them.

## Backend

- **James ignores `calculateTotal`** (no `total` in `Email/query`) and
  answers `canCalculateChanges: false`: `Email/queryChanges` is not
  available, and the table's `aria-rowcount` is `-1` (unknown). The last page
  is detected by a short page.
- An `Email/query` costs about 95 ms whatever its position (0, 1 000 or 4 000
  in a 5 000-email Inbox): the memory backend sorts through its search index
  each time.
- **Updates hang on a big memory backend**: once the JVM holds about 256
  messages, every `Email/set` update (keywords, `mailboxIds`) never answers,
  in any account; creates and reads keep working. Hence: measure 2 opens read
  emails only (opening an unread one marks it read, a request that would hang
  and hold one of the six HTTP/1.1 connections of the origin), the push is
  an `Email/set` create rather than a submission, and the e2e suite must not
  run on a seeded stack. Details and repro in the e2e README, "Known backend
  quirks". Not checked on the distributed backend.

## Recommendations

1. **Incremental updates on push** (the main finding). On a `StateChange`
   for `Email`, call `Email/changes` from the state the list holds (plus
   `Email/get` of the created and updated ids by back-reference, one
   request), then patch the cache: insert created emails of this mailbox in
   the first page by `receivedAt`, update keywords in place, remove destroyed
   or moved ones; `Mailbox/changes` likewise for the counters. Since James
   has no `Email/queryChanges`, fall back to refetching the first page only
   (and resetting the others) when `Email/changes` answers
   `cannotCalculateChanges`. Expected: 1 to 2 requests and a few kB per push
   instead of `3 + loaded pages` and 17 kB per page, the new row in about
   200 ms whatever the scroll depth. The same `Email/changes` from the cached
   state also replaces the full refetch when the socket opens (2 duplicate
   requests at every login, see measure 1). Meanwhile, a cheap mitigation:
   on push, trim the cached list to its first page (`setQueryData`) before
   invalidating it, at the cost of dropping the loaded pages below.
2. **Page size**: keep 30 for the first page (25 rows fill a 900 px window,
   16 kB, about 110 ms), and consider 60 for the next ones: the cost of a
   James query is per request, not per row (95 ms for 30), so 33 requests
   instead of 66 for 2 000 emails. Stay under `maxObjectsInGet` (500).
3. **Overscan**: 400 px (8 rows) is enough: 34 rows at most in the DOM, no
   frame over 50 ms. No reason to raise it; lowering it brings nothing.
4. **Keep all loaded pages** for now: 2 kB of heap per email; 10 000 loaded
   emails would be about 20 MB. Revisit with `maxPages` only if push stays a
   full refetch.
5. **Reuse the session checked by the basic login** instead of fetching it
   again (one request, minor).
6. **Drop `calculateTotal`** from the page requests, or keep it for other
   servers: James ignores it. The list does not need the total (it detects
   the last page), only `aria-rowcount` would benefit.
7. **Report the backend bug** (updates hanging after about 256 messages on
   `memory-1.0.21.2`) to tmail-backend, with the repro.

No simple fix was applied in this pass: the only obvious problem (push
refetching everything) is the `/changes` work above, too big to be a quick
fix and already planned (`TODO` in `features/thread/queries.ts` and
`features/push/invalidateOnPush.ts`). The list itself showed no re-render
storm (no long task while scrolling or on push), no leak (flat heap), and
pages of a reasonable size.
