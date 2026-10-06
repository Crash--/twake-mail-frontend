# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The facade of a team mailbox for the Mail tab of TwakeSpace,
  `/embed/team-mailboxes/<id of its root folder>`: its folders, list and reading view
  without the frame of the webmail, new messages from its address, a silent
  login in a frame, and its navigation and "sign in again" sent to TwakeSpace
  through cozy-external-bridge (`TWAKE_SPACE_URL`). See
  `docs/team-mailbox-embed.md`.

- Keyboard navigation of the folder trees (system folders, folders of the user,
  Team-mailboxes, results of the folder search), as the WAI-ARIA tree view: one
  tab stop per tree, Up / Down / Home / End, Right and Left to expand, collapse
  or go to the first child / the parent, Enter to open the folder, letters to
  jump to a folder. The expand arrow and the menu button of the focused folder
  follow it with Tab; Shift+F10 and the menu key still open its menu. The focus
  goes to a neighbour when the focused folder disappears.

- The formatting toolbar of the composer follows the design and tmail-flutter: text
  style (paragraph, headings, quote, code), size, font, text colour and highlight
  with a colour popover, bold to strike, alignment, lists and indentation. The
  sent HTML keeps them as inline styles. An emoji picker (categories, search,
  recent; the data of emojibase-data loaded when it opens) sits in the footer on
  tablets and desktops. On phones the footer stays on one line and the toolbar
  scrolls sideways.
- The Docker image is a drop-in replacement for tmail-flutter's `linagora/tmail-web`
  under the Helm chart `linagora/tmail-frontend` (1.0.12 tested): port 80,
  `app_dashboard.json` read into the app grid (the Flutter icon names mapped to
  the icons of the app), `COZY_INTEGRATION` as the Workplace embedding, the SSO
  found by WebFinger on `SERVER_URL` when `SSO_BASE_URL` is not set (then the
  Basic form, as tmail-flutter), and the CSP `connect-src` derived from the
  configuration (`SERVER_URL` with its WebSocket, `SSO_BASE_URL`, the SSO found
  by WebFinger at startup). See `docs/deployment.md`

- Storage upgrade on the Twake platform, as tmail-flutter: a link to the
  paywall in the quota banner, the sidebar footer, Settings > Storage and the
  composer error, with the SaaS capability, inside Twake Workplace and a safe
  https URL (Workplace of the user, or `paywallUrlTemplate` of the
  ecosystem). The sidebar footer follows the design (gauge, "X available",
  version). The ecosystem document is now read by one shared module
  (`features/ecosystem`), used by error reporting too
- Backend warnings of an email (`X-TWP-Message` headers: suspicious sender,
  virus, phishing): a banner per warning between the header and the body, in
  the email view and in each message of a conversation, a red badge instead of
  the avatar for an error, and a dismissal kept with the keyword
  `twp-warning-dismissed-<index>`. See `docs/twp-warnings.md`

- Error reporting driven by a preference, as tmail-flutter on the web: Sentry
  starts only when configured (`SENTRY_*` or the ecosystem of the server) and
  the user opted in (Settings > Preferences, `sentry.user-opt-in` of the
  account, `userOptInByDefault` as default), stops when they opt out or sign
  out, and sends scrubbed events only. See `docs/sentry.md`

- Runtime configuration keys of the `env.file` of tmail-flutter: `SERVER_URL`
  (the session is `<SERVER_URL>/.well-known/jmap`), `DOMAIN_REDIRECT_URL`
  (redirects `login-callback.html` and `logout-callback.html`),
  `WEB_OIDC_CLIENT_ID`, `OIDC_SCOPES` (comma separated), `APP_GRID_AVAILABLE`,
  `SENTRY_ENABLED`, `SENTRY_ENVIRONMENT`. `JMAP_SESSION_URL`, `SSO_CLIENT_ID`
  and `SSO_SCOPE` are deprecated aliases, logged once in the console. The
  image also accepts an `env.file` mounted at
  `/usr/share/nginx/html/assets/env.file`; see `docs/deployment.md`

- Application skeleton: npm workspaces (`apps/private`, `common`), Rsbuild,
  React 18, TypeScript strict, `@linagora/twake-mui`, TanStack Query
