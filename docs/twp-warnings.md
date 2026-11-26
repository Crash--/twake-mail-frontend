# Backend warnings (`X-TWP-Message`, `X-Suspicious-*`)

Issue #142. Contract taken from tmail-flutter#4484 and its pull request
tmail-flutter#4639 (closed without merge).

## Header

One header per warning, several per email:

    X-TWP-Message: level:warn code:virus Text sent by the server

- `level:` and `code:` are optional leading tokens, in any order and any
  case; the rest is the text of the server. Level `info` (default for a
  missing or unknown level), `warn`, `error`.
- Fetched with `header:X-TWP-Message:asText:all` in the detail query of an
  email only (`features/email/queries.ts`), never in list queries.
- Parser and rules: `features/email/twpWarnings.ts` (tests ported from
  tmail-flutter, plus a cap of 500 characters and control characters dropped).

## Suspicious sender headers

The tmail-backend matchers `SuspiciousDisplayName` (the From display name is
the name of a user of the directory, the address is not theirs) and
`SuspiciousDomainInDisplayName` (the display name names a local domain) set no
header themselves: the mailet container does, with `SetMimeHeader`. The
backend docs set `X-Suspicious-DisplayName: true` and `X-Suspicious-Domain:
true`; a deployment may set `X-Suspicious-DisplayName: true` for both.

- Both are asked with `asText` next to `X-TWP-Message`.
- Either one set to `true` (any case) adds one `suspicious-sender` warning at
  the `warn` level (the contract example uses `info`; a likely scam calls
  for more), after the `X-TWP-Message` warnings: its index, and so its
  dismissal keyword, is the number of `X-TWP-Message` headers.
- Nothing is added when an `X-TWP-Message` header already has the code
  `suspicious-sender`, so one email never shows the same warning twice.

## Display

`features/email/TwpWarningBanners.tsx`, between the header and the body, in
the single email view and in each expanded message of a conversation.

- Title by level (translated): "About this message", "Be careful with this
  message", "This message may be dangerous"; the level is also said in words
  before it for assistive technology (not by colour alone).
- Description: localized text for the known codes `suspicious-sender`,
  `virus`, `virus-removed` (English texts of tmail-flutter, other languages
  translated by hand: fr, ru, vi to be reviewed); any other code or none: the
  text of the server, rendered as text by React (no HTML, no link), cut at
  500 characters.
- An error-level warning that is not dismissed replaces the sender avatar by
  a red warning badge (single view and expanded messages).
- Static content: a labelled `group`, not a live region.

## Dismissal

Dismissing sets the keyword `twp-warning-dismissed-<index>` (index = position
among the `X-TWP-Message` headers, from 0, then the suspicious sender warning
above) with the usual email action path (`setKeyword` of `useEmailActions`):
shown at once, rolled back with an error toast if the server refuses. The
button is absent when the folder has no `maySetKeywords` right (team
mailboxes, `docs/team-mailboxes.md`) or while the folders are loading, and
disabled offline.

## Decisions where the contract is silent

- "Not spam" (Figma): offered on an **error-level** banner when the email is
  **in the Spam folder** (`offersNotSpam`), by the existing "Remove from spam"
  action (needs `mayRemoveItems`). The Figma frame shows the action on a
  message that is in the Inbox: what "Not spam" should do there is an open
  question.
- Attachment block: nothing is blocked. `ds/InlineAlert` exists but is not
  mounted and has no translation: no contract says which codes block
  downloads, nor whether "Not spam" lifts it.
