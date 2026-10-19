# ReDoS audit (issue #649, tmail-flutter#4224)

Audit of the regular expressions run on email content and other untrusted
strings (bodies, subjects, headers, addresses, file names, CSS, calendar
descriptions, Sentry events), done in October 2026.

## Method

- Every regex literal and `RegExp` constructor of `common/src` and
  `apps/private/src` (spec files and `testing/` excepted) was listed from the
  TypeScript AST: **186 sites**, `apps/private/src` holds none.
- Each was checked with the static analyser
  [recheck](https://makenowjust-labs.github.io/recheck/) (run with `npx`,
  not a dependency), then timed in Node 24 (V8) on the attack string it
  produced, and judged on where its input comes from.
- **159 sites are safe**: linear by construction (anchored literals,
  character classes without overlap, bounded quantifiers), or run on short
  trusted values. **27 sites were super-linear** (all polynomial, none
  exponential), plus linkifyjs, which is not a regex but has the same
  defect. All are fixed below.
- Every fix keeps the behaviour: the specs compare the new code with the
  original pattern on thousands of random texts made of the characters that
  matter (`randomTexts` in `common/src/testing/redos.ts`), and stress tests
  feed 50 000+ characters of each attack string, which must take less than
  `STRESS_TIME_LIMIT_MS` (1 s; a few milliseconds measured).

## Fixes

Timings: the original pattern on its attack string, before / after the fix
(Node 24, the "after" measured through the public function).

| Location | Pattern (before) | Input | Before | After | Fix |
|---|---|---|---|---|---|
| `composer/recipients.ts` `parseRecipients` | `(?:"…"\s*\|'…'\s*\|([^,;<>"'@\n\r\t]*?)\s*)<([^<>]*)>\|([^\s,;<>]+)` | pasted or typed recipients, `mailto:`, forward and rule addresses | > 20 s for 20 000 spaces (cubic) | 41 ms for 50 000 | hand-written tokenizer: each run of name characters and of spaces is read once |
| `email/addresses.ts` (spoofed display name) | `[^…]+@[^…]+\.[^…]+` (g) | sender display names | 1.7 s / 20 000 chars | 0.7 ms / 50 000 | tried on run starts only, skipping the run after a failure (`utils/linearMatch.ts`) |
| `composer/replyRecipients.ts` (`List-Post`) | `^\s*<?mailto:([^?>]*)(?:\?([^>]*))?>?\s*$` | `List-Post` header | 1.4 s / 20 000 | 0.7 ms / 50 000 | trim first, no `\s*$` after `[^>]*` (the addresses were trimmed anyway) |
| `email/sanitizeCss.ts` comments | `\/\*[\s\S]{0,20000}?\*\/` (g) | `style` attributes and elements | 0.8 s / 20 000 (20 000 × n) | 2 ms / 60 000 | `removeComments`: `indexOf` loop, same 20 000 bound |
| `email/sanitizeCss.ts` `url()` | `url\(\s*(['"]?)([^'")]*)\1\s*\)` (gi) | CSS values | 0.8 s / 20 000 | 17 ms / 80 000 | `urlArguments`: scanner with a remembered next quote or parenthesis |
| `email/sanitizeCss.ts`, `email/imageSize.ts` | `\s*!\s*important$`, `\s*!important$` (×3) | CSS values | 1.7–2.1 s / 20 000 | 1 ms / 50 000 | `(?<!\s)` before `\s*` |
| `email/imageSize.ts` | `^(\d*\.?\d+)([a-z]*)$` | image `width` / `height` | 4.9 s / 20 000 | 2 ms / 50 000 | `^(\d+(?:\.\d+)?\|\.\d+)([a-z]*)$` |
| `composer/emailHtml.ts` `toStorageHtml` | `<img([^>]*?)src="blob:[^"]*"([^>]*?)data-reference="([^"]+)"` (g) | editor HTML (quoted emails) | 0.7 s / 50 000 | 0.4 ms / 100 000 | `indexOf` matcher; a failed `<img` skips the next ones before its `>` |
| `composer/emailHtml.ts` `htmlToText` | `[ \t]+$` (g) | text lines | 4.3 s / 50 000 | linear | `(?<![ \t])` |
| `calendar/calendarEvent.ts` `descriptionText` | `<[a-z][^>]*>` (test) | invitation description | 2.3 s / 50 000 | 0.7 ms / 50 000 | `hasMarkup`: first `<letter`, then any `>` after it |
| `calendar/calendarEvent.ts` `descriptionText` | `[ \t]+\n` (g) | invitation description | 8.8 s / 50 000 | 0.8 ms / 50 000 | `(?<![ \t])` |
| `email/emlFileName.ts` | `^[\s.]+\|[\s.]+$` (g) | subject | 1.8 s / 20 000 | 0.6 ms / 50 000 | `(?<![\s.])` on the second branch |
| `email/autolink.ts` | `[»”’›]+$` (u) | linkified text | 1.4 s / 20 000 | linear | `(?<![»”’›])` |
| `email/autolink.ts` (linkifyjs 4.3.3, not a regex) | `find(text)` | text nodes of the bodies | 10 s for 50 000 chars of `a-a-…` | 2 ms | runs of more than 2 048 non-space characters stay text (see below) |
| `utils/scrubSensitiveData.ts` | e-mail, URL with query, JWT patterns (g) | Sentry events | 0.5–1.8 s / 20 000 | 1–5 ms / 56 000 | tried on run starts only, skipping the run after a failure |
| `utils/scrubSensitiveData.ts` `scrubPath` | `\/(download\|upload)\/.*$` | URLs in Sentry events | 0.2 s / 20 000 | 5 ms / 56 000 | searched on the last line only |
| `search/searchFilter.ts`, `paywall/paywallUrl.ts` | `^[^\s@…]+@[^\s@…]+\.[^\s@…]+$` | typed search, owner address | 0.3–1.1 s / 20 000 | 0.5 ms / 50 000 | lookahead `(?=[^\s@…]+$)`, implied by the rest |
| `recovery/recovery.ts` | `(\d+)\s*day`, `(\d+)\s*hour` | vault capability | 1.1 s / 20 000 | 1 ms / 50 000 | `(?<!\d)` |
| `config/config.ts`, `config/issuerDiscovery.ts`, `calendar/calendarUrl.ts`, `drive/driveApi.ts` | `\/+$` | configuration (trusted) | 7.4 s / 50 000 | linear | `(?<!\/)` |