- Runtime configuration (`.env.js`, `appList.js`, `version.js`), validated at
  startup, with an explicit screen when it is invalid
- OIDC sign-in (Authorization Code + PKCE), token refresh before expiry and on
  401, logout ending the session in every tab
- Basic sign-in form, checked against the JMAP session endpoint
- Layout: top bar (search field, app grid, user menu), sidebar (new message
  button, mailbox tree slot), mailbox and email routes
- English, French, Russian and Vietnamese translations
- Docker image (nginx) and CI workflow
- Production-ready Docker image: built from the sources (multi-stage), served
  by an unprivileged nginx (user 101) on port 8080, read-only root filesystem
  supported, `/healthz` endpoint and Docker healthcheck, security headers
  (Content-Security-Policy configured by environment variables,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`); see
  `docs/deployment.md`
- End-to-end suite runnable against the Docker image (`E2E_APP_IMAGE`),
  failing on any Content-Security-Policy violation
- CI workflow publishing the image (`main`, `sha-<sha>`, semver tags;
  `linux/amd64` and `linux/arm64`, SBOM and provenance) after a smoke test
  and a Trivy scan
- Docker Compose examples (`deploy/docker-compose/`): the app alone, and a
  demo with tmail-backend and basic authentication on one origin
- Helm chart (`deploy/helm/twake-mail-frontend`): hardened Deployment,
  `.env.js` and `appList.js` rendered from typed values into a ConfigMap,
  CSP origins derived from the configuration, optional Ingress (with the
  JMAP paths), PodDisruptionBudget, optional HorizontalPodAutoscaler, `helm
  test`; linted, validated and installed in kind by the CI, published as an
  OCI artifact
- JMAP client (jmap-client-ts v2): one client per sign-in, JMAP session
  loaded before the mail screens, its username shown in the user menu in
  basic mode
- Folder tree: nested folders sorted as in tmail-flutter, translated system
  folder names, unread counters, expand and collapse; the app opens on the
  inbox
- Email list: paginated and virtualized, unread and starred state, star
  toggle, empty folder view
- Reading an email: headers, sanitized HTML body (or text), inline images,
  attachments to download, back to the list; marked read when opened
- Real-time updates through JMAP push over WebSocket
- Development proxy to a JMAP server (`JMAP_PROXY_TARGET`)
- End-to-end tests of login, folders, reading and push (Playwright)
- Phones and tablets, with the breakpoints of tmail-flutter: below 1200 px
  the folders open in a drawer from a menu button and "New message" is a
  floating button; from 900 to 1199 px the list stays beside the email
  being read; below 900 px the email replaces the list, with a back
  button. Phones get a compact top bar (current folder, search behind a
  button) and four-line list rows (sender and date, subject, preview).
- Search: suggestions while typing (search for the text, recent searches,
  contacts when the server autocompletes them, first matching emails) in an
  accessible combobox, quick filters (attachment, last 7 days, from me,
  starred), advanced search (from, to, subject, words, excluded words,
  folder, dates, attachment, unread, starred, order), filters above the
  results, orders as in tmail-flutter (relevance by default, the last one
  picked remembered), matches highlighted from `SearchSnippet/get`,
  shareable results URL (`/search?…`), results kept up to date by push
- Conversations, behind the "Thread" setting of tmail-flutter (account
  menu, off by default): one row per conversation with its number of
  messages, in mailboxes and search results; an opened email shows its
  whole conversation, the oldest message first, unread and last messages
  expanded, the others collapsed, keyboard moves between messages, replies
  joining it as they arrive (announced), read and star actions on the
  whole conversation
  Touch targets are at least 44 px, and every screen reflows down to
  320 px without horizontal scrolling (RGAA 10.11)
- End-to-end runs of the main path on phone (390 × 844) and tablet
  (820 × 1180) screens, and reflow checks at 320 and 640 px
- Toasts announced to screen readers (polite, or at once for errors), that
  stay while hovered or focused, with "Undo" after an action and "Retry"
  after a failure
- Email actions shown at once and sent in batches, rolled back when the
  server refuses them, without being applied twice when push brings them
- Keyboard shortcuts (`c`, `/`, `j`, `k`, `e`, `#`, `s`, `u`, `z`, `?`),
  listed by `?` and in the account menu, where they can be turned off

- Email actions: archive, move to trash or delete forever (with a
  confirmation in the Trash, Spam and Drafts), move to a folder picked in a
  filterable list, spam and not spam, read and unread, star, from the open
  email (buttons and a "More" menu), the row (hover actions, right click,
  menu key or Shift+F10), the selection toolbar, and by dragging rows onto
  a folder
- Selection: checkboxes, Shift+click ranges, Ctrl+A, select all the loaded
  emails or the whole folder
- "Empty trash now" and "Delete all spam emails now" banners, with
  `Mailbox/clear` when the server has it; emptying the Trash also deletes
  its subfolders

- Folders: create (with the location), rename, move, delete with their
  subfolders and emails, mark every email read, hide and show again, from
  the "+" of the folder tree and a folder menu (⋮, right click, menu key
  or Shift+F10), with tmail-flutter's name checks
- Team mailboxes in their own section of the tree, their actions following
  the rights of the user; the James shares capability is sent with every
  request when the server has it
- A "Starred" folder after the Inbox, listing the starred emails of every
  folder

- Composer window, from "New message", its floating button or the `c` key:
  up to three windows docked at the bottom of a desktop screen, minimized
  or full screen, the whole screen on phones and tablets; closing a
  modified message offers to save it as a draft
- Recipient fields (To, Cc, Bcc, Reply to) with chips: pasted lists,
  invalid addresses shown as such, keyboard editing, contact suggestions
  (`TMailContact/autocomplete`); the identity to send from, with its
  signature
- Rich text body: formatting toolbar (Alt+F10), links (Ctrl+K), inline
  images resized with the keyboard, clean paste from office suites
- Sending (button or Ctrl+Enter) after tmail-flutter's checks (recipients,
  addresses, uploads, empty subject); the sent copy is filed in Sent, seen;
  a refused message stays in the composer with the reason
