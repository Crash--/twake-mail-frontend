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
- Why: the empty list takes the look of the Space empty states; the tile is `iconLook="tile"` of twake-mui's `Empty` ([linagora/twake-ui#241](https://github.com/linagora/twake-ui/pull/241), twake-mui 21.1.0) since [#1176](https://github.com/Crash--/twake-mail-frontend/pull/1176).
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
- Closed: decided on 2026-11-25, see "The preference icons are white on a neutral tile".

## 2026-11-23, [UI] The composer casts the shadow of the search filters

- Decision: the floating composer casts the shadow of the search filters panel and of the search results (elevation 8 of twake-mui, in the colour scheme shown); the dark shadows of twake-mui do not change.
- Decided by: Swann Maillard (design) and Julien (twake-ui maintainer), [linagora/twake-ui#260](https://github.com/linagora/twake-ui/pull/260#issuecomment-7094972462), 2026-11-23, following [#1043](https://github.com/Crash--/twake-mail-frontend/issues/1043)
- Why: in dark mode the composer blended into the list behind it, while the search filters panel stands out.
- Scope: desktop, composer window.

## 2026-11-23, [UI] A read collapsed message of a conversation is Regular

- Decision: in a conversation, the sender and the preview of a collapsed message are Regular (400) when it is read and Semi Bold (600) when it is unread, the rule of the email list rows. The sender keeps its 16 px `h5`, the preview its 14 px in the secondary text colour (`body3`, `subtitle2` when unread). The date and the headers of expanded messages keep their 500.
- Decided by: Crash-- (CTO), 2026-11-23; applied in [#1129](https://github.com/Crash--/twake-mail-frontend/pull/1129)
- Why: read messages showed in Medium, heavier than the read rows of the list.
- Scope: desktop and mobile, conversation view.

## 2026-11-22, [UX] A phone or a touch tablet selects emails with a long press

- Decision: on a phone, and at the tablet sizes with a touch screen (`(pointer: coarse)`), a long press on a row of the email list selects it; while emails are selected, a tap on a row selects or unselects it instead of opening it, a selected row shows a round check in place of its avatar and the selected background of the list, and the selection bar (the cross, how many, archive, delete, read or unread, then "More") takes the place of the bar, with "Select all" in the place of the search, hidden until the selection ends. The avatar still selects its row. A tablet size with a mouse keeps tmail-flutter's selection and its checked box, as do the forwarding addresses of the settings at every size.
- Decided by: Swann Maillard (design), [#887](https://github.com/Crash--/twake-mail-frontend/issues/887), for the phone; Crash-- (CTO), 2026-11-23, [#1127](https://github.com/Crash--/twake-mail-frontend/pull/1127), for the touch tablet
- Gaps to the mockup: the selected rows keep twake-mui's pale blue selected background where the mockup draws them grey, the count reads "N selected" where the mockup shows the number alone, and the selection bar and the "Select all" band are white where the mockup draws them grey-blue. Decided by: Pending, Crash-- (CTO), [#1127](https://github.com/Crash--/twake-mail-frontend/pull/1127).
- Why: in the hand, acting on several emails at once comes first; a focused bar of three actions and an overflow keeps the toolbar clear.
- Scope: mobile and touch tablet, email lists.

## 2026-11-24, [UI] The vacation start and end are twake-mui's segmented control

- Decision: "Starts:" and "Ends:" in Settings > Vacation use twake-mui's `Tabs` `segmented`: a grey track, the chosen option raised on a white pill with its label in `primary.main`, as the Figma.
- Decided by: Crash-- (CTO), from [#892](https://github.com/Crash--/twake-mail-frontend/issues/892); the chosen label became `primary.main` in twake-mui 21 ([linagora/twake-ui#267](https://github.com/linagora/twake-ui/pull/267), same change in [cozy/cozy-ui#2987](https://github.com/cozy/cozy-ui/pull/2987)); applied in [#1123](https://github.com/Crash--/twake-mail-frontend/pull/1123).
- Why: the squared toggle group did not match the design, and twake-mui ships the pill control.
- Scope: desktop and mobile, Settings > Vacation.

## 2026-11-24, [UI] Pending: semantics of the vacation segmented control

- Options: keep the semantics twake-mui gives `Tabs` `segmented` (tabs without panels, one Tab stop, the arrow keys then Enter or Space), as Twake Drive's Sharings tabs; or a radio group, which needs a segmented radio control in twake-mui.
- To decide: Crash-- (CTO).
- Why it matters: a screen reader announces tabs for what is a choice between two values.
- Scope: desktop and mobile, Settings > Vacation.

## 2026-11-24, [UX] Only the main content folds the floating Compose button

- Decision: the floating "Compose" button folds only while the user scrolls the main content (the email list, or the team mailbox pane); a menu, a dialog or the drawer that scrolls leaves it unfolded. The rest of the 2026-11-22 entry ("The floating Compose button folds while the content scrolls") holds, which this one replaces for what folds the button.
- Decided by: Crash-- (CTO), 2026-11-24, from the rule of JF-Cozy on [linagora/twake-ui#263](https://github.com/linagora/twake-ui/pull/263#discussion_r4663579965)
- Why: a menu or a dialog scrolled over the list folded the button though the list did not move.
- Scope: mobile and tablet, email lists and the team mailbox facade.

## 2026-11-24, [UX] Split view on desktops, a preference kept in the browser

- Decision: "Show the list beside the open email" in Settings > Preferences (with the conversations), off by default, keeps the email list (375 px) beside the open email from 1200 px, as on a large tablet; off, the email takes the place of the list on desktops, as before. Kept in this browser (`twake-mail.preferences.splitView`), not on the server; it applies at once, in every tab.
- Decided by: Crash-- (CTO), [#1155](https://github.com/Crash--/twake-mail-frontend/pull/1155)
- Why: some users want to keep the list in sight while they read on a computer.
- Scope: desktop, the email lists (folders, starred, action required, labels, search).

## 2026-11-25, [UI] The Drive picker loads behind the skeleton of Twake Calendar

- Decision: until the Twake Drive picker is ready to use, its dialog shows `DrivePickerSkeleton` of `@linagora/twake-app-skeleton/drive` (the Twake Drive logotype, the toolbar, rows of files), the skeleton Twake Calendar shows, instead of the Drive logo and wordmark; the picker then takes the same box, without a jump.
- Decided by: Crash-- (CTO), [#1167](https://github.com/Crash--/twake-mail-frontend/issues/1167)
- Why: Mail and Calendar open the same picker and show the same skeleton while it loads.
- Scope: desktop and mobile, "Attach from Drive" in the composer.

## 2026-11-25, [UX] The spam report follows the account of the folder shown

- Decision: the spam report banner counts the unread emails of the Spam of the account the list shows: the user's own Spam in a personal folder and in search results; in a team mailbox, its own Spam folder (found by name, "Spam" or "Junk", under its root), and no banner when it has none (James creates none); no banner in a folder another user shares. "View" and the close button act on that Spam.
- Decided by: chibenwa, [#1178](https://github.com/Crash--/twake-mail-frontend/issues/1178)
- Why: the user's own Spam has nothing to do with the team mailbox they are reading.
- Scope: desktop and mobile, the email lists.

## 2026-11-25, [Product] The release notes users see live in release-notes/

- Decision: the "What's new in Twake Mail" dialog shows the notes of `release-notes/<language>.md` (English and French), which the Docker build writes into `/version.json`. They list what users see, one line each, with no issue or PR number, and only the main changes (two for the next release: the list beside the open email and big files sent through Twake Drive); whoever releases rewrites them before the tag. Above them, a capture of the main change from `release-notes/whats-new-light.png` or `whats-new-dark.png`, as the theme of the app, with fictional data only; whoever releases replaces it too.
- Decided by: Crash-- (CTO), 2026-11-25
- Why: users learn what changed from the app itself; the CHANGELOG is written for those who deploy it.
- Scope: desktop and mobile, the new version dialog.

## 2026-11-26, [Product] The suspicious sender headers of the backend show the suspicious sender warning

- Decision: an email with `X-Suspicious-DisplayName: true` or `X-Suspicious-Domain: true` (what the mailet container sets when the From display name looks like a user of the directory or names a local domain) shows the `suspicious-sender` warning of `X-TWP-Message`, once even when several headers say it. Its level, warn, is a choice of [#1182](https://github.com/Crash--/twake-mail-frontend/pull/1182) to confirm. Rules in [`docs/twp-warnings.md`](twp-warnings.md).
- Decided by: Crash-- (CTO), 2026-11-26, [#1182](https://github.com/Crash--/twake-mail-frontend/pull/1182)
- Why: production sets `X-Suspicious-DisplayName`, not `X-TWP-Message`; users must see that the email may be a scam.
- Scope: desktop and mobile, the reading view and the messages of a conversation.

## 2026-11-25, [UX] The only message of a conversation does not collapse

- Decision: when a conversation holds one message, that message stays expanded: its header does not collapse it on click and shows no hover, and it stays expanded once marked unread (from its menu or the conversation's). It can collapse again as soon as a second message joins the conversation.
- Decided by: Crash-- (CTO), [#1173](https://github.com/Crash--/twake-mail-frontend/issues/1173)
- Why: with one message there is nothing to skim; collapsed, the reading view showed a sender and a preview line only.
- Scope: desktop and mobile, conversation view.

## 2026-11-26, [Product] The release notes link to every change, set per deployment

- Decision: under the release notes, a "See everything that's new" link opens the page set in `RELEASE_NOTES_URL` (http or https only), in a new tab; unset, no link. A setting of the deployment, not of the image: the room where a deployment announces its releases differs from one deployment to the next. Linagora's own deployment links to the room where its releases are announced; the other deployments are tracked in [#1181](https://github.com/Crash--/twake-mail-frontend/issues/1181).
- Decided by: Crash-- (CTO), 2026-11-26
- Why: the dialog keeps two or three lines; the full list lives where the release is announced.
- Scope: desktop and mobile, the new version dialog.

## 2026-11-25, [UI] One "?" in the Workplace bar

- Decision: on a desktop, under the bar of Twake Workplace, "Get help or report a bug" (the support of the server) goes behind the "?" of the bar with the help page of the Workplace: one "?", which opens the only entry at once, or a menu with "Help center" and "Get help or report a bug" when there are both. Mail shows no "?" of its own in that bar.
- Decided by: Crash-- (CTO), [#1168](https://github.com/Crash--/twake-mail-frontend/issues/1168)
- Why: two identical "?" side by side made no sense.
- Scope: desktop, the Workplace bar (on the platform and off it).

## 2026-11-26, [Infra] A pull request rebased without changing its own diff runs no CI again

- Decision: Replaces the decision of 2026-11-23, "A change to the decisions log alone runs no CI", for its last sentence. When the diff of a pull request against its merge base, without `docs/decisions.md`, is the one a workflow already passed on, that workflow skips its jobs and ends green. Only pull requests from a branch of the repository skip: a pull request from a fork, a re-run of the workflow, a push to main and a tag always run everything.
- Decided by: Crash-- (CTO), request of 2026-11-26 to the Mail team; forks excluded at the review of [#1185](https://github.com/Crash--/twake-mail-frontend/pull/1185)
- Why: a pull request rebased only to resolve a conflict in the decisions log has nothing new to test.
- Scope: GitHub Actions of the repository. Accepted risk: after such a rebase, the code is not tested against the new main before the merge, only on main after it.

## 2026-11-25, [UI] The preference icons are white on a neutral tile

- Decision: replaces the entry of 2026-11-22, "Pending: colours of the preference icon tile". The icon before each option of Settings > Preferences is a white glyph (`common.white`, in both modes) on a filled neutral tile (`border.main`) with a 12 px corner, while the icons of the settings menu stay grey. AI Scribe takes twake-icons' `Assistant` sparkle and the automatic labelling the outlined label_important glyph of the Figma.
- Decided by: Swann Maillard (design), 2026-11-25, [#1170](https://github.com/Crash--/twake-mail-frontend/issues/1170)
- Why: the two levels of icons read apart, and the settings are easier to scan.
- Scope: desktop, Settings > Preferences.

## 2026-11-26, [Tech] The preference tile and the label glyph stay in Mail

- Decision: two exceptions to "the fix goes in twake-mui". The 12 px corner of the preference tile is a local `sx` on twake-mui's rounded `Avatar` (`radius.lg` of twake-mui), which keeps its 6 px for every other app; the label glyph is a local SVG of `ds/SettingsIcons`, Julien's 16 px small version of the Figma glyph, not a twake-icons icon.
- Decided by: Crash-- (CTO), 2026-11-26, [#1170](https://github.com/Crash--/twake-mail-frontend/issues/1170)
- Why: no other app needs either, and changing the `Avatar` of twake-mui would reach every rounded avatar of the other apps.
- Scope: desktop, Settings > Preferences.

## 2026-11-26, [Tech] jmap-client-ts comes from npm as @linagora/jmap-client-ts

- Decision: Mail depends on `@linagora/jmap-client-ts`, published on npm from linagora/jmap-client-ts (branch `v2`, prereleases under `next`), pinned to an exact version; no more git dependency on the Crash--/jmap-client-ts fork.
- Decided by: Quentin (maintainer), [linagora/jmap-client-ts#80](https://github.com/linagora/jmap-client-ts/pull/80)
- Why: the git dependency needed a build at install time (an `allowScripts` approval per commit, git in the Docker image) and changed the lockfile on every push; the unscoped `jmap-client-ts` on npm belongs to a single user account, the `linagora` scope lets the organization publish it with trusted publishing.
- Scope: dependencies, build.

## 2026-11-24, [Tech] Rslint lints and rs fmt formats, from rstack.config.mjs

- Decision: `npm run lint` runs `rs lint` and `npm run format` runs `rs fmt` (rstack), both from the root `rstack.config.mjs`, as twake-tasks and twake-space do; ESLint and Prettier are gone. The rules ESLint ran stay on, the React Compiler and TanStack Query ones through their ESLint plugins; the Jest rules are Rslint's own. `rs fmt` checks the same files Prettier did.
- Decided by: Crash-- (CTO), 2026-11-24, on [#1152](https://github.com/Crash--/twake-mail-frontend/pull/1152#discussion_r4685292316), asked by Théo.
- Why: the lint drops from 104 s and 3 GB of memory to 10 s and 1.5 GB, with the same rules.
- Scope: `apps/private`, `common` and `scripts`; `e2e/` stays out of lint, as before.

## 2026-11-26, [Tech] Jest transforms with @swc/jest

- Decision: Jest transforms the TypeScript, JSX and ES module files with `@swc/jest` instead of ts-jest; the types stay checked by `tsc -b` alone.
- Decided by: Crash-- (CTO), 2026-11-26
- Why: ts-jest needs the JavaScript API of the `typescript` package, which TypeScript 7 no longer ships, and caps its peer at `<7`; swc transpiles without it.
- Scope: unit tests.

## 2026-11-26, [Tech] TypeScript 7 everywhere

- Decision: the `typescript` dependency is TypeScript 7; `npm run typecheck` stays `tsc -b`.
- Decided by: Crash-- (CTO), 2026-11-26
- Why: nothing loads the JavaScript API of `typescript` any more (Jest transforms with swc, Rslint is built on TypeScript 7), and `tsc -b` of TypeScript 7 checks the repository about three times faster.
- Scope: type checking.

## 2026-11-26, [Tech] Three strictTypeChecked rules stay out of the lint

- Decision: the lint runs without `@typescript-eslint/no-generated-empty-object-type`, `@typescript-eslint/no-unsafe-class-instance-assignment` and `@typescript-eslint/no-unsafe-enum-assignment`, which Rslint 0.10.1 does not port; Rslint skips them without a message.
- Decided by: Crash-- (CTO), 2026-11-26
- Why: the rest of strictTypeChecked runs; `no-unsafe-enum-assignment` has nothing to check, enums are banned.
- Scope: lint.

## 2026-11-26, [Product] Attachments go to Twake Drive from server to server

- Decision: "Save to my Drive" on an attachment, and "Save all to Drive" on the list, ask the mail server for a short-lived download token (`UnauthenticatedBlobAccess/set`), then give that URL to the UPLOAD intent of Twake Drive, which stores the file in the Mail folder: the stack downloads it, the browser never sees its bytes. One file at a time, a token just before each one. A toast says it with "Organize", which opens the MOVE intent of Drive in a dialog. The buttons show only when the mail server offers the tokens and Drive is installed. The states of the button and the toast follow Twake Calendar.
- Decided by: Crash-- (CTO), 2026-11-26
- Why: no download then upload through a phone or a browser; staging and production have the token extension (Redis on tmail-backend), an ingress that routes `/unauthenticatedDownload` and a stack that downloads a `SourceURL` (1.6.64 or later).
- Scope: desktop and mobile, the attachments of an email.

## 2026-11-26, [UX] A file saved to Drive is not saved again

- Decision: once saved, the button of an attachment becomes "See in Drive", which opens the file in Drive in a new tab; Mail does not send it again. A file Drive reports with another size than the attachment (an empty file from a stack without `SourceURL`, a page from a proxy) is not saved: the user is told to check their Drive. For now the state lasts as long as the email stays open; it will come from the references Drive puts on the file, read through `io.cozy.mails.attachments` only (no read access to the whole of `io.cozy.files`), and go back to "Save to my Drive" when the file is gone or in the trash.
- Decided by: Crash-- (CTO), 2026-11-26
- Why: "a saved file is saved"; a second copy would only confuse.
- Scope: desktop and mobile, the attachments of an email.

## 2026-11-26, [UX] The save action of a chip shows on hover or focus

- Decision: on a computer, the "Save to my Drive" cloud of an attachment chip shows only while the chip is hovered or holds the focus (`:focus-within`, for the keyboard), so that the name keeps its whole width at rest; it stays shown while it saves and once saved. On phones and on any pointer without hover (`@media (hover: none)`), it always shows.
- Decided by: Crash-- (CTO), 2026-11-26, [#1203](https://github.com/Crash--/twake-mail-frontend/pull/1203)
- Why: with the cloud always there, the 260 px chips cut the names of the files further.
- Scope: desktop and mobile, the attachments of an email.

## 2026-11-27, [Config] "Save to my Drive" behind SAVE_TO_DRIVE_ENABLED

- Decision: "Save to my Drive", "Save all to Drive", their toasts and the reads of what was saved show only with `SAVE_TO_DRIVE_ENABLED = true` (Helm chart: `config.saveToDrive.enabled`, Docker: the environment of the image), off by default. On, nothing else changes: the actions still need `TDRIVE_ENABLED`, the download tokens of the mail server and Drive on the Workplace.
- Decided by: Crash-- (CTO), 2026-11-27
- Why: each environment turns it on once its mail server, ingress and Drive are ready for it.
- Scope: deployment, the attachments of an email.
