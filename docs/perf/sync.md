# Incremental synchronization on push

Push no longer refetches the email lists: the cache follows the server from
`Mailbox/changes` and `Email/changes`. Measured on 2026-10-04 with the same
setup and method as [`phase0.md`](phase0.md) (production build, end-to-end
stack, 5 000 emails in the Inbox, 5 runs, median and p95 = worst of 5), first
on `main` before the change, then on the change, each on a fresh stack.

## What changed

On a `StateChange` of the push WebSocket (`features/push/pushSync.ts`):

1. One JMAP request per round (`fetchChanges.ts`): `Mailbox/changes` from the
   state of the cached mailboxes, then `Mailbox/get` of its `/created` and
   `/updated` ids by back-reference; `Email/changes` from the state of the
   cached list pages, then `Email/get` of its `/created` and `/updated` ids
   with the list properties. Only the types the push names, and only when
   the cache is not already at the pushed state.
2. The cache is patched (`thread/patchEmailList.ts`,
   `mailbox/patchMailboxes.ts`, `email/patchEmailDetail.ts`): every loaded
   page of every list (keywords and mailboxes updated in place, emails that
   left the mailbox or were destroyed removed, emails that entered it
   inserted where `receivedAt` sorts them when that place is within the
   loaded pages), page positions shifted so that the next page starts at the
   right place, the counters of the mailboxes, the opened email.
3. Each list page and the mailbox list keep the state they are up to date
   with. A page fetched while a patch was applied (TanStack Query builds the
   result of `fetchNextPage` on the pages it started from) comes back with an
   older state and triggers one more round.
4. Fallback, since James has no `Email/queryChanges`: when `/changes` fails
   (`cannotCalculateChanges`, an unknown state answered `invalidArguments`)
   or still has more changes after 5 rounds, each list is cut to its first
   page and refetched, the mailboxes are refetched.

The first opening of the WebSocket reloads nothing any more; a reconnection
catches up through the same `/changes` round. Since issue #43, the first
opening reads the current states (see "Gaps" below).

## Results

| | before (median / p95) | after (median / p95) |
|---|---|---|
| **5. push, 2 000 emails loaded: arrival → list updated** | **7 049 / 7 250 ms** | **32 / 36 ms** |
| 5. JMAP requests | 69 | 1 |
| 5. response bytes | 1 166 kB | 2.0 kB |
| 5. request bytes | 39.6 kB | 1.5 kB |
| 5. JS heap after GC, after the push | 19.4 MB | 17.5 MB |
| 5b. push, 1 page loaded: arrival → row shown | 242 / 295 ms | 45 / 68 ms |
| 5b. JMAP requests / response bytes | 3 / 35.9 kB | 1 / 2.0 kB |
| 1. login → first row | 205 / 320 ms | 188 / 286 ms |
| 1. JMAP requests until the list is idle | 4 | 3 |

The cost of a push no longer depends on how far the user scrolled. After login, the three requests
are `Mailbox/get`, the first page and the second page the list preloads
(fewer than 10 rows below the visible ones); the reload of the tree and of
the first page when the socket opened is gone. Scrolling, reading and folder
switches (measures 2 to 4) did not move.

## Limits