- Drafts saved 1.5 s after the last change, in one request, and on
  closing; reopened from the Drafts folder with their identity, recipients,
  images and files; one composer per draft; "Delete draft"
- Attachments: picked or dropped, uploaded with their progress, cancelled
  when removed, within the size limits of the server
- Open composers come back after a reload of the page, and are forgotten
  on sign out
- Reply, reply all and forward from the menu of a conversation row, to the
  email standing for it
- "Request read receipt" and "Mark as important" in the "More" menu of a
  message, on by default for read receipts when the user always asks
  (Linagora settings); emails asking a read receipt offer to send it
  (`MDN/send`); emails marked important by their sender are flagged in the
  list, the conversation and the reader, unless turned off
- Messages go with the Reply-To of their identity when none is typed, and
  its Bcc; a message saying a file is attached, without any, asks before
  it is sent
- The keyboard shortcuts list the keys of a message being written
- Settings (`/settings/<section>`), opened from the account menu: the
  sections beside them on a desktop, listed on phones and tablets; the
  conversation setting (Preferences) and the keyboard shortcuts moved there
- Identities (Settings > Profiles): created, edited and deleted with their
  Reply-To, Bcc and rich signature, the default one chosen when the server
  sorts identities; signature images published as PublicAssets
- Email rules (Settings > Email rules, `Filter/set`): conditions on From,
  To, Cc, Recipient or Subject, all or any met; move to a folder, mark as
  seen, star, reject (after a warning) or mark as spam
- Forwarding (Settings > Forwarding, `Forward/set`): addresses added after
  a warning when outside the domain (`FORWARD_WARNING_MESSAGE`), removed
  after a confirmation, "Keep a copy in Inbox"
- "Save as template" in the "More" menu of a message, in a Templates folder
  made on the way; a template of that folder opens as a new message that
  saving as template again updates
- `mailto:` links opened through `/mailto?uri=mailto:…`, before the mailbox
  is ready or after signing in, their body kept as plain text
- Language (Settings > Language): applied at once, kept in the browser and
  in the `language` setting of the account, which every device follows
- Preferences: "Always request read receipts" and "Display sender-set
  important flag", kept in the settings of the account
- Vacation response (Settings > Vacation, `VacationResponse/set`): on or
  off, from a date and time until another, with a subject and a rich
  message; a banner says it is on, over every screen, with "End now"