The lookbehind fixes rely on one argument: the leftmost match of `X+…` or
`X*…` (where what follows cannot start with an `X`) starts at the first
character of a run of `X`, so trying only the positions not preceded by an
`X` finds the same match, and each run is read once. The run-skipping
helper (`matchAllFrom`) relies on another: when the first quantifier of the
pattern could also read the characters before a later start of the same
run, a failure at the start of the run is a failure at every later start in
it.

## Length cap

linkifyjs (no regex) restarts its parser at each token of a run where it
finds no link, a time quadratic in the length of the run (`a-a-…`, `a.a.…`,
`a-a/a-a/…`). No linear rewrite is possible without forking it, so
`findLinks` blanks the runs of more than 2 048 non-space characters before
calling it (2 083 was the URL limit of old browsers): such a run is not
linked, the rest of the text is. The worst case is then linear, about 20 ms
per 2 048-character run.

## Safe, by family (159 sites)

- Anchored validators of short values (colours, dates, ids, hosts,
  `^data:image/…;base64,…$`, `^[A-Za-z0-9_-]+$`…).
- Single character classes, literals and alternations of literals
  (`/\s+/`, `/[?#]/`, `/^mailto:/i`, `/<style/i`, keyword lists).
- Bounded or deterministic patterns: the video conference markers of
  `calendarEvent.ts` (each marker without a closing one is at most a few
  overlapping ones), `LINE_HEIGHT_NUMBER`, the attachment keyword pattern,
  the e-mail validator of `recipients.ts` (labels without dots), the
  sensitive parameter and Authorization patterns of `scrubSensitiveData.ts`,
  `snippet.ts` (search highlight), `twpWarnings.ts`, `pastedDataImages.ts`,
  `linkUrl.ts`.
