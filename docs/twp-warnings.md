# Backend warnings (`X-TWP-Message`)

Issue #142. Contract taken from tmail-flutter#4639 (open).

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
among the `X-TWP-Message` headers, from 0) with the usual email action path
(`setKeyword` of `useEmailActions`): shown at once, rolled back with an error
toast if the server refuses. The button is absent when the folder has no
`maySetKeywords` right (team mailboxes, `docs/team-mailboxes.md`) or while the
folders are loading. The app has no offline detection yet (`OfflineBanner` is
not mounted), so nothing is disabled offline: the rollback covers it.

## Decisions where the contract is silent

- "Not spam" (Figma): offered on an **error-level** banner when the email is
  **in the Spam folder** (`offersNotSpam`), by the existing "Remove from spam"
  action (needs `mayRemoveItems`). The Figma frame shows the action on a
  message that is in the Inbox: what "Not spam" should do there is an open
  question.
- Attachment block: nothing is blocked. `ds/InlineAlert` exists but is not
  mounted and has no translation: no contract says which codes block
  downloads, nor whether "Not spam" lifts it.