- Folder visibility (Settings > Folder visibility): every folder, hidden
  or shown again
- Labels (`Label/*`): in the sidebar (created, edited, deleted, with a
  colour), their emails (`/label/<id>`), "Label as" on emails from every
  menu and the selection, chips on the rows and under the subject (× takes
  one off), kept up to date by push (`Label/changes`), "Label visibility"
  in Preferences; the advanced search filters by label
- Storage (`Quota/get`): the space used at the bottom of the sidebar, a
  banner past the warning limit of the server, Settings > Storage
- "Recover deleted messages" in the menu of the Trash
  (`EmailRecoveryAction`): the form of tmail-flutter, the task followed
  until the emails are back in "Recovered"
- Calendar invitations (`CalendarEvent/parse`): the event card of
  tmail-flutter's new design above the body of an email holding a `.ics`
  file or a `text/calendar` part (state badge, when and how it repeats in the
  time zone of the user, where, the meeting link to copy, organizer and
  attendees with their answer), Yes / Maybe / No (`CalendarEvent/accept`,
  `maybe`, `reject`, the current answer from `CalendarEventAttendance/get`),
  Yes on a counter proposal (`CalendarEventCounter/accept`), "Mail to
  attendees", "See in your Calendar" (`CALENDAR_SPA_URL`); the description
  as text after the card
- App grid: the `link` and `icon` of `appList.js` may be URI templates
  (`{localpart}`, `{workplaceFqdn}`…), resolved with the `workplaceFqdn`
  claim of the SSO or `WORKPLACE_FQDN_FALLBACK`, for the Drive of each user
- `WORKPLACE_EMBEDDING`: inside an iframe of Twake Workplace, the top bar
  leaves the logotype and the app grid to the container, the account button
  becomes a gear (cozy-external-bridge, as Twake Calendar)
- "Attach from Drive" in the composer (`TDRIVE_ENABLED`, `TDRIVE_INTENT_URL`,
  OIDC mode): the Twake Drive picker in a dialog (token exchange, cozy-stack
  intent, messages checked against its origin), the files added as a link (the
  Drive card of tmail-flutter) or as attachments (downloaded, then uploaded
  with their progress); a Drive card spares the forgotten attachment reminder
- AI assistant of the composer, when the server advertises one
  (`com:linagora:params:jmap:aibot`, `scribeEndpoint`): tmail-flutter's
  actions on the selection or on what the user wrote (correct, shorter,
  longer, emojis, bullets, tone, translate) and "Help me write", the answer in
  a dialog to insert, to replace the selection with, or to cancel

### Changed

- **The Docker image listens on port 80** instead of 8080 (`LISTEN_PORT=8080`
  keeps the former port; the Compose files and the Helm chart of this
  repository do). It still runs as user 101: port 80 needs the sysctl
  `net.ipv4.ip_unprivileged_port_start` (Docker and most runtimes lower it) or
  the capability of `nginx-bind`, see `docs/deployment.md`

- Helm chart: without `config.sentry.dsn` (and `config.sentry.enabled` not
  false), `SENTRY_*` are no longer written to `.env.js`, which leaves the
  error reporting configuration to the ecosystem of the server; they used to
  turn it off. `config.sentry.enabled: false` still turns it off
- Lists, folders and open emails are not refetched while push keeps them
  up to date, and again after 30 s once the push channel is down
- The folder tree keeps no room for expand arrows when no folder has
  subfolders

### Fixed

- `R` replies to all only with Shift, not with Caps Lock
- A key typed while a composer opens no longer reaches the shortcuts of the
  email behind it; answering an email twice brings back the answer open
- A reply reopened from Drafts marks the email it answers once sent
- The remote images of a reopened draft wait for the user, as in the reader
- A draft version created by a save whose answer was lost is destroyed by
  the next save
- An email sent to oneself counts once in its conversation row
- A conversation of an email without sender or recipient (a template, a
  draft) enters its list by push

### Security

- Session tokens and basic credentials are kept in memory, out of web storage
- OIDC codes, states, tokens and tickets are masked in nginx logs and in the
  reports sent to Sentry
- Email bodies are sanitized with DOMPurify and displayed in an iframe that
  cannot run scripts, under a Content Security Policy forbidding them
