# Composer drafts: local first

Policy of the composer drafts ([#134](https://github.com/Crash--/twake-mail-frontend/issues/134),
asked by the tmail-backend lead). Code: `common/src/features/composer/`
(`draftPolicy.ts`, `composerStorage.ts`, `draftLocks.ts`, `ComposerProvider.tsx`,
`ComposerForm.tsx`). Tests: `draftPolicy.spec.tsx`, `composerStorage.spec.ts`,
`e2e/tests/composer-drafts.spec.ts` (`CMP-64` to `CMP-70`).

## Why

A JMAP email is immutable (RFC 8621: only `keywords` and `mailboxIds` can be
updated). Saving a draft whose body changed is therefore one `Email/set` create
plus one `Email/set` destroy of the previous version (two requests, the destroy
only once the creation succeeded: see `saveDraft`). Done at every pause in the
typing, it turns a read heavy workload into a write heavy one and leaves a
tombstone per save in Cassandra. There is no in-place update to use: the only
lever is to write less often.

Before: 1.5 s after the last change, the draft was created and the previous one
destroyed. Typing for two minutes with a pause every ten seconds (`CMP-64`)
produced 12 creations and 11 destructions, 23 writes, for one message.

## Policy

| What | Where | When |
|---|---|---|
| Typing (body, subject, recipients, options, identity, attachments added or removed, recipient fields not yet validated) | IndexedDB of the browser | `LOCAL_SAVE_DELAY_MS` (0.8 s) after the last change, and a best effort write on `pagehide` and when the tab is hidden. A message nobody typed in (a new one, an untouched reply) is not kept |
| Draft | JMAP server | `DRAFT_IDLE_MS` (5 minutes) after the last change, **and** only if the message differs from the last version saved (fingerprint of identity, recipients, subject, body, attachments, options) |
| Draft | JMAP server | "Save draft" (More menu): at once |
| Draft | JMAP server | Closing a composer with changes: the dialog "Save message" / "Discard" asks; "Save" writes. Nothing is lost silently, and nothing is written without the user's answer (as tmail-flutter) |
| Draft | JMAP server | Signing out (account menu): the open composers with changes the server does not have are saved first, one draft each (at most `MAX_COMPOSERS`), waiting 8 s at most |

A composer restored from the browser whose message never reached the server is
treated as having unsaved changes: closing it asks "Save message" / "Discard", and
the 5 minute timer starts again as it opens. One that was saved, then changed, is
compared to the version it saved.

Not done: no save on `beforeunload`. A request started while the page goes is not
reliable (and `sendBeacon` cannot carry the Bearer header), and a partial save would
leave a stale `draftId` in the browser. What was typed is in IndexedDB and comes back
(below). Signing out is different: it is a user action with time to wait, so the
unsaved changes are saved first (tmail-flutter discards the composers without
saving, ADR 0112; with a 5 minute delay that would lose too much). Writes happen on
sign out only for a composer with changes the server does not have.

Limit: the write of the `pagehide` is an asynchronous IndexedDB transaction, which the
browser may cut short (the reason of ADR 0009). The 0.8 s debounce is the real
guarantee: up to 0.8 s of typing can be lost on a hard reload or a crash, where the
synchronous `sessionStorage` write of tmail-flutter lost none on a reload.

A replacement of the server draft is always one creation and one destruction per
real save (never per keystroke). Cost for a message edited for an hour with
pauses of more than five minutes: one pair per pause, instead of one pair per
pause of 1.5 s.

## Reopening

At start (and after a reload), `ComposerProvider` reads the composers of the
account in IndexedDB and reopens, in the order they were opened, up to
`MAX_COMPOSERS`, those no other tab holds. Each reopens with its recipients,
subject, body, options, identity, the uploaded attachments and inline images
(by blob id), the id of its server draft, and where the cursor was (To or text).
Records older than 24 hours are dropped (`COMPOSER_TTL_MS`, as tmail-flutter's
24 h expiry). Replies, forwards, templates and `mailto:` composers come back as
they were; "edit as new" and "unsubscribe by mailto" composers go through the
same `ComposerInit` and are kept the same way.

## Storage and security

- IndexedDB `twake-mail-composers`, store `composers`, one record per composer,
  key `[accountId, composerId]` (the account is part of the key, a record of
  another account is never read).
- A record holds the message as the composer builds it. Attachments and inline
  images are the ids of blobs already uploaded to the server (`blobId`, name,
  type, size), never file contents. A body over 2 million characters is not kept
  (the server draft is the fallback).
- Cleared: when the composer is closed, sent or its draft deleted (`close`), and
  for every account when the session ends (`endLocalSession`, also on the
  "session ended" message from another tab). Writes still pending after a sign
  out are dropped. A session that merely expires keeps the records, for the next
  sign in (tmail-flutter ADR 0112).
- Contents are sensitive and unencrypted at rest, like any IndexedDB data of the
  origin (tmail-flutter encrypts its Hive box with a key stored beside it, which
  protects nothing against local access, so no encryption is added). Nothing is
  logged: a storage error logs the name of the error only.
- Quota or a storage disabled by the browser: the write fails, a warning without
  content is logged, the composer works, the server draft is the fallback. Where
  there is no IndexedDB (Node tests), records live in memory.

## Several tabs

Two tabs must not edit the same composer or the same draft:

- Every open composer holds a Web Lock named after it (`twake-mail-composer|account|id`)
  for as long as it is open in its tab, and a tab only reopens the composers whose lock
  it obtains (`ifAvailable`). A composer shown by tab A is not reopened by tab B, and
  tab B does not rewrite it. A composer left by a closed tab or a crash has no holder:
  the next tab to start takes it. After a reload the lock of the old page may be released
  a moment late: the request is made a second time after 500 ms.
- A server draft keeps its own lock (`twake-mail-draft|account|draftId`): one composer
  edits it, in this tab or another (the message "being edited elsewhere" otherwise).
- Browsers without Web Locks: the composers of the tab are known only, every tab reopens
  everything (documented limit, all current browsers have them).

## Flutter

tmail-flutter web has no autosave timer: the composer is written to `sessionStorage`
synchronously on `beforeunload` (ADR 0009, 0112) and restored after a reload of the
same tab, the server draft is written on "Save as draft" or when the user answers
"Save" on close. Android uses a persistent Hive cache (encrypted, 24 h, `isCleanClose`
flag) and restores the composer at the next start (ADR 0086). This implementation
follows the rules of #134 instead of ADR 0009: IndexedDB written while typing (and not
only at unload, which cannot rely on asynchronous storage), reopened in a new session
too, like Android.

## Gaps

- `jmap-client-ts` v2 has no way to update the body of a draft, nor does JMAP:
  one creation and one destruction per real save is the floor.
