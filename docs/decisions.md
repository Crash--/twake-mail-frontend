# Decisions

Decisions taken on Mail, oldest first. The log starts on 2026-11-20 with the recent decisions. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Format and categories: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines).

## 2026-11-18, [UI] Subject and preview share one line in the email list

- Decision: on desktop, a row of the email list shows the subject and the preview on one line, the subject taking at most 55% of the row's width once the icons, avatar, date and actions are taken off; the full rule is in [`UX.md`](../UX.md#email-list-row).
- Decided by: Swann Maillard (design), Matrix conversation with Quentin, 2026-11-18
- Why: rule set by the design team for the list.
- Scope: desktop, email list. Mobile keeps its current row.

## 2026-11-19, [UI] Composer fields keep the 500 weight of body2

- Decision: the composer's fields (recipients, subject, body) and the selects of the rules use body2, Inter 500 as in Figma, at every width; only their size changes, 16 px under `md` and 14 px from `md`.
- Decided by: Quentin (maintainer), [#1064](https://github.com/Crash--/twake-mail-frontend/pull/1064)
- Why: 16 px under `md` stops iOS Safari from zooming on focus, and the fields keep the weight of the mockups.
- Scope: desktop and mobile, composer and rules.

## 2026-11-19, [UX] A prefilled new message opens on the subject

- Decision: a new message that opens with its recipients (a `mailto:` link, "Edit as new", "Compose email" from a contact card, "Contact the participants") puts the focus on the subject when it is empty, else on the body, never in To.
- Decided by: Quentin (maintainer), [#1068](https://github.com/Crash--/twake-mail-frontend/pull/1068), from [#1062](https://github.com/Crash--/twake-mail-frontend/issues/1062)
- Why: the recipients are already there; the next thing to write is the subject or the body.
- Scope: desktop and mobile, composer.

## 2026-11-19, [UI] Recipients beyond three rows fold into a "+N" chip

- Decision: a prefilled new message opens its recipients folded on one line with "+N", as replies do; unfolded, To shows at most three rows and a "+N" chip that shows them all.
- Decided by: Quentin (maintainer), [#1068](https://github.com/Crash--/twake-mail-frontend/pull/1068), from [#1062](https://github.com/Crash--/twake-mail-frontend/issues/1062)
- Why: with hundreds of recipients, nothing showed that the addresses were all there.
- Scope: desktop and mobile, composer.

## 2026-11-19, [Product] Off the Workplace, the app grid comes from app_dashboard.json

- Decision: when Mail runs without a Twake Workplace, the top bar lists the apps of `app_dashboard.json` if `APP_GRID_AVAILABLE` is `supported`, with the same file and format as tmail-flutter web.
- Decided by: Quentin (maintainer), [#1074](https://github.com/Crash--/twake-mail-frontend/pull/1074), from [#1071](https://github.com/Crash--/twake-mail-frontend/issues/1071)
- Why: without a Workplace token the header had no way to the other Twake apps, and the tmail-frontend chart already writes that file.
- Scope: desktop, header.

## 2026-11-19, [UI] Composer fields keep 16 px on touch screens past md

- Decision: Replaces the decision of 2026-11-19, "Composer fields keep the 500 weight of body2". The composer's fields, the selects of the rules and the editors of the settings are 14 px from `md` with a mouse (`not (pointer: coarse)`), and 16 px under `md` or on a touch screen of any width. The composer's fields and the selects of the rules keep the 500 weight at every width; the editors of the settings keep the weight of the page's text.
- Decided by: Quentin (maintainer), [#1083](https://github.com/Crash--/twake-mail-frontend/pull/1083), following the twake-mui field rule proposed in [linagora/twake-ui#258](https://github.com/linagora/twake-ui/pull/258) (open)
- Why: iOS Safari zooms into any field under 16 px, and a tablet or a phone held sideways is past `md`.
- Scope: desktop and mobile, composer, rules and settings editors.

## 2026-11-20, [Product] Remote images load by default

- Decision: emails show their remote images and third-party content by default; "Block remote images and third-party content" in Settings > Preferences > Privacy, off by default, turns blocking on; while the user's setting is unknown (not read yet, its read failed, or no settings on the server), remote images load.
- Decided by: Quentin (maintainer), [#1086](https://github.com/Crash--/twake-mail-frontend/pull/1086), from [#1085](https://github.com/Crash--/twake-mail-frontend/issues/1085)
- Why: blocking by default made every user allow images email after email.
- Scope: desktop and mobile, email view and settings.

## 2026-11-20, [UI] Destructive actions in red, last in menus

- Decision: a destructive action shows its label and icon in the error colour of the twake-mui theme, sits at the bottom of its menu below a divider, and is one word when possible; a reversible one shows a snackbar with Undo, an irreversible one asks in a confirmation dialog first. State on 2026-11-20: on `main` these labels are grey, because MUI 9 drops `error.dark` from the `color` prop of Typography; [#1084](https://github.com/Crash--/twake-mail-frontend/pull/1084), waiting for merge, draws the labels in `error.dark` and leaves the icons as they are.
- Decided by: Swann Maillard (design), Matrix conversation with Quentin, 2026-11-20; applied in [#1084](https://github.com/Crash--/twake-mail-frontend/pull/1084)
- Why: shared rule of every Twake app, written in the `twake-ux` skill.
- Scope: desktop and mobile (provisional default of `twake-ux`), the email, folder, label and composer menus.

## 2026-11-20, [UI] Pending: shade and icon of destructive actions

- Options: `error.main` on the label and the icon, the provisional default of `twake-ux` and what Drive does; or `error.dark` on the label only, what [#1084](https://github.com/Crash--/twake-mail-frontend/pull/1084) does.
- To decide: Swann Maillard (design), asked by Quentin.
- Why it matters: #1084 and the shared rule differ on both points.
- Scope: desktop and mobile, every Mail menu with a destructive action.

## 2026-11-20, [Product] Pending: Sent listed mail by mail or by conversation

- Options: list Sent (and probably Drafts and Outbox) mail by mail whatever the conversations setting, as tmail-flutter does by default; or keep conversations everywhere, so an older sent mail is only found inside its conversation.
- To decide: the Product team; Quentin (maintainer) takes the question to them. Source: analysis of 2026-11-20 by the Mail team (sent mails missing from Sent are the first sends of conversations that have a later send).
- Why it matters: with conversations on (the default), Sent shows one row per conversation, at the date of its latest send.
- Scope: desktop and mobile, Sent list.

## 2026-11-22, [UX] The floating Compose button folds while the content scrolls

- Decision: on phones and tablets, the floating "Compose" button folds to a square with its icon alone while the content scrolls, and unfolds with its label once the scrolling has stopped for 250 ms; the label slides away (no animation when the system asks for less motion) and stays the accessible name. Any content the user scrolls folds it (wheel, finger and its momentum, scroll keys), not the email list alone; a list that scrolls itself back to where it was (back from an email) does not.
- Decided by: Swann Maillard (design), [#886](https://github.com/Crash--/twake-mail-frontend/issues/886), for the fold while scrolling; Crash-- (CTO), [#1124](https://github.com/Crash--/twake-mail-frontend/pull/1124), for the 250 ms delay and the fold on any scrolling content
- Why: the unfolded button hides part of the list while the user scrolls through it.
- Scope: mobile and tablet, email lists and the team mailbox facade.

## 2026-11-22, [UI] The empty email list is a 100 px tile with an open envelope

- Decision: every empty email list (a folder, a filter, Starred, Action required, a label, a search, offline) shows the white `EmailOpen` glyph of twake-icons in a 100 px tile in `action.selected`, the size the Twake Space empty states use today, where the TwakeSpace mockup draws a 200 px tile; then the title and the hint of the view, centred on desktop and on a phone alike, where the phone showed them at the top before.
- Decided by: Pending, Crash-- (CTO) to confirm the 100 px size; applied in [#1122](https://github.com/Crash--/twake-mail-frontend/pull/1122), from [#900](https://github.com/Crash--/twake-mail-frontend/issues/900)
- Why: the empty list takes the look of the Space empty states; the tile becomes `iconLook="tile"` of `Empty` with [linagora/twake-ui#241](https://github.com/linagora/twake-ui/pull/241).
- Scope: desktop and mobile, email lists.

## 2026-11-22, [UI] Email rules are compact grey rows

- Decision: the rules of Settings > Email rules are compact rows, 628 px at most as the other settings lists, their first condition in a small outlined `Chip` that never hides the name, and outlined 16 px icons for move up, move down, edit and delete. Each row keeps the grey background of the former cards (`background.default`), 8 px apart, without dividers. The condition lines of the rule dialog keep their grey background too.
- Decided by: Swann Maillard (design), [#893](https://github.com/Crash--/twake-mail-frontend/issues/893), for the compact rows and the outlined icons; grey background kept, decided by Crash-- (CTO) on 2026-11-22: the issue only asked for compact rows and outlined icons.
- Why: the full-width cards with large filled icons did not match the other settings sections.
- Scope: desktop and mobile, Settings > Email rules. On a phone the row keeps its name and "More" only.

## 2026-11-23, [Infra] A change to the decisions log alone runs no CI

- Decision: a pull request whose changes are only `docs/decisions.md` starts no lint, unit tests, E2E, image build or Helm chart check; neither does a push to main of that file alone, except the image, which every commit of main and every tag still gets. A code pull request rebased to resolve a conflict in the log runs everything, its diff holding its code.
- Decided by: Crash-- (CTO), request of 2026-11-23 to the Mail team
- Why: those runs test code that did not change.
- Scope: GitHub Actions of the repository.

## 2026-11-22, [UI] Preferences start with an icon on desktop only

- Decision: on desktop, each switch of Settings > Preferences starts with its icon in twake-mui's rounded `Avatar` (32 px, a 20 px glyph, as the Figma); phones and tablets keep the rows without icons.
- Decided by: Swann Maillard (design), [#894](https://github.com/Crash--/twake-mail-frontend/issues/894); applied with the go of Crash-- (CTO).
- Why: the page reads as one long list of switches on desktop; on a narrow screen an icon would take room from the text and make the rows wrap.
- Scope: desktop, Settings > Preferences.

## 2026-11-22, [UI] Pending: colours of the preference icon tile

- Options: [#1126](https://github.com/Crash--/twake-mail-frontend/pull/1126) puts the tile on `border.main` (Grey 900 at 16 %, the closest token to the Figma's `#D9D9D9`; white at 24 % in dark mode) with the glyph in `text.icon`; or `action.selected` (Grey 900 at 8 %), lighter than the Figma; or the white glyph of the Figma, which no token keeps readable in dark mode.
- To decide: Swann Maillard (design).
- Why it matters: twake-mui's only grey tile (`Avatar` `disabled`) is a fixed `#d6d8da`, light in dark mode too, so the tile has to be built on palette tokens.
- Scope: desktop, Settings > Preferences.