- A list that is not loaded is not patched: it is fetched when shown.
- An email entering a mailbox below the loaded pages is not inserted (the
  list does not know where it goes); it comes with the next page, at its
  place, since the positions before it did not move (issue #43, below).
- `staleTime` is still 30 s: a list shown again after 30 s is refetched
  (all its loaded pages) although push keeps it up to date. It could become
  `Infinity` while the push channel is open.
- Measured on the memory backend of the e2e stack; the update hang of that
  image after about 256 messages (see `phase0.md`, "Backend") does not
  concern this measure, whose push is an `Email/set` create.

## Conversations (issue #11)

Conversations are on by default. A list of conversations of a mailbox
(`collapseThreads`) used to be queried again on every push (its loaded
window, `refreshQueryList`), and to start over from its first page beyond
256 rows. Each page now keeps the members of the threads it lists
(`Thread/get` and `Email/get` of their emails, in the request of the page),
and push patches the list from them (`thread/patchThreadList.ts`): a reply
updates the members of its conversation and moves the row to where its
newest email in the mailbox sorts. A conversation the list does not know
yet (a new one, or one below the loaded rows that a reply brings up) needs
its members: one more request, `Thread/get` + `Email/get`, shared by every
list.

Measured on 2026-10-05 with `e2e/perf/threads.perf.ts` (`PERF-04`):
production build, end-to-end stack, 5 000 emails in the Inbox seeded with
`PERF_THREADS=1` (30 % replies), 2 000 conversations loaded by scrolling,
then one push; 5 runs, median (p95), before the change (`main`, the
"Thread" setting turned on) and after it, each on a fresh stack.

| push with 2 000 conversations loaded | before | after |
|---|---|---|
| Reply to a loaded conversation: JMAP requests | 69 (68 `Email/query`) | 1 (no `Email/query`) |
| Reply to a loaded conversation: response bytes | 1 258 kB | 2.0 kB |
| Reply to a loaded conversation: arrival → list updated | 177 (239) ms | 102 (126) ms |
| Reply to a conversation below the loaded rows (first run) | 69 requests, 1 258 kB | 2 requests, 3.0 kB, 173 ms |
| New conversation: JMAP requests | 69 | 2 |
| New conversation: response bytes | 1 258 kB | 2.8 kB |

Before, the list was cut to its first page and refetched, then the table,
still scrolled 2 000 rows down, fetched the 67 other pages again one after
the other. After, the loaded rows stay. The "below the loaded rows" case is
measured on the first run only: the following runs reply to the same
conversation, by then at the top.

Search results grouped by conversation still cannot be patched alone (no
`Email/queryChanges`): a change to an email of a conversation they list
(read, starred, a new reply) is applied to its members in place, but an
email of another conversation still queries the loaded window again, with
the 256-row limit.

## Gaps (issue #43)

What the server could not do, probed on the end-to-end stack
(tmail-backend `memory-1.0.21.2`):

- `Email/query` refuses `anchor` (`invalidArguments`: "not supported by the
  server") and gives no `total`, even with `calculateTotal`: a page cannot be
  anchored on the last row loaded, and `isLast` only says that a page came
  back short. It caps `limit` at 256, and answers 8 queries of 256 in one
  request.
- `Email/get` and `Mailbox/get` of no id (`ids: []`) give the current state.
- Its date filters cannot tell whether one email matches a search (`after`
  is exclusive, an `OR` of date ranges matches everything): the client
  decides alone what it can, and queries the results again for the rest.

What changed:

1. **Below the loaded rows.** An email strictly older than the last row
   loaded comes with the next page, at its place: the positions before it
   did not move. The only hole was an email received the same second as the
   last row: the server may sort it before that row, then the next page
   started one row too early (a duplicate) and the email was never listed.
   It is now inserted at the end of the loaded rows (`patchEmailList`, as
   `patchThreadList` already counted it within them), so that the rows
   loaded cover it whatever the order the server gives equal dates; the list
   shows each email once (`flattenPages`). Left: an equal date with rows not
   loaded yet, whose order only the server knows.
2. **Before the first opening of the WebSocket.** The lists loaded before
   the channel opened are at the state of their load, and a change made
   meanwhile is pushed to nobody. When the channel first opens, one request
   reads the current states (`Email/get` and `Mailbox/get` of no id,
   `fetchCurrentStates`) and hands them to the synchronization as a push
   would: the cache catches up when it is behind, and a list landing later
   at an older state catches up too. The app has no `/eventSource`
   connection (WebSocket only); `Label` changes made in that gap still wait
   for the next one.
3. **Grouped search.** A change of an email the results do not list used to
   query the loaded window again, and beyond 256 rows to start the list over
   from its first page (the scroll lost). Now:
   - the client tells what it can of the filter (`filterVerdict`: folders,
     keywords, attachment, dates, in three-valued logic, words and addresses
     left to the server): an email that cannot match (in the Trash or Spam,
     which a search leaves out by default; not starred for a starred search…)
     changes nothing, without a request;
   - otherwise the window is queried again by chunks of 256 in one request,
     up to 2 048 rows (`refreshQueryList`): the loaded rows and the scroll
     position stay.

Measured on 2026-10-05 with the method above (production build, end-to-end
stack, 5 runs, median (p95)), on `main` then on the change, each series on a
fresh stack: `e2e/perf/mailbox.perf.ts` (measures 1 and 5, 5 000 emails, one
row per email: conversations are the default since, so PERF-01 now sets the
setting off to read one email) and `e2e/perf/threads.perf.ts` (`PERF-05`,
seeded with `PERF_THREADS=1`: a search for "Topic", which every seeded
conversation matches, 400 conversations loaded by scrolling, then one push).

| | before | after |
|---|---|---|
| 6. push of an email in the Trash during the search: JMAP requests | 3 | 2 |
| 6. … `Email/query` calls | 1 | 0 |
| 6. … response bytes | 66.3 kB | 2.3 kB |
| 6. … arrival → requests settled | 373 (379) ms | 123 (132) ms |
| 6. … rows loaded after the push (424 before) | 30 | 424 |
| 6. … scroll moved | 17 746 px (back to the top) | 0 |
| 6. push of an email of another subject in the Inbox: JMAP requests | 4 | 4 |
| 6. … `Email/query` calls | 1 | 1 (2 chunks of 256) |
| 6. … response bytes | 67.2 kB | 6.2 kB |
| 6. … arrival → requests settled | 369 (372) ms | 220 (222) ms |
| 6. … rows loaded after the push (424 before) | 30 | 424 |
| 6. … scroll moved | 17 746 px | 0 |
| 5. push, 2 000 loaded: arrival → list updated | 111 (117) ms | 112 (114) ms |
| 5. JMAP requests / response bytes | 2 / 2.3 kB | 2 / 2.3 kB |
| 1. login → first row | 239 (359) ms | 223 (306) ms |
| 1. JMAP requests until the list is idle | 7 | 8 |

Before, the search was cut to its first page and refetched (the 30 rows of
the first page, 66 kB), the user sent back to the top. After, an email that
cannot match costs its changes only; one the client cannot tell queries the
424 rows again in two chunks of 256, the rows and the scroll staying. Measure 5 did not move. Measure 1 has one more
request, the current states read when the channel first opens. Measures 1 and
5 count more requests than in the first table: the identities, settings,
labels and quota the app loads since, and the `Quota/get` a push of emails
brings.

