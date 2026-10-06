# Twake Mail web — end to end test plan

Parity backlog of the Playwright suite ([`README.md`](README.md)) against the **116 Patrol
integration tests** of tmail-flutter (`integration_test/tests/`, scenarios in
`integration_test/scenarios/`, robots in `integration_test/robots/`). Flutter web renders to a
canvas, so none of them can be reused: each one is rewritten here as a Playwright spec against
the React app. One line per Patrol test, 116 lines.

## How to use this list

- **The identifier is stable** (`MBX-03`): never renumber, never reuse. Quote it at the start of
  the test title, it is what ties the backlog to the code:

  ```ts
  test('MBX-01 create a personal folder from the sidebar', async ({ page, user }) => { … });
  ```

  `npx playwright test -g MBX-01` then runs exactly that scenario.
- **Tick the box** when the spec exists **and passes in CI** — not before. Phase 0 entries
  ticked before the first CI run say so ("CI to confirm").
- Each line says what the Patrol test asserts (read from the scenario, not from its name), the
  source file (relative to `integration_test/tests/`) and its Patrol tags. A test without a
  `tags:` argument gets the `TestBase` default, `[ios]`: it never ran on web, which is why most
  of these behaviours have no web coverage today (`ios (default)` below).
- `Data:` notes say what the Patrol test relied on. Patrol ran every test as the shared
  `bob@example.com`, restored from `provisioning/integration_test/backup.zip` and reset after
  each test. Here **every test gets a brand new user** (`user` fixture) and seeds exactly what
  it needs through the `jmap` fixture (`sendEmail`, `importEml` of the copies in
  `fixtures/eml/`, `setKeywords`, `createMailbox`), so nothing depends on bob's backup.
- `Web port:` notes: the Patrol test reaches the feature through a touch gesture (long press)
  but the feature exists on the web; port it through the web path given (⋮ button on hover,
  right-click, row checkbox).
- **`N/A web`** marks a scenario that has no web counterpart as written (Android share
  intents, background auto-save on app pause, pull-to-refresh, long-press shortcuts duplicating
  another entry). The note gives the web equivalent and which entry covers it. These lines stay
  unticked and get no spec.
- A behaviour of the web app that Patrol never covered gets a new line, in its domain, with
  the next free number.
- One spec, one behaviour a user can observe. Back the UI assertion with a JMAP one when the
  screen could lie (the email really is in Trash, the keyword really is set).

## Summary

| Prefix | Domain | Entries | Tagged `web` in Patrol | N/A web |
|---|---|---|---|---|
| `LOGIN` | Login | 1 | 1 | 0 |
| `MBX` | Mailbox and folders | 25 | 3 | 2 |
| `CMP` | Composer | 48 | 7 | 3 |
| `ATT` | Attachments | 2 | 1 | 0 |
| `EML` | Reading and acting on an email | 27 | 0 | 1 |
| `THR` | Thread detail | 6 | 0 | 0 |
| `SRCH` | Search | 14 | 10 | 0 |
| `LBL` | Labels | 12 | 0 | 0 |
| `SET` | Settings | 9 | 1 | 0 |
| `RULE` | Email rules | 2 | 1 | 0 |
| `CAL` | Calendar events | 7 | 0 | 0 |
| `PUSH` | Real-time updates | 1 | 0 | 0 |
| `APPGRID` | App grid | 2 | 0 | 0 |
| `DRIVE` | Twake Drive picker | 4 | 0 | 0 |
| `AI` | AI assistant of the composer | 2 | 0 | 0 |
| `MISC` | Misc | 1 | 0 | 0 |
| | **Total** | **163** | **24** | **6** |

Plus `A11Y`, accessibility scenarios (RGAA 4.1), `KBD`, keyboard shortcuts, and `RESP`, phone and
tablet layouts, with no Patrol counterpart, at the end.

Phase 0 of the React app (login, folder tree, email list, reading) is enough for `LOGIN-01`,
`MBX-04` to `MBX-06`, `MBX-17`, `MBX-24`, `EML-01` to `EML-04` and `PUSH-01`, their data being
seeded through JMAP. Everything else needs actions, the composer, search or settings.

---


## LOGIN — Login (1)

- [x] `LOGIN-01` Logging in with basic auth (email + password; on mobile after "Use company server" → username → server URL) as the provisioned user lands on the thread (email list) view. — `login/login_with_basic_auth_test.dart` · tags: `web` `android` `ios`
  - Spec: `tests/login.spec.ts`. Passes in CI.
  - Data: the only test that does NOT seed credentials into app storage (every other test starts already logged in as bob@example.com); uses `USERNAME`, `BASIC_AUTH_URL`, `BASIC_AUTH_EMAIL`, `PASSWORD` dart-defines.

## MBX — Mailbox and folders (25)

- [x] `MBX-01` Clicking the sidebar "+" (new folder) button, entering "crud personal folder" and confirming "Create folder" makes the new personal folder appear in the sidebar. — `mailbox/create_personal_folder_test.dart` · tags: `web` `android` `ios`
  - Spec: `tests/folders.spec.ts` (the "+" of the "Folders" heading, then the folder opens). Passes in CI.
- [x] `MBX-02` From Inbox's folder menu, create subfolder "crud sub folder" (it opens and its name shows), rename it to "renamed sub folder", move it under Archive (Archive now has a child), then delete it with confirmation (Archive has no children any more). — `mailbox/create_rename_move_and_delete_mailbox_test.dart` · tags: `ios (default)`
  - Web port: every folder action is opened by long-pressing the sidebar folder. Web equivalent: hover → folder "more" (⋮) button or right-click on the folder → New subfolder / Rename / Move / Delete; port it through the folder/row context menu (⋮ on hover, or right-click).
  - Spec: `tests/folders.spec.ts` (the folder menu: ⋮ on hover or focus, right click, menu key or Shift+F10). Passes in CI.
- [x] `MBX-03` Creating subfolder "hidden sub folder" under Inbox from Inbox's folder menu, then choosing "Hide folder" on it, leaves Inbox with no children in the sidebar (and Inbox still reachable). — `mailbox/create_and_hide_sub_folder_test.dart` · tags: `ios (default)`
  - Web port: long press on the sidebar folder (and a native swipe to close the drawer). Web equivalent: hover ⋮ / right-click → New subfolder, then Hide folder; port it through the folder/row context menu (⋮ on hover, or right-click).
  - Spec: `tests/folders.spec.ts`. Passes in CI.
- [x] `MBX-04` Opening the sidebar folder search (magnifier in the "Folders" section header) and typing "Inbox" shows the Inbox folder in the search results. — `mailbox/search_mailbox_inbox_test.dart` · tags: `ios (default)`
  - Spec: `tests/folder-search.spec.ts`.
- [x] `MBX-05` With one email sent to self (lands in Sent) and one sent with Trash as its "sent" folder, clicking Sent shows exactly one "sent subject" row and clicking Trash shows "trash subject". — `mailbox/switch_mailbox_test.dart` · tags: `ios (default)`
  - Spec: `tests/mailbox.spec.ts`. Passes in CI.
- [x] `MBX-06` On a fresh account with no starred mail, the Favorites (Starred) folder is listed in the sidebar and opening it shows the empty-thread view. — `mailbox/display_empty_view_for_favorite_folder_test.dart` · tags: `ios (default)`
  - Data: relies on bob's restored mailbox having no starred email (backend reset between tests).
  - Spec: `tests/folders.spec.ts`, also run on the `mobile` and `tablet` projects (the virtual folder is `/starred`, `data-mailbox-role="favorite"`). Passes in CI.
- [ ] `MBX-07` The team mailbox "bob-guests" is listed in the sidebar; composing an email to bob-guests@example.com and sending shows the "Message has been sent successfully" toast, and the email appears in the team mailbox's INBOX after expanding it. — `mailbox/team_mailbox_receive_email_test.dart` · tags: `ios (default)`
  - Data: team mailbox `bob-guests@example.com` with members bob and alice, created by `provisioning.sh` (Twake/James team-mailbox extension).
  - Spec: `tests/folders.spec.ts`, the receiving part only (named "MBX-07 (receiving part)"): the email is sent to the team address through JMAP; sending it from the composer waits for phase 3, so the line stays unticked.
- [x] `MBX-08` With an email provisioned in Trash, opening Trash shows the "empty trash" banner and the email; clicking "Empty trash now" shows the confirmation dialog, and "Delete all" leaves the empty-thread view. — `mailbox/empty_trash_test.dart` · tags: `ios (default)`
  - Spec: `tests/actions.spec.ts` (`Mailbox/clear` when the server has it, `Email/query` + `Email/set` destroy by back-reference otherwise). Passes in CI.
- [x] `MBX-09` With a subfolder created under Trash and an email in Trash, emptying Trash via the banner + confirm removes the subfolder from the sidebar, and Trash then shows the empty view with no banner. — `mailbox/clear_trash_subfolders_via_banner_test.dart` · tags: `web` `android` `ios`
  - Data: Trash subfolder "Trash subfolder banner test" created via JMAP `Mailbox/set` before the UI run.
  - Spec: `tests/actions.spec.ts`. Passes in CI.
- [x] `MBX-10` Same setup as MBX-09, but emptying via the Trash folder context menu ("Empty trash" → "Delete") removes the Trash subfolder from the sidebar, and Trash then shows the empty view with no banner. — `mailbox/clear_trash_subfolders_via_context_menu_test.dart` · tags: `web` `android` `ios`
  - Data: Trash subfolder "Trash subfolder context menu test" created via JMAP. On web the robot opens the menu by hovering the folder and clicking its ⋮ (more-action) button.
  - Spec: `tests/folders.spec.ts`. Passes in CI.
- [x] `MBX-11` With an email in Trash, emptying Trash via the banner hides the banner; then "Recover deleted messages" on Trash → "Restore" brings the email back into a "Recovered" folder where it is visible. — `mailbox/empty_and_recover_trash_test.dart` · tags: `ios (default)`
  - Spec: `tests/recovery.spec.ts`; the toast's "Open" goes to the "Recovered" folder (role `restored messages`, named `Restored-Messages` by tmail-backend).
  - Web port: "Recover deleted messages" is opened by long-pressing Trash (the banner part is web-native). Web equivalent: Trash folder hover ⋮ / right-click → Recover deleted messages; port it through the folder/row context menu (⋮ on hover, or right-click).
  - Data: needs the server's deleted-messages vault (James) for the restore into "Recovered".
- [ ] `MBX-12` With an email in Trash (Trash shows no unread badge), long-pressing Trash → "Empty trash" → "Delete" empties it (no badge, no banner when opened); long-press Trash → "Recover deleted messages" → "Restore" puts the email in "Recovered". — `mailbox/long_press_empty_and_recover_trash_test.dart` · tags: `ios (default)`
  - N/A web: long press on the sidebar folder. Web equivalent: Trash context menu → Empty trash is covered by MBX-10; Recover deleted messages is covered by the MBX-11 right-click port.
  - Data: deleted-messages vault (James).
- [x] `MBX-13` With an email in Spam, clicking the "Delete all spam emails now" banner and confirming "Delete all" hides the banner; then "Recover deleted messages" on Trash → "Restore" shows the email in "Recovered". — `mailbox/empty_and_recover_spam_test.dart` · tags: `ios (default)`
  - Web port: recovery is opened by long-pressing Trash (the spam banner part is web-native). Web equivalent: Trash hover ⋮ / right-click → Recover deleted messages, covered by the MBX-11 right-click port; the spam banner part should still be ported as-is.
  - Data: email placed in Spam by sending to self with Junk as the "sent" folder; deleted-messages vault.
  - Spec: `tests/actions.spec.ts` for the spam banner part ("MBX-13 (spam banner)"), `tests/recovery.spec.ts` for the whole scenario.
- [x] `MBX-14` With an email in Spam (Spam shows no unread badge), long-pressing Spam → "Delete all spam emails" → "Delete all" empties it (no badge, no banner when opened); recovering from Trash then shows the email in "Recovered". — `mailbox/long_press_empty_and_recover_spam_test.dart` · tags: `ios (default)`
  - Spec: `tests/recovery.spec.ts`, "Delete all spam emails" from the ⋮ menu of Spam.
  - Web port: long press on the sidebar folder. Web equivalent: Spam folder hover ⋮ / right-click → Delete all spam emails; port it through the folder/row context menu (⋮ on hover, or right-click).
  - Data: deleted-messages vault.
- [x] `MBX-15` With an unread email in Inbox (Inbox shows an unread badge), choosing "Mark as read" from Inbox's folder menu removes the Inbox unread badge. — `mailbox/mark_mailbox_as_read_test.dart` · tags: `ios (default)`
  - Web port: long press on Inbox. Web equivalent: Inbox hover ⋮ / right-click → Mark as read; port it through the folder/row context menu (⋮ on hover, or right-click).
  - Spec: `tests/folders.spec.ts`, also run on the `mobile` and `tablet` projects. Passes in CI.
- [ ] `MBX-16` With 40 emails provisioned in Inbox, choosing "Move folder content" → Templates from Inbox's folder menu moves them all: Templates lists them and Inbox shows the empty-thread view. — `mailbox/move_folder_content_test.dart` · tags: `ios (default)`
  - Web port: long press on Inbox. Web equivalent: Inbox hover ⋮ / right-click → Move folder content → destination picker; port it through the folder/row context menu (⋮ on hover, or right-click).
- [x] `MBX-17` The Inbox unread counter goes up by 1 in real time when a new email arrives, and back down when that email is marked read by another client (JMAP `Email/set`), without any manual refresh. — `mailbox/mailbox_count_real_time_update_test.dart` · tags: `ios (default)`
  - Spec: `tests/mailbox.spec.ts`. Passes in CI.
  - Data: relies on server push (JMAP WebSocket/state change); the "other client" update is a direct JMAP call.
- [x] `MBX-18` The used quota shown in the sidebar increases after an email with a .txt attachment is sent to self and the quota is reloaded. — `mailbox/quota_count_test.dart` · tags: `ios (default)`
  - Web port: the sidebar shows the storage used (`quota-indicator`, `data-used`), brought up to date by push; Settings → Storage shows it too.
  - Data: bob quota (200 messages / 50 MB) set by `provisioning.sh`; the test reads the used quota from the controller and triggers `reloadQuota()` programmatically (no UI refresh), so on web reload the page or wait for the push update.
- [x] `MBX-19` Selecting an email and choosing More → "Move to" → Templates moves it to Templates (visible there); selecting another and clicking "Move to trash" moves it to Trash (visible there). — `mailbox/mailbox_move_email_test.dart` · tags: `ios (default)`
  - Web port: selection is entered by long-pressing the email row. Web equivalent: row checkbox selection + selection toolbar, or right-click on the email → Move to / Move to trash (drag-and-drop to a folder is another web path); port it through the folder/row context menu (⋮ on hover, or right-click).
  - Spec: `tests/actions.spec.ts`. Web port: the "Move" and "Move to trash" buttons of the selection toolbar, "Templates" a folder created by the spec (James creates none). Passes in CI.
- [x] `MBX-20` Selecting a single unread email and clicking the selection toolbar's "Mark as read" shows the email as read in the list. — `mailbox/mark_single_selected_email_as_read_test.dart` · tags: `ios (default)`
  - Web port: selection by long press on the email row. Web equivalent: checkbox selection → toolbar Mark as read, or right-click → Mark as read; port it through the folder/row context menu (⋮ on hover, or right-click).
  - Spec: `tests/actions.spec.ts`, also run on the `mobile` and `tablet` projects. Passes in CI.
- [x] `MBX-21` Selecting a single email and choosing More → "Mark as starred" shows the email as starred in the list. — `mailbox/mark_single_selected_email_as_star_test.dart` · tags: `ios (default)`
  - Web port: selection by long press on the email row. Web equivalent: checkbox selection → toolbar star, or right-click → Star; port it through the folder/row context menu (⋮ on hover, or right-click).
  - Spec: `tests/actions.spec.ts`. Web port: the "Star" button of the selection toolbar. Passes in CI.
- [x] `MBX-22` Selecting a single email and choosing More → "Move to spam" moves it out of Inbox; it is listed in the Spam folder. — `mailbox/mark_single_selected_email_as_spam_test.dart` · tags: `ios (default)`
  - Web port: selection by long press on the email row. Web equivalent: checkbox selection → toolbar spam action, or right-click → Mark as spam; port it through the folder/row context menu (⋮ on hover, or right-click).
  - Spec: `tests/actions.spec.ts`. Web port: the "Mark as spam" button of the selection toolbar. Passes in CI.
- [ ] `MBX-23` With 4 emails (one unread, one marked read and one starred via JMAP, one with a .txt attachment), the thread quick filter "Attachments" shows the attachment email, "Unread" shows the unread email and "Starred" shows the starred email. — `mailbox/quick_filter_test.dart` · tags: `ios (default)`
  - Data: only positive assertions (the expected email is visible); the test never checks that the other emails are filtered out, so a port should add that.
- [ ] `MBX-24` With 16 emails in Inbox, scrolling to the oldest email shows the "scroll to top" floating button, and clicking it scrolls back to the top and hides the button. — `mailbox/scroll_list_email_in_mailbox_and_back_to_top_test.dart` · tags: `ios (default)`
- [ ] `MBX-25` An email that arrived without the list being refreshed is not shown until a pull-to-refresh (fling down) on the list, after which it appears. — `mailbox/pull_to_refresh_test.dart` · tags: `ios (default)`
  - N/A web: pull-to-refresh gesture. Web equivalent: none as written (new mail arrives via push, covered by MBX-17 / PUSH-01).
- [x] `MBX-26` Five emails (each with its copy in Sent: tmail-backend#2684 needs messages in two mailboxes); checking the fifth then Shift+clicking the second selects four ("4 selected"), "Mark as read" in the selection toolbar sends them in one `Email/set`, leaves the first unread, and the toolbar goes. — web app only, no Patrol test
  - Spec: `tests/actions.spec.ts`. Passes in CI.
- [x] `MBX-27` A right click on a row opens its actions menu at the pointer (axe), "Archive message" archives it; Shift+F10 on the focused row of another opens the same menu, focused on its first item, and "Move to trash" from the keyboard trashes it. — web app only, no Patrol test (no right click in tmail-flutter)
  - Spec: `tests/actions.spec.ts`. Passes in CI.
- [x] `MBX-28` Two checked rows dragged onto a folder of the tree move there (the keyboard way is "Move message"). — web app only, no Patrol test
  - Spec: `tests/actions.spec.ts`. Passes in CI.
- [x] `MBX-29` A folder hidden from its menu leaves the tree; "Show hidden folders" lists it again, marked hidden, and "Show folder", reached with Shift+F10 on it (axe on the menu), shows it for good. — web app only, no Patrol test (tmail-flutter shows hidden folders from Settings > Folder visibility)
  - Spec: `tests/folders.spec.ts`. Passes in CI.
- [x] `MBX-30` A member of a team mailbox gets, on its root, only the actions the server rights allow (`myRights`: no rename, no delete; hide). — web app only, no Patrol test
  - Spec: `tests/folders.spec.ts`. Passes in CI.

## CMP — Composer (45)

- [x] `CMP-01` Compose a new email to self (bob) and alice with subject "Test subject" and body, send it, and the message is filed in the Sent mailbox (no send-failure confirm dialog appears). — `composer/send_email_test.dart` · tags: `android` `ios` `web`
  - Data: logged-in user `BASIC_AUTH_EMAIL` = bob@example.com, `ADDITIONAL_MAIL_RECIPIENT` = alice@example.com.
- [x] `CMP-02` In a new composer to self, enable "Mark as important" from the composer "More" menu (toast "Mark as important is enabled", a checked `menuitemcheckbox`), send, and the resulting email tile in the list shows the important flag icon; the message is received with `X-Priority: 1`, `Importance: high` and `Priority: urgent`, and its row link says "Important". — `composer/send_email_with_mark_as_important_test.dart` · tags: `ios (default)`
- [x] `CMP-03` In a new composer to self, enable "Request read receipt" from the "More" menu (toast "Request read receipt has been enabled"), send: the message is received with `Disposition-Notification-To` (the address of the account); opening it shows the "Read receipt request" dialog, which shows again after "No" when it is opened again; "Yes" sends it (toast "A read receipt has been sent."): the email gets `$mdnsent` and "Read: …" arrives. — `composer/send_email_with_read_receipt_enabled_test.dart` · tags: `ios (default)`
- [x] `CMP-04` With two identities provisioned (default one whose signature contains the keyword "file", the other without), sending a body without the keyword using the default identity succeeds with no attachment reminder (keyword in signature is ignored), while sending a body "file in content" after switching From to the second identity shows the attachment-reminder modal ("…in your message but did not add any attachments. Do you still want to send?"). — `composer/attachment_reminder_test.dart` · tags: `ios (default)`
  - Data: 2 identities via JMAP Identity/set (signatures "Signature file" default, "Signature").
- [x] `CMP-05` In a new composer, expanding the To field reveals To/Cc/Bcc/Reply-To fields; after adding a Cc recipient and moving focus to the subject the recipient fields collapse into a summary (all four hidden), and tapping the collapsed summary then the Cc expand button shows all four fields again. — `composer/show_full_recipient_fields_when_expand_all_test.dart` · tags: `ios (default)`
- [x] `CMP-06` In the composer editor, pressing Ctrl+K (Cmd+K on macOS) opens the app's custom insert-link dialog (with an "Apply" button) instead of the browser/editor default. — `composer/open_insert_link_dialog_via_keyboard_shortcut_test.dart` · tags: `web`
- [x] `CMP-07` In a new composer, uploading a PNG as attachment shows an attachment chip with its file name, inserting the same PNG inline puts a base64 `<img>` in the editor HTML, and adding it twice more as attachment results in 3 attachment chips. — `composer/composer_upload_attachment_and_inline_image_test.dart` · tags: `ios (default)`
  - Data: PNG from `integration_test/resources/test_images.dart` (`TestImages.base64`), injected via the upload controller (no native picker).
- [x] `CMP-08` After sending an email to bob and alice (CMP-01 flow, subject "reply own sent email"), opening it from Sent and tapping Reply pre-fills the To field with the original To recipients (bob@example.com and alice@example.com) rather than the sender only. — `composer/reply_to_own_sent_email_test.dart` · tags: `ios (default)`
- [x] `CMP-09` Replying (to self) to the provisioned email "Mail with base64" that contains one base64 `data:image` inline image plus one `cid:` inline image, then sending, produces a reply whose rendered HTML references both images via `cid` (exactly 2 `cid` occurrences, base64 converted to cid attachment). — `composer/reply_email_with_content_contain_image_base64_data_test.dart` · tags: `ios (default)`
  - Data: `provisioning/integration_test/eml/reply_email_with_image_base64/0.eml` (restored into bob's mailbox via backup.zip); found via search.
- [x] `CMP-10` Replying to a provisioned email and inserting an inline image without ever focusing the editor places the image above the quoted `<blockquote>` (at the first line). — `composer/reply_inline_no_focus_at_first_line_test.dart` · tags: `ios (default)`
  - Data: email "reply inline no focus" sent to self; PNG `TestImages.base64` via faked file picker.
- [x] `CMP-11` Replying to a provisioned email with no signature, placing the caret just above the quoted reply body and inserting an inline image puts the image before the `<blockquote>`. — `composer/reply_inline_focused_without_signature_test.dart` · tags: `ios (default)`
- [x] `CMP-12` With a default identity whose signature is "SIGNATURE_MARKER", replying to a provisioned email, placing the caret above the reply body and inserting an inline image yields editor HTML ordered signature, then image, then `<blockquote>`. — `composer/reply_inline_focused_with_signature_test.dart` · tags: `ios (default)`
  - Data: default identity with HTML signature `SIGNATURE_MARKER`.
- [x] `CMP-13` Forwarding the provisioned email "Forward email" (from emma, To bob, Cc alice, Bcc brian) opens a composer whose body contains the forwarded-message header block with Subject, From, To, Cc and Bcc labels (the test title also mentions Reply-To but it is not asserted). — `composer/forward_email_test.dart` · tags: `ios (default)`
  - Data: `provisioning/integration_test/eml/forward_email/forward.eml` (in bob's backup.zip); found via search.
- [x] `CMP-14` Composing to self with subject "Save draft email without Reply-To", closing the composer and choosing Save in the save-draft confirm dialog shows the "Draft saved" toast; the draft appears in Drafts and reopening it shows no Reply-To recipient field. — `composer/save_draft_then_close_composer_and_open_draft_test.dart` · tags: `ios (default)`
- [x] `CMP-15` After saving a draft via close → Save ("Draft saved" toast), reopening it from Drafts, changing the subject and closing → Save again shows the "Draft saved" toast a second time (draft update). — `composer/update_draft_email_with_messsage_success_toast_test.dart` · tags: `ios (default)`
- [x] `CMP-16` With two identities provisioned (Identity 1 default, Identity 2), switching the From field to Identity 2 and using "Save as draft" from the composer "More" menu, then reopening the draft from Drafts shows Identity 2 selected in From. — `composer/change_identity_in_draft_email_test.dart` · tags: `ios (default)`
  - Data: 2 identities ("Identity 1"/"Signature 1" default, "Identity 2"/"Signature 2").
- [x] `CMP-17` A draft to self with a PNG attachment (wait for "Attachments uploaded successfully") saved via close → Save, reopened from Drafts, can be saved again twice via "Save as draft" after editing the subject (" edited", " again") with each save succeeding (no error dialog). — `composer/save_draft_with_attachment_then_open_and_save_draft_again_test.dart` · tags: `ios` `web`
  - Data: `test-attachment.png` from `TestImages.base64`; unique subject with timestamp.
- [x] `CMP-18` Same as CMP-17 but with an inline image in the body instead of an attachment: the reopened draft can be re-saved twice successfully. — `composer/save_draft_with_inline_image_then_open_and_save_draft_again_test.dart` · tags: `android` `ios` `web`
  - Data: `test-inline.png` from `TestImages.base64`.
- [x] `CMP-19` From the Templates folder, composing an email with subject "test subject" and choosing "Save as template" (More menu), then closing with Discard, shows it in Templates; reopening it, changing the subject to "test subject updated" and saving as template again shows the updated subject in the list. — `composer/save_as_template_test.dart` · tags: `ios (default)`
  - Web: the first "Save as template" makes the Templates folder (a new account has none; tmail-flutter makes it at startup); the message is then kept as a template, the drafts its composer saved destroyed, so closing asks nothing instead of "Discard changes". Spec: `tests/composer-templates.spec.ts`.
- [x] `CMP-20` A message to self with a PNG attachment saved as template shows "Save message to template folder successfully"; reopened from Templates and edited twice, each "Save as template" shows "Update message to template folder successfully". — `composer/save_template_with_attachment_then_open_and_save_template_again_test.dart` · tags: `ios` `web`
- [x] `CMP-21` Same as CMP-20 but with an inline image in the body: first template save shows the "saved" toast and the two subsequent saves of the reopened template show the "updated" toast. — `composer/save_template_with_inline_image_then_open_and_save_template_again_test.dart` · tags: `ios` `web`
  - Spec: `tests/composer-templates.spec.ts` (CMP-20 and CMP-21 also check the file or the inline image of the template on the server).
- [x] `CMP-22` With an open composer filled with recipient, subject and body, the composer is kept in the browser (IndexedDB) while typing; after a page reload it is restored from that cache with the same subject, recipient and body, and closing it normally (discarding if asked) removes the record. — `composer/restore_composer_after_reload_test.dart` · tags: `web`
- [ ] `CMP-23` With a composer open and a subject typed, sending the app to background (Home) and reopening it keeps the composer open with the subject intact (auto-save on app pause). — `composer/android_composer_auto_save_test.dart` · tags: `ios (default)`
  - N/A web: relies on Android app lifecycle (Home button / app paused, native automator). Web equivalent: composer survives page reload/close via snapshot, covered by CMP-22 (and drafts CMP-14).
- [x] `CMP-24` A `mailto:shared-recipient@example.com?subject=Hello&body=World` share intent emitted before the mailbox is loaded is buffered, and once the mailbox is ready the composer opens with To = shared-recipient@example.com, subject "Hello" and body "World". — `composer/share_mailto_before_mailbox_ready_opens_composer_test.dart` · tags: `android`
  - Web port: Android share intent (`receive_sharing_intent` EventChannel). Web equivalent: port as a web variant: cold-load the `/mailto?uri=mailto:…` route (protocol handler) before the mailbox is ready and assert the composer opens prefilled.
  - Web: `tests/composer-templates.spec.ts` opens the route signed out: it survives the sign-in (the return path), which tmail-flutter does not. tmail-flutter registers no protocol handler, the app does not either.
- [ ] `CMP-25` An external app sharing text with mimeType `text/plain;charset=utf-8` opens the composer with the shared text as the body. — `composer/share_text_with_charset_mimetype_opens_composer_test.dart` · tags: `android`
  - N/A web: Android share intent (text share from another app). Web equivalent: none (would require Web Share Target in a PWA manifest).
- [ ] `CMP-26` An external app sharing text with mimeType `text/html` opens the composer with the shared text as the body. — `composer/share_text_with_html_mimetype_opens_composer_test.dart` · tags: `android`
  - N/A web: Android share intent (text share from another app). Web equivalent: none (would require Web Share Target in a PWA manifest).
- [x] `CMP-27` On a desktop, composer windows sit at the bottom of the screen: Escape minimizes one to its title bar (which takes the focus and brings it back, the focus where it was), a second one opens next to it keeping what the first holds, full screen makes it a modal dialog where Escape closes it, asking to save the modified message. — web app only, no Patrol test (tmail-flutter web has the modes, Patrol never drives them)
- [x] `CMP-28` A recipient field takes a pasted list (`a@b.c, Name <d@e.f>; wrong`), shows the invalid address as such in its accessible name, reaches its chips with Backspace or ArrowLeft, removes one with Delete and edits one with Enter, and suggests the contacts of the domain (`TMailContact/autocomplete`). — web app only, no Patrol test
- [x] `CMP-29` The formatting toolbar of the body is a single tab stop (arrows, Home, End move in it), Alt+F10 reaches it and Escape goes back to the text, Tab indents in a list or leaves the editor: no keyboard trap; tooltips repeat the button names. — web app only, no Patrol test (RGAA 12.9 / 7.1)
- [x] `CMP-30` An inline image is selected with the arrow keys (or a click), Enter opens its toolbar: 25 %, Larger and the status line resize it, the saved draft keeps the width, Remove takes it out; Escape goes back to the text. — web app only, no Patrol test (keyboard alternative to the resize handles, RGAA 7.1)
- [x] `CMP-31` With a signature, a click on it when the text ends with a list puts a new line between the list and the signature. — web app only, no Patrol test
- [x] `CMP-32` Pasting from Word, Google Docs, LibreOffice or a web page keeps real lists, bold, italic, chosen colours and links, without Office classes, fonts or default black; Ctrl+Shift+V pastes plain text. — web app only, no Patrol test
- [x] `CMP-33` `c` opens the composer with the focus in To, typing `c` there types it (no shortcut in the composer), and closing it gives the focus back to the email row it was opened from. — web app only, no Patrol test
- [x] `CMP-34` A message saves itself as a draft after five minutes without a change ("Draft saved" under it); closing it then asks nothing, says "Draft saved" and offers "Discard", which destroys the draft made by this composer. — web app only, no Patrol test (tmail-flutter web has no autosave)
- [x] `CMP-35` A file being uploaded shows its progress and is cancelled when removed; files above the size limit of the server (`maxSizeUpload`, `maxSizeAttachmentsPerEmail`) are refused with "Maximum files size". — web app only, no Patrol test
- [x] `CMP-36` A message refused by the server (over quota) stays in the composer, the reason said in an alert. — web app only, no Patrol test
- [x] `CMP-37` A draft save refused by the server (over quota) leaves the previous version of the draft on the server, untouched; once the request destroying a previous version is lost, the next save destroys it with the version it replaces, leaving one draft. — web app only, no Patrol test (tmail-flutter saves a draft with create and destroy in one `Email/set`)
- [x] `CMP-38` The remote images, backgrounds and fonts of a quoted email are blocked in the composer (CSP of the quote frame, loaded from a `blob:` URL, no referrer) and stay blocked once the quote is made editable (`data-blocked-src`), but go with the message. — web app only, no Patrol test
- [x] `CMP-39` "Edit the quoted message" is reached with Tab from the text and turns the quote into editable content, its `cid:` images shown. — web app only, no Patrol test
- [x] `CMP-40` A reply saved as a draft reopens from Drafts with its quote as it was, and is sent in the thread (`In-Reply-To`); the original gets `$answered` (the draft keeps it in `X-Twake-Answering`, the message sent does not carry it). — web app only, no Patrol test (tmail-flutter forgets the original of a reopened draft)
- [x] `CMP-41` The quote of a forwarded newsletter keeps its tables, images, links and styles (scoped to the quote), its `cid:` logo sent again. — web app only, no Patrol test (from the quote fidelity measure of the composer spike)
- [x] `CMP-42` A reply is received with `In-Reply-To` and `References` of the original, the text, the reply header and the quote (HTML and `>` text), and the original gets `$answered`. — web app only, no Patrol test
- [x] `CMP-43` The signature of the default identity (HTML, sanitized: no style sheet, no event handler) goes between the text and the quote of a reply; choosing another identity (text signature, escaped, lines kept) replaces it in place; the sent message keeps tmail-flutter's `tmail-signature` wrapper above the quote. — web app only, no Patrol test (from the signature spec of the composer spike)
- [x] `CMP-44` An image dropped on the body is inserted inline where it is dropped, not attached; the same image dropped elsewhere in the composer (the subject) is attached. — web app only, no Patrol test
- [x] `CMP-45` An inline image is resized with the mouse (its corner handle), the width kept. — web app only, no Patrol test (CMP-30 does it with the keyboard)
- [x] `CMP-46` The remote images of a draft reopened from Drafts (outside the quote) are not loaded until "Show" of the banner, and go with the message sent. — web app only, no Patrol test (tmail-flutter loads them)
- [x] `CMP-47` A save whose answer is lost (the version created on the server, its id unknown) leaves no stray draft: the next save finds it by its `X-Twake-Draft-Session` header and destroys it. — web app only, no Patrol test
- [x] `CMP-48` A message is received with the Reply-To of its identity (named after it) when none is typed, and its Bcc, shown in the composer, gets a copy (tmail-flutter `createReplyToRecipients`, `_applyBccEmailAddressFromIdentity`). — web app only, no Patrol test
- [x] `CMP-49` With three composers on a tablet (one fills the screen) or a 1700 px desktop (the dock holds two), the others are listed in a named "+N messages" menu button (in the title bar of the full screen one, at the start of the dock), reachable with the arrow keys; choosing one shows it. — web app only, no Patrol test (issue #50)
  - Spec: `tests/composer.spec.ts`, on `chromium` (it resizes the window: three composers cannot be opened on a tablet).
- [x] `CMP-50` An answer whose draft was autosaved comes back after a reload on its text, the recipients folded, as it was left; a new message still opens in To. — web app only, no Patrol test (issue #52)
  - Spec: `tests/composer-send.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`).
- [x] `CMP-60` An email sent by another user to an alias of the account (whose identity James creates) is answered from that alias identity, selected in the composer ("From"), and received from the alias (axe). — web app; tmail-flutter answers from the default identity (`setup_selected_identity_extension.dart`): intended difference (issue #39)
  - Spec: `tests/composer-reply.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`). Passes in CI.

## ATT — Attachments (2)

- [x] `ATT-01` Opening a provisioned email to self with attachments and clicking "Download all" triggers the download (iOS: native Save dialog; web: a downloaded file whose name starts with `TwakeMail-`, `.zip`); the button is hidden when the server does not advertise `com:linagora:params:downloadAll` or the email has a single attachment (unit tests). — `attachments/download_all_attachments_test.dart` · tags: `ios` `web`
  - Data: email "download all attachments subject" with 3 generated `test.txt` files (contents file1/file2/file3).
- [ ] `ATT-02` Opening the provisioned email "Greeting Card" (via search), whose inline image part has a Content-ID but no Content-Disposition, renders the image inline as a base64 `data:image/…;base64` source in the HTML body. — `attachments/no_disposition_inline_test.dart` · tags: `ios (default)`
  - Data: `provisioning/integration_test/eml/no_disposition_inline/no_disposition_inline.eml` (in bob's backup.zip).

## EML — Reading and acting on an email (27)

- [x] `EML-01` Given a self-sent email whose body is a single short "Lorem ipsum…" sentence, opening it from the Inbox list renders that full sentence in the email body viewer. — `email_detailed/display_email_with_short_content_test.dart` · tags: `ios (default)`
  - Spec: `tests/email.spec.ts`. Passes in CI.
- [ ] `EML-02` Given a self-sent email with a very long plain body (hundreds of "Lorem ipsum" sentences), opening it renders the body and the reading pane scrolls all the way down to the end-of-content divider, at which point the subject header has scrolled out of view. — `email_detailed/display_and_scroll_email_with_long_content_test.dart` · tags: `ios (default)`
- [x] `EML-03` Given a self-sent email whose body is `<script>alert("XSSRobot")</script>`, opening it shows no alert dialog (no "XSSRobot"/"says"/"OK" text) and the sanitized rendered HTML no longer contains the script payload. — `email_detailed/display_email_with_xss_content_test.dart` · tags: `ios (default)`
  - Spec: `tests/email.spec.ts`. Passes in CI.
  - Data: in Playwright, assert with `page.on('dialog')` never firing and the body iframe containing no `<script>`.
- [x] `EML-04` Given a self-sent HTML email with 12 `<img>` tags using oversize (2000px) or normal (100px) dimensions via `style`, `width/height` attributes or both, the rendered body has no horizontal scroll: oversize images fit the pane with their declared ratio (2000 × 200 stays 10:1), normal ones keep their 100 × 100. — `email_detailed/deformed_inlined_image_test.dart` · tags: `ios (default)`
  - Spec: `tests/email.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`). Web variant: the images are `data:` PNGs (remote ones wait for the user) and the rendered boxes are measured; tmail-flutter's script strips the attributes of the images wider than the screen, the frame here runs no script: the sanitizer turns the declared size into an `aspect-ratio` (`imageSize.ts`). Passes in CI.
- [ ] `EML-05` After composing and sending to self an email with an inline image inserted from a file (editor content holds a `data:image/…;base64` + `cid:` image), opening the received email renders the inline image, with exactly one `cid` reference in the displayed HTML. — `email_detailed/view_inline_image_test.dart` · tags: `ios (default)`
  - Data: PNG generated from a base64 constant (`ImageResources.base64`).
- [x] `EML-06` Opening a self-sent email and choosing More (⋯) > "Archive message" moves it: after going back and opening the Archive folder, the email is listed there. — `email_detailed/archive_email_test.dart` · tags: `ios (default)`
  - Spec: `tests/actions.spec.ts`, also run on the `mobile` and `tablet` projects. Passes in CI.
- [x] `EML-07` Opening a self-sent email and choosing More (⋯) > "Move to trash" closes the email view and the email is listed in the Trash folder. — `email_detailed/delete_email_test.dart` · tags: `ios (default)`
  - Spec: `tests/actions.spec.ts`, also run on the `mobile` and `tablet` projects. Passes in CI.
- [ ] `EML-08` With "thread" mode enabled in Settings > Preferences, opening a self-sent email and clicking the "delete thread" button shows the "Moved to Trash" toast. — `email_detailed/delete_thread_to_trash_test.dart` · tags: `ios (default)`
  - Data: requires toggling the thread (conversation) preference first; only the toast is asserted, not the Trash content.
- [x] `EML-09` Opening a self-sent email and choosing More (⋯) > "Mark as spam" closes the email view and the email is listed in the Spam folder. — `email_detailed/mark_as_spam_email_test.dart` · tags: `ios (default)`
  - Spec: `tests/actions.spec.ts`. Passes in CI.
- [x] `EML-10` In an opened self-sent email, the More (⋯) menu offers "Starred"; selecting it makes the menu offer "Not starred" instead, and selecting that restores the "Starred" option (star/unstar round-trip). — `email_detailed/mark_as_star_email_test.dart` · tags: `ios (default)`
  - Spec: `tests/actions.spec.ts` ("Star" / "Unstar"). Passes in CI.
- [x] `EML-11` Opening a self-sent email (which marks it read) and choosing More (⋯) > "Mark as unread" closes the email view and the email's list row shows the unread indicator again. — `email_detailed/mark_as_unread_email_test.dart` · tags: `ios (default)`
  - Spec: `tests/actions.spec.ts`. Passes in CI.
- [x] `EML-12` Opening a self-sent email and choosing More (⋯) > "Move message", then picking the Templates folder in the destination picker, removes the email from the Inbox list and lists it in Templates. — `email_detailed/move_email_to_folder_test.dart` · tags: `ios (default)`
  - Spec: `tests/actions.spec.ts`; "Templates" is a folder created by the spec. Passes in CI.
- [ ] `EML-13` Given a self-sent email with one .txt attachment, tapping the attachment exports/previews it natively and, after navigating back, the email view is still shown with no lingering "Preparing to export" loading dialog. — `email_detailed/export_attachment_test.dart` · tags: `ios (default)`
  - Web port: relies on the native export flow (download to a temp file then open the OS previewer/share sheet) and the system back gesture. Web equivalent: clicking an attachment downloads it or opens the in-app previewer; port as a web variant: clicking the attachment chip triggers a download (`page.waitForEvent('download')`) / preview and no "Preparing to export" dialog stays on screen.
  - Data: .txt attachment created on the fly ("attachment content").
- [x] `EML-14` Replying (Reply button) to a received email without a Reply-To header opens the composer with subject `Re: Reply email without Reply-To` and To = the original From (`emma@example.com`) only. — `email_detailed/reply_email_without_reply_to_test.dart` · tags: `ios (default)`
  - Data: bob mailbox `backup.zip`, "Reply Emails" folder (source `provisioning/integration_test/eml/reply_email/without-reply-to.eml`: From emma, To bob, Cc alice, Bcc brian); the email is reached via search + "Show all results".
- [x] `EML-15` Replying to a received email that has a `Reply-To: emma-reply-to@example.com` header opens the composer with subject `Re: Reply email with Reply-To` and To = the Reply-To address (not the From). — `email_detailed/reply_email_with_reply_to_test.dart` · tags: `ios (default)`
  - Data: bob `backup.zip`, "Reply Emails" folder (`eml/reply_email/with-reply-to.eml`); reached via search.
- [x] `EML-16` "Reply all" on a received email (From emma, Reply-To emma-reply-to, To bob, Cc alice, Bcc brian) opens the composer with subject `Re: Reply all email`, To = {emma-reply-to@example.com, emma@example.com}, Cc = {alice@example.com}, Bcc = {brian@example.com} (current user excluded). — `email_detailed/reply_all_email_test.dart` · tags: `ios (default)`
  - Data: bob `backup.zip`, "Reply Emails" folder (`eml/reply_email/reply-all.eml`, also carries a List-Post header); reached via search.
- [x] `EML-17` "Reply to list" on a received email carrying `List-Post: <mailto:emma-reply-to-list@example.com>` opens the composer with subject `Re: Reply to list email` and To = the List-Post address only. — `email_detailed/reply_to_list_email_test.dart` · tags: `ios (default)`
  - Data: bob `backup.zip`, "Reply Emails" folder (`eml/reply_email/reply-to-list.eml`); reached via search.
- [x] `EML-18` For each of the 9 supported UI languages (fr, en, vi, ru, ar, it, de, mn, pt-BR), after switching the language in Settings and receiving a new self-sent email, clicking Reply pre-fills the composer subject with the localized reply prefix + original subject (e.g. `Re: …`, `Ре: …`). — `email_detailed/reply_email_when_change_language_test.dart` · tags: `ios (default)`
  - Data: language changed through Settings > Language each iteration; composer closed with "discard" between iterations.
- [x] `EML-19` For each of the 9 supported languages, replying to an email whose subject already starts with that language's localized reply prefix keeps the subject unchanged (no double `Re: Re:`). — `email_detailed/reply_email_replied_when_change_language_test.dart` · tags: `ios (default)`
- [x] `EML-20` For each of the 9 supported languages, after switching the language and receiving a new self-sent email, clicking Forward pre-fills the composer subject with the localized forward prefix + original subject (e.g. `Fwd: …`, `Tr: …`, `Chuyển tiếp: …`). — `email_detailed/forward_email_when_change_language_test.dart` · tags: `ios (default)`
- [x] `EML-21` For each of the 9 supported languages, forwarding an email whose subject already starts with that language's localized forward prefix keeps the subject unchanged (no double prefix). — `email_detailed/forward_email_forwarded_when_change_language_test.dart` · tags: `ios (default)`
  - Spec (EML-18 to EML-21): `tests/composer-reply.spec.ts`, in the 4 languages of the app (en, fr, ru, vi), the language set in `localStorage` until the settings exist. Passes in CI.
- [x] `EML-22` Given a self-sent email with two .txt attachments, forwarding it to self from the email view and sending returns to the email view, which still lists both attachments (attachments not lost after forward). — `email_detailed/forwarding_email_lost_attachments_test.dart` · tags: `ios (default)`
  - Data: two .txt attachments ("file1", "file2") created on the fly; only the original email view is asserted, not the forwarded copy.
- [ ] `EML-23` In an opened self-sent email, clicking the sender address opens the email address dialog offering "Copy email address", "Create a rule with this email address" and "Compose email"; after closing it, clicking the recipient address opens the same dialog. — `email_detailed/email_address_dialog/display_email_address_info_dialog_test.dart` · tags: `ios (default)`
- [ ] `EML-24` Clicking the sender address in an opened email and choosing "Copy email address" in the dialog shows the "Email address copied to clipboard" snackbar. — `email_detailed/email_address_dialog/copy_email_address_to_clipboard_test.dart` · tags: `ios (default)`
  - Data: in Playwright, grant `clipboard-read` and also assert the clipboard content.
- [ ] `EML-25` Long-pressing the sender address in an opened email copies it directly and shows the "Email address copied to clipboard" snackbar. — `email_detailed/email_address_dialog/long_press_copy_email_address_to_clipboard_test.dart` · tags: `ios (default)`
  - N/A web: long-press shortcut is a touch gesture. Web equivalent: click the address > "Copy email address" in the dialog, covered by EML-24.
- [ ] `EML-26` Clicking the sender address in an opened email and choosing "Compose email" opens a new composer whose To field contains exactly that address. — `email_detailed/email_address_dialog/compose_email_from_email_address_test.dart` · tags: `ios (default)`
- [ ] `EML-27` Clicking the sender address in an opened email and choosing "Create a rule with this email address" opens the rule (filter) creator with the condition input pre-filled with that address. — `email_detailed/email_address_dialog/create_rule_with_email_address_test.dart` · tags: `ios (default)`
- [x] `EML-28` Opening an unread email marks it read: its row loses the unread marker, the Inbox counter goes down, and the email has `$seen` on the server. — web app only, no Patrol test (Patrol relies on it implicitly in EML-11)
  - Spec: `tests/email.spec.ts`. Passes in CI.

- [x] `EML-29` Remote images of an email (img, CSS background) are not requested until the user clicks "Show" in the "Remote images hidden" banner; "Always show for this sender" then shows them right away in the other emails of that sender. — web app only, no Patrol test (tmail-flutter always loads remote images).
  - Spec: `tests/email.spec.ts`, also run on the `mobile` and `tablet` projects. The remote host is served by `page.route`, which counts the requests.
- [x] `EML-30` In the Trash, "Delete permanently" from the more menu of an open email asks first ("Delete message forever"); confirming closes the email and destroys it on the server. — web app only, no Patrol test (Patrol covers the delete forever dialog nowhere)
  - Spec: `tests/actions.spec.ts`. Passes in CI.
- [x] `EML-31` In Spam, "Remove from spam" from the more menu of an open email puts it back in the Inbox ("Marked as not spam"). — web app only, no Patrol test
  - Spec: `tests/actions.spec.ts`. Passes in CI.
- [x] `EML-32` Opening the oldest email of a scrolled list and going back each run one view transition (a slide on phones and tablets, a fade through wider); the subject takes the focus (axe on the email), then the row again, still in view; opening a search result runs one too. — web app only, no Patrol test (issue #12)
  - Spec: `tests/transitions.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`). Passes in CI.
- [x] `EML-33` With `prefers-reduced-motion: reduce`, or in a browser without the View Transitions API, the same path runs no transition and keeps the focus and the scroll. — web app only, no Patrol test (issue #12)
  - Spec: `tests/transitions.spec.ts`, reduced motion on `chromium`, `mobile` and `tablet`, without the API on `chromium`. Passes in CI.
- [x] `EML-34` The bare `https://` URLs, `www.` hosts and email addresses of a text/plain and of an HTML email are links (new tab, `noopener noreferrer`, trailing punctuation left out, `www.` opened in https); a link already there is not doubled, code is left as is; following an address with the keyboard opens a composer to it. — web app only, no Patrol test (issue #70)
  - Spec: `tests/email.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`).
- [x] `EML-35` The read receipt of an email received in a team mailbox (asked by its sender) goes out with the identity of the team mailbox (James gives one to its members) and names its address as the reader (`MDN/send` inspected, axe on the dialog). — tmail-flutter `_setUpDefaultIdentityForTeamMailbox`, `_getReceiverEmailAddress` (no Patrol test) (issue #39)
  - Spec: `tests/email.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`). Passes in CI.
- [x] `EML-36` The quoted history of an answer (the last top level `blockquote`, as tmail-flutter, or the quote of Gmail, Outlook, Thunderbird) is folded behind a "•••" button named "Show trimmed content"; Enter unfolds it and the frame grows, Space folds it again (axe). — tmail-flutter web `HtmlUtils.addQuoteToggle` (no Patrol test) (issue #49)
  - Spec: `tests/email.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`). A `<details>`/`<summary>` in the frame: no script runs there. Passes in CI.
- [x] `EML-37` With a composer open, opening an email and going back run view transitions in which the composer window is a layer of its own (`view-transition-name` set, its `::view-transition-group` exists), not part of the root snapshot; its editor is the same DOM node, keeps its text and takes the typing again. — web app only, no Patrol test (issue #93)
  - Spec: `tests/transitions.spec.ts`, on `chromium` (the phone composer fills the screen).

## THR — Thread detail (3)

- [x] `THR-01` With the "Thread" option switched on in Settings > Preferences, opening the provisioned email "Reply thread" (via search), replying with body "reply thread detail" and sending makes a new collapsed message whose preview contains that text appear in the open thread detail view (real-time update). — `thread_detail/thread_detail_reply_real_time_update_test.dart` · tags: `ios (default)`
  - Data: `provisioning/integration_test/eml/reply_email/reply-thread.eml` (in bob's backup.zip).
  - Spec: `tests/thread.spec.ts`, also on `mobile` and `tablet`. The "Thread" setting is in the account menu until the settings screens exist; the reply is filed in Sent through JMAP (`In-Reply-To`, `References`) until the composer lands (phase 3). Passes in CI.
- [x] `THR-02` With the "Thread" setting on, a mailbox lists one row per conversation (its newest email) with the number of its messages; opening it shows every message, the oldest first, the unread and the last ones expanded and the others collapsed (one line of preview), the unread ones marked read; ArrowUp / ArrowDown / Home / End move between the messages and Enter expands one. — web app, no Patrol test (tmail-flutter web collapses the list only with `FORCE_EMAIL_QUERY`, and has no message count).
  - Spec: `tests/thread.spec.ts`, also on `mobile` and `tablet`. Passes in CI.
- [x] `THR-03` The conversation actions star, then mark unread, every message of the conversation, in one request. — web app; tmail-flutter has these thread-level actions (ADR 0068) without a dedicated test.
  - Spec: `tests/thread.spec.ts`. Passes in CI.
- [x] `THR-04` A conversation row (conversations are on by default) names its participants in the order they wrote, the user as "Me" ("emma@example.com, Me, carol@example.com"), shows "(3)" and is unread when one of its messages is, all in the accessible name of its link (axe); a reply arriving by push moves it above a newer email, "(4)", without querying the list again (no `Email/query`); a search finds it as one row, "(4)". — web app only, no Patrol test (issue #11)
  - Spec: `tests/thread.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`). Passes in CI.
- [x] `THR-05` The selection bar stars, the hover button reads and the menu of a conversation row archives every message of the conversation, its copy in Sent included (tmail-flutter ADR 0068); the row leaves the Inbox (axe on the menu). — web app only, no Patrol test (issue #11)
- [x] `THR-06` An email sent to oneself (in the Inbox and, as its copy, in Sent) counts once on its row, as the conversation shows it; the menu of a conversation row answers its newest email (axe on the menu). — web app only (tmail-flutter rows have no count and no answer)
  - Spec: `tests/thread.spec.ts`. Passes in CI.
- [x] `THR-07` An expanded message of a conversation has the actions of the single email view, in a group named by its sender and date: its star stars it alone; "More" opens with the keyboard (arrows, Escape gives the focus back to it, axe with the menu open); "Mark as unread" marks it alone and collapses it, its header keeping the focus; "Move to trash" moves it alone, the conversation stays open with both messages. — web app; tmail-flutter shows each expanded message with the actions of `EmailView` (`thread_detail_on_email_action_click.dart`) without a dedicated test (issue #46)
  - Spec: `tests/thread.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`). Passes in CI.
- [x] `THR-08` The sender of an expanded message is a button opening its address menu (copy, compose, axe); "Create a rule with this email" opens the rule creator with the address. — web app; tmail-flutter `thread_detail_open_email_address_detail_action.dart` (issue #46)
  - Spec: `tests/thread.spec.ts`. Passes in CI.
- [x] `THR-09` With conversations on, a reply draft opens in the composer from Drafts; in its conversation it is marked "Draft", "Edit" (named after its recipients) opens the composer on it and "Delete draft" deletes it forever once confirmed. — web app only; tmail-flutter opens a draft in the composer (issue #51)
  - Spec: `tests/thread.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`).
- [x] `THR-10` Two messages of a conversation asking for a read receipt ask in turn (the second dialog once the first is answered, focused on "No"), not one replacing the other; "Yes" to both sends both receipts (`$mdnsent`), and the focus goes back to the conversation. — web app only, no Patrol test (issue #53)
  - Spec: `tests/thread.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`).
- [x] `THR-11` Opening a long conversation (24 messages) from a list scrolls to its first unread message and gives the focus to its header (expanded, in view, below the sticky toolbar, the subject and count read with it); `THR-12` with all messages read, the latest one. — web app; tmail-flutter `focusExpandedEmail` scrolls to the expanded message (issue #95)
  - Spec: `tests/thread-scroll.spec.ts`, on `chromium` and `mobile` (`THR-11`).
- [x] `THR-13` From a search result the conversation opens on the message that matched; `THR-14` from a link `/mailbox/:id/email/:emailId` on that message. — web app (issue #95)
  - Spec: `tests/thread-scroll.spec.ts`, on `chromium` and `mobile`.
- [x] `THR-15` The scroll is instant, never smooth (a smooth one would fight the view transition, issue #108); `THR-16` instant with `prefers-reduced-motion`; `THR-17` expanding, collapsing a message or a reply arriving by push does not move the view. — web app (issue #95)
  - Spec: `tests/thread-scroll.spec.ts` (`THR-17` also on `mobile`).

## SRCH — Search (14)

- [x] `SRCH-01` Given a self-sent email with subject `<Search snippets html escape>`, searching for that text and showing all results lists the email with the subject rendered literally, angle brackets included (no `&lt;`/`&gt;` entities, no HTML interpretation). — `search/search_snippets_with_html_escape_test.dart` · tags: `ios (default)`
  - Spec: `tests/search.spec.ts`, also on `mobile` and `tablet`. Searches "snippets html escape": the memory backend misses longer queries (`README.md`). Passes in CI.
- [x] `SRCH-02` Given 3 self-sent emails with subject "Search snippet results" and the keyword placed at the start, middle or end of a long body (one with a .txt attachment named after the keyword), searching for the keyword and showing all results highlights the keyword in the subjects and body snippets of the result rows (12 highlighted "Search" spans expected). — `search/search_result_highlights_test.dart` · tags: `ios (default)`
  - Data: the exact count (12) is implementation-specific; on web, assert each row's subject and snippet contain a highlighted (`<mark>`/bold) keyword.
  - Spec: `tests/search.spec.ts`. Self-sent copies saved to Trash (left out of the search) so each email is listed once. Passes in CI.
- [x] `SRCH-03` Given 3 self-sent emails with subject "Search snippet suggestions" (keyword at start/middle/end of the body, one with attachment), typing the keyword in the search field shows quick-search suggestion rows with the keyword highlighted (10 highlighted spans on mobile; on web only highlighted rich text in the suggestion tiles is checked). — `search/search_suggestion_highlights_test.dart` · tags: `android` `ios` `web`
  - Spec: `tests/search.spec.ts`, also on `mobile` and `tablet`; also checks the combobox pattern (arrows, `aria-activedescendant`, Escape). Passes in CI.
- [x] `SRCH-04` Given two self-sent emails "Quicksearchsuggestion attached" (with a .txt attachment) and "Quicksearchsuggestion plain", typing the keyword and clicking the "Has attachment" chip in the suggestion dropdown marks the chip selected immediately, and a single submit (Enter) returns only the attached email. — `search/apply_quick_search_filter_from_suggestion_test.dart` · tags: `web`
  - Spec: `tests/search.spec.ts`. Passes in CI.
- [x] `SRCH-05` After typing a keyword and selecting the "Has attachment" chip in the suggestion dropdown, opening the advanced search form shows its "Has attachment" checkbox already checked (shared committed filter). — `search/sync_quick_search_filter_to_advanced_search_test.dart` · tags: `web`
  - Spec: `tests/search.spec.ts`. Passes in CI.
- [x] `SRCH-06` Given a self-sent email "Persist search filter" with an attachment, searching for "Persist search filter", enabling the "Has attachment" filter, then changing the query to "Persist search" keeps the attachment filter selected and the email still listed. — `search/persist_filter_when_change_search_input_text_test.dart` · tags: `ios (default)`
  - Spec: `tests/search.spec.ts`. Passes in CI.
- [x] `SRCH-07` Given labels "search-label" (one self-sent email tagged with it) and "search-empty-label" (no email), searching by "search-label" lists the tagged email and searching by "search-empty-label" shows the empty-results view. — `search/search_email_by_label_test.dart` · tags: `android` `ios` `web`
  - Web port: the label is picked in the "Label" select of the advanced search.
  - Data: labels created via JMAP and applied as keywords at send time. Web path uses the advanced search form label dropdown + Search button; mobile uses the "Labels" filter chip in the search screen.
  - Spec: `tests/search.spec.ts`, `test.fixme`: labels (`Label/*`, `com:linagora:params:jmap:labels`) come with phase 4.
- [x] `SRCH-08` Given labels "Search Tag 1/2/3" with 3 self-sent emails each, opening search and picking each label in turn from the "Labels" filter menu lists at least 3 emails for that label. — `search/search_email_with_tag_test.dart` · tags: `android` `ios` `web`
  - Web port: the label is picked in the "Label" select of the advanced search; results counted once per subject (the memory image also returns the Sent copy of an email sent to oneself).
  - Data: labels created via JMAP, emails sent with the label keyword.
  - Spec: `tests/search.spec.ts`, `test.fixme`: labels (`Label/*`, `com:linagora:params:jmap:labels`) come with phase 4.
- [x] `SRCH-09` Given 5 emails "relevance" sent from the user to alice, brian, charlotte, david and emma, searching "relevance", setting the date filter to "Last 7 days" then the sort order to "Relevance" lists exactly those 5 emails. — `search/search_email_by_date_time_and_sort_order_relevance_test.dart` · tags: `android` `ios` `web`
  - Data: second-party users alice/brian/charlotte/david/emma@example.com must exist (results live in the Sent folder).
  - Spec: `tests/search.spec.ts`, recipients created as test users. Passes in CI.
- [x] `SRCH-10` Given 5 emails "Relevance by default" sent to alice…emma, searching that text and showing all results displays the sort-order filter button labelled "Relevance" (default search sort). — `search/search_email_with_sort_order_relevance_by_default_test.dart` · tags: `ios (default)`
  - Spec: `tests/search.spec.ts`. Passes in CI.
- [x] `SRCH-11` Searching "hello" lists exactly the 5 emails from alice…emma ("<Name> send Bob"), and selecting each sort order checks the result order: most recent, oldest, sender A→Z / Z→A, subject A→Z / Z→A, size ascending / not-ascending (relevance only checks the selection succeeds). — `search/search_email_with_sort_order_test.dart` · tags: `android` `ios` `web`
  - Data: bob mailbox `backup.zip`, "Search Emails" folder (source `provisioning/integration_test/eml/search_email_with_sort_order/0-4.eml`, dated 29 Oct–2 Nov 2024, each containing "hello").
  - Spec: `tests/search.spec.ts`; the size orders are compared with the order the server returns (two fixtures have the same size). Passes in CI.
- [x] `SRCH-12` When "Oldest" was previously stored as the user's sort-order preference, a search started from the inline search bar ("sort order persisted", 5 emails sent to alice…emma) returns at least 5 results sorted oldest first. — `search/sort_order_persisted_from_search_bar_test.dart` · tags: `web`
  - Data: the Flutter test stores/reloads the preference through the controller (no real relaunch); in Playwright, pick "Oldest", reload the page, then search.
  - Spec: `tests/search.spec.ts`, the preference stored in `localStorage` before the page loads. Passes in CI.
- [x] `SRCH-13` Given an unread self-sent email "Mobile Search action state sync", in search results (mobile layout) selecting it and applying "Mark as read" immediately removes its unread indicator, then (tablet layout) selecting it and applying "Archive" immediately shows the row as located in Archive, without leaving search. — `search/mobile_search_action_state_sync_test.dart` · tags: `android` `ios` `web`
  - Data: on web the test resizes the viewport (mobile: long-press selection; tablet: avatar click selection) and triggers the selection toolbar actions; port both viewports with Playwright `setViewportSize`.
  - Spec: `tests/search.spec.ts`, on `chromium`, `mobile` and `tablet`. Read from the row toggle; archived through JMAP until the email actions land (phase 2, lot A), push showing the row in Archive. Passes in CI.
- [x] `SRCH-14` On the dashboard, the search field is not focused on load, and a right-click (secondary mouse button) on it gives it focus. — `search/right_click_focus_search_field_test.dart` · tags: `web`
  - Spec: `tests/search.spec.ts`. Passes in CI.
- [x] `SRCH-15` With an empty query, focusing the field shows the quick filters only: no empty listbox, the combobox collapsed (`aria-expanded="false"`, no `aria-controls`) and the live region saying the quick filters follow the field, also after typing then clearing; a quick filter picked there adds "Search with these filters", which runs it. The advanced search opened from the empty query has the picked filter checked, its "Folder" label naming the select, and its submit button in view; on a desktop and a tablet it is the card laid over the search field (700 px wide under the desktop search) that Escape closes, on a phone a full screen dialog with its title and a Cancel button in view (the only way out there). axe on the dropdown and on the dialog. — web app only, no Patrol test (issue #13)
  - Spec: `tests/search.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`). Passes in CI.

## LBL — Labels (12)

- [x] `LBL-01` In the sidebar/mailbox menu, the "add new label" button opens the Create label modal; entering a unique name and description and confirming shows the toast "You successfully created the <name> label". — `labels/create_new_a_tag_test.dart` · tags: `ios (default)`
- [x] `LBL-02` With labels "Edit Tag 1"/"Edit Tag 2" provisioned, opening the label's context menu in the sidebar (long press on mobile), choosing Edit, renaming it to "New edit tag 1" and confirming shows the new name in the sidebar label list. — `labels/edit_a_label_test.dart` · tags: `ios (default)`
  - Web port: the label menu is its ⋮ button in the sidebar; renaming it to an existing name is refused first ("A tag with this name already exists").
  - Data: labels created via JMAP (Label/set) before the test.
- [x] `LBL-03` With labels "Delete Tag 1"/"Delete Tag 2" provisioned, opening the label's context menu in the sidebar (long press on mobile), choosing Delete and confirming in the delete-label dialog removes "Delete Tag 1" from the sidebar. — `labels/delete_a_tag_test.dart` · tags: `ios (default)`
  - Web port: the label menu is its ⋮ button in the sidebar.
- [x] `LBL-04` With labels Tag 1/2/3 each applied to 3 provisioned emails (subjects "Email N subject Tag X"), opening each label from the sidebar lists at least its 3 tagged emails. — `labels/display_view_with_all_email_with_tag_test.dart` · tags: `ios (default)`
  - Data: two labels of three emails each, sent by another account (an email sent to oneself has a Sent copy that the memory image also returns for `hasKeyword`).
  - Data: emails sent to self with the label keyword set.
- [x] `LBL-05` With "Tag with email" applied to 3 emails and "Tag without email" applied to none, opening the first label lists its 3 emails and opening the second shows the empty thread view "You don't have any emails tagged with this.". — `labels/display_empty_view_when_open_tag_test.dart` · tags: `ios (default)`
- [x] `LBL-06` With "Tag 1" applied to 2 emails located in Trash, opening the label from the sidebar lists them with their folder info ("Trash") displayed. — `labels/display_folder_info_when_open_mail_from_tag_test.dart` · tags: `ios (default)`
  - Data: tagged emails provisioned then moved to the Trash role mailbox.
- [x] `LBL-07` In the detail view of a provisioned email, More → "Label as" opens the add-label modal; "Create a new label", entering a unique name and confirming creates the label and applies it, with toast `Label "<name>" added to email`. — `labels/create_a_new_tag_from_an_email_test.dart` · tags: `ios (default)`
  - Web port: "Label as" opens the choose-label modal of every entry point; the label created there is checked, then "Add label" puts it on.
- [x] `LBL-08` With no labels existing, selecting an email in the list (long press on mobile), then More → "Label as" opens the Choose Label modal showing the empty state "No Labels yet" with a "Create a label" button and no label list. — `labels/display_no_label_yet_widget_when_open_choose_label_modal_test.dart` · tags: `ios (default)`
  - Web port: the row checkbox, then "Label as" in the "More" menu of the selection toolbar.
- [x] `LBL-09` From the Choose Label modal empty state (as in LBL-08), "Create a label" → entering a unique name and confirming shows "You successfully created the <name> label", and the modal now displays a label list containing the new label instead of the empty state. — `labels/create_label_from_no_label_yet_widget_test.dart` · tags: `ios (default)`
- [x] `LBL-10` With one existing label ("Existing Label 1", applied to an email), selecting that email and opening "Label as" shows the label list (no empty state) plus a "Create a label" button; creating a new label from it shows the success toast and the new label in the list. — `labels/create_label_from_choose_label_modal_with_existing_labels_test.dart` · tags: `ios (default)`
- [x] `LBL-11` With "Remove Tag 1" applied to one email, opening that label from the sidebar and then the email shows the label chip next to the subject; clicking the chip's remove (×) button shows the toast `Label "Remove Tag 1" removed from email`. — `labels/remove_a_label_from_email_test.dart` · tags: `ios (default)`
- [x] `LBL-12` In the conversation view (on by default), the conversation shows the label of one of its emails under its subject; its × takes the label off that email. — web app only, no Patrol test
- [x] `LBL-13` An expanded message of a conversation shows its own labels; the × of one takes it off that message alone (axe). — web app; tmail-flutter `remove_label_from_email_extension.dart` in the thread detail (issue #46)
  - Spec: `tests/labels.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`). Passes in CI.

## SET — Settings (6)

- [x] `SET-01` In Settings → Preferences, toggling "Thread" (conversation view) turns it on and toggling again turns it off; toggling "Sender set important flag" (on by default) turns it off and toggling again turns it back on. — `setting/preferences/toggle_preferences_test.dart` · tags: `web` `android` `ios`
  - Data: "Thread" is a local preference; "Sender set important flag" is a server-side (JMAP settings) preference.
  - Web port: "Thread" is on by default in the React app (off in tmail-flutter), so it goes off then on; the switches are named by their toggle text ("Enable thread", "Display sender-set important flag").
- [x] `SET-02` After creating identities "Default Identity 1" and "Default Identity 2" (Settings → Profiles → Create new identity, name only, Save; each then listed), clicking identity 1's radio marks it as default (selected radio), then clicking identity 2's radio marks identity 2 as default. — `setting/identity/select_identity_as_default_test.dart` · tags: `ios (default)`
  - Data: only checks that the clicked identity shows the selected radio, not that the previous one is deselected.
- [x] `SET-03` In Settings → Language & region, picking "English" from the language dropdown shows the title "Language"; reopening the dropdown (menu visible) and picking Vietnamese immediately re-localises the title to "Ngôn ngữ". — `setting/language/change_language_test.dart` · tags: `ios (default)`
  - Web port: the language is a select of the four languages of the app; the choice is also kept in the `language` server setting, which a new browser follows.
- [x] `SET-04` In Settings → Profiles, an identity created with a Reply-To (`Name <address>`), a Bcc and a signature lists them and is stored so; editing it refuses an invalid Bcc (named under the field, focused, nothing saved), then saves a new name and an emptied Bcc; the identity of the account has no delete button; deleting the new one asks for confirmation and removes it. — web app only, no Patrol test
- [x] `SET-05` An image inserted in the signature of a new identity is uploaded and published (`PublicAsset/set`): the saved signature shows its public URL with `public-asset-id`, and the asset is tied to the identity. — web app only, no Patrol test
- [x] `SET-06` "Settings" in the account menu opens Profiles beside the sections on a desktop, the list of the sections (with what each is for) on phones and tablets; a section opens with its title focused and in the page title, the back buttons return to the list and to the mail. — web app only, no Patrol test
- [x] `SET-07` In Settings → Forwarding, an address of the domain is added (no warning), "Keep a copy in Inbox" appears and is turned off, a new email reaches the address; an outside address asks first with the deployment's `FORWARD_WARNING_MESSAGE` (declined, then accepted) and the banner shows it, the address marked "External domain"; both are removed after confirmation. — web app only, no Patrol test
- [x] `SET-08` In Settings → Vacation, turning the response on with a past start date first refuses an empty message, then saves it (subject and rich message stored); the banner "Your vacation responder is enabled." shows in the settings and over the mail, and its "End now" turns the response off and hides it. While the response is off, the message editor is disabled like the other fields (`aria-disabled`, not editable, issue #61). — web app only, no Patrol test (tmail-flutter's `VacationNotificationMessageWidget`)
- [x] `SET-09` In Settings → Folder visibility, system folders have no button; "Hide" on a personal folder takes it out of the folder tree, "Show" brings it back. — web app only, no Patrol test

## RULE — Email rules (2)

- [x] `RULE-01` From an opened email, clicking the sender address → "Create a rule with this email address" opens the rule creator; saving rule "Reject rule" with action "Reject it" shows the reject-confirmation warning; after confirming, the rule is listed in Settings → Email rules; editing it to add "Mark as seen" and "Star it" and saving shows the warning again, and after confirming the creator closes with the rule still listed. — `email_rules/create_edit_rule_with_reject_test.dart` · tags: `web` `android` `ios`
  - Data: one email sent to self via JMAP (so the sender is the user's own address).
  - Web port: the sender of the email opened alone (`emailsOneByOne`) is a button whose menu has "Create a rule with this email"; the creator opens in Settings → Email rules. Adding actions next to "Reject it" is not offered (a rejected email gets no other action, which tmail-flutter enforces on save anyway): the edit adds a condition (Subject contains "reject") instead, and the warning shows again.
- [x] `RULE-02` In Settings → Email rules (empty state "No Rules Configured"), a rule on Subject moving to a folder picked in the folder picker and marking as seen files the next matching email there, read; deleting it after confirmation brings the empty state back. — web app only, no Patrol test

## CAL — Calendar events (7)

The card is tmail-flutter's "Orange Bar" design (linagora/tmail-flutter#4623, #4831, #4851). The
fixtures (`fixtures/eml/calendar/`) carry their `.ics` in 8 bit so that `importEml({ replace })`
can put the test user among the attendees; `calendar_counter_web.eml` is `calendar_counter.eml`
without its base64 parts. The memory image parses events but cannot answer them: answering needs
the CalDAV server (esn-sabre) of a Twake Workplace, `CalendarEvent/accept` and
`CalendarEventAttendance/get` answer `serverFail` ("Failed to resolve 'esn_sabre'"). `CAL-06` and
`CAL-07` are `fixme` for that reason and were checked on the devbox.

- [x] `CAL-01` Searching "Proposed new time" (show all results) and opening that COUNTER iMIP email shows an event card with "Yes" and "Mail to attendees" buttons, no "No"/"Maybe" buttons, and the banner text "… has proposed changes to the event". — `calendar/calendar_event_counter_test.dart` · tags: `ios (default)`
  - Data: bob backup.zip, "Calendar" folder (from `eml/calendar/calendar_counter.eml`, METHOD:COUNTER, event "Come for a chat").
  - Spec: `tests/calendar.spec.ts`, with `calendar/calendar_counter_web.eml`. Passes in CI.
- [x] `CAL-02` On the same COUNTER event email, clicking "Mail to attendees" opens the composer with subject "Re: Come for a chat" (localised reply prefix + event title). — `calendar/mail_to_attendees_event_email_test.dart` · tags: `ios (default)`
  - Data: same as CAL-01; the subject is asserted on the composer controller's value.
  - Spec: `tests/calendar.spec.ts`; also asserts the recipients (everyone but the user). Passes in CI.
- [x] `CAL-03` An invitation (REQUEST) shows the badge "<organizer> has invited you to a meeting", when in the time zone of the browser and how it repeats ("Every 2 weeks, on Monday, 5 times"), where, the meeting link with "Copy link" (no "Join": tmail-flutter#4622), the organizer then every attendee with their answer, Yes / Maybe / No (`aria-pressed`), "See in your Calendar" to `<CALENDAR_SPA_URL>/events/<uid>`, and the description as text after the card; axe. — web app only (`calendar_event_card_mapper.dart`)
  - Spec: `tests/calendar.spec.ts`, `@mobile`. Passes in CI.
- [x] `CAL-04` A cancellation (CANCEL) shows "<organizer> has canceled a meeting" and offers no answer, only "Mail to attendees"; axe. — web app only
- [x] `CAL-05` An invitation the user is not part of says "You are not invited to this event…", without answers nor calendar link. — web app only
- [ ] `CAL-06` Maybe answers the invitation (`CalendarEvent/maybe`): toast "You may attend this meeting", the button pressed, still after a reload (`CalendarEventAttendance/get`). — web app only
  - `fixme` on the memory image (no esn-sabre); checked on the devbox.
- [ ] `CAL-07` Yes on a counter proposal (`CalendarEventCounter/accept`): toast "You accepted the proposed time for this meeting". — web app only
  - `fixme` on the memory image (no esn-sabre).

## PUSH — Real-time updates (1)

- [x] `PUSH-01` An email sent to self appears in the list without a manual refresh, unread and unstarred; when another client marks it read and then starred (direct JMAP `Email/set`), the row updates live to read and then to starred. — `web_socket/web_socket_test.dart` · tags: `ios (default)`
  - Spec: `tests/push.spec.ts`. Passes in CI.
  - Data: requires JMAP WebSocket push from the server.
- [x] `PUSH-02` An email entering the Inbox below the loaded rows (70 conversations, one a minute) is not listed yet; scrolled to, it shows once, between the rows it was received between, and no row is listed twice. — web app only (issue #43)
  - Spec: `tests/push.spec.ts`. The same date as the last loaded row is checked by unit tests (`patchEmailList.spec.ts`), the server deciding the order of equal dates. Passes in CI.
- [x] `PUSH-03` An email delivered after the list loaded and before the push channel opened (its WebSocket ticket held back) shows once the channel opens, without user action. — web app only (issue #43)
  - Spec: `tests/push.spec.ts`. Passes in CI.
- [x] `PUSH-04` During a search grouped by conversation, scrolled down, a push of an email in the Trash (left out of the search) queries nothing and keeps the scroll; one in the Inbox queries the results again, the loaded rows and the scroll kept, the new conversation at the top. — web app only (issue #43)
  - Spec: `tests/push.spec.ts`, 40 conversations: beyond 256 messages the memory image hangs the updates of the other tests (linagora/tmail-backend#2684); more than 256 loaded rows are measured by `PERF-05` (`docs/perf/sync.md`). Passes in CI.

## APPGRID — App grid (2)

- [x] `APPGRID-01` The app-grid button is visible in the thread view; opening it lists exactly the expected apps in order (iOS: "Twake Drive", "Twake Chat"), and launching each app and coming back to Twake Mail still shows the same list. — `app_grid/app_grid_test.dart` · tags: `ios (default)`
  - Data: needs `APP_GRID_AVAILABLE=supported` and the server app-grid configuration. The mobile robot launches the native apps and returns via the Home button. A web robot also exists (dashboard items Twake, Contacts, Calendar, TMail, TDrive, Teleskop, each opened in a new tab then closed with Ctrl+W); port that variant.
  - Web port: `tests/appgrid.spec.ts`, `@mobile` (in the folder drawer on phones). The apps of `docker/app-list.js` (Twake Chat, Twake Drive, Twake Calendar, hosts answered by the spec) in that order, the Drive at `https://<localpart>-drive.workplace.example.test/` (URI template), each opened in a new tab, closed, the grid still listing them; axe. Passes in CI. tmail-flutter web reads its grid from `app_dashboard.json`, not from `.well-known/linagora-ecosystem` (mobile only).
- [x] `APPGRID-02` Inside an iframe of Twake Workplace (`WORKPLACE_EMBEDDING`), the top bar has neither the logotype nor the app grid, and a gear opens the account menu (Twake Calendar's `EmbeddingContext`). — web app only
  - Spec: `tests/appgrid.spec.ts`; the container is `/e2e/workplace.html` of the stack, on `localhost` (another origin than the app on `127.0.0.1`). Passes in CI.

## DRIVE — Twake Drive picker (4)

`tests/drive.spec.ts`, against the fake Drive of the stack (`docker/drive-picker.html`, the
`/e2e/drive/` locations of `docker/nginx/default.conf`: token exchange, intent, a picker
speaking the cozy-interapp protocol, a file to download). The picker trades the ID token of
the session: the specs need the app in OIDC mode, `E2E_OIDC=1
E2E_APP_ENV=docker/app-env-oidc.js ./scripts/start.sh`, and skip otherwise (CI runs them only
when the workflow is started with `oidc`). They sign in as Dex's static alice.

- [ ] `DRIVE-01` "Attach from Drive" opens the picker in a dialog named "Twake Drive" (full screen on phones; axe; both actions sent, no `displayCloseButton`); "Add as link" closes it and inserts a Drive card (`a.tmail-file-link-card`) at the caret, the focus back in the message. — web app only (tmail-flutter `workplace/`)
- [ ] `DRIVE-02` "Add as attachment" downloads the file and attaches it (`report.txt`, uploaded). — web app only
- [ ] `DRIVE-03` The close button of the picker (in its header, as Drive's) closes it, the message unchanged; with the keyboard, Shift+Tab out of the picker then Escape closes it, the focus back on the button. — web app only
- [ ] `DRIVE-04` The picker fills a centred dialog, 900 × 800 by default, at the size it asks for (`resize`), always within the screen (full screen on phones); one close button (the picker's once it is ready), the dialog's when the picker asks for it (`showCross` / `hideCross`), the focus back on the button. — web app only

## AI — AI assistant of the composer (2)

tmail-backend advertises no assistant (`com:linagora:params:jmap:aibot`) on the memory image nor
on the Twake Workplace of the devbox: `tests/scribe.spec.ts` adds it to the JMAP session with
`page.route` and answers its endpoint itself (doubles: no text leaves the machine).

- [ ] `AI-01` With the capability, the assistant of the composer translates what the user wrote ("French"): the request carries tmail-flutter's prompt and the text, the answer shows in a dialog (axe) and "Insert" puts it in the message. — web app only (tmail-flutter `scribe/`)
- [ ] `AI-02` Without the capability, the composer has no assistant. — web app only

## MISC — Misc (1)

- [ ] `MISC-01` Opening Settings from the user avatar, clicking "Sign out" and confirming "Yes, log out" lands on the Twake welcome screen. — `misc/log_out_test.dart` · tags: `ios (default)`

## A11Y — Accessibility (RGAA 4.1, no Patrol counterpart)

Every spec of a screen also runs axe on it (`expectNoA11yViolations(page)`, `support/a11y.ts`:
WCAG 2.0 / 2.1, A and AA); the violations of twake-mui itself are reported as annotations,
listed in `docs/twake-mui-gaps.md`.

- [ ] `A11Y-01` Without a mouse: log in, open the Sent folder then the Inbox from the tree, reach the list with Tab, move to the second email with the arrow keys and open it with Enter (the focus lands on its subject), go back with the back button (Shift+Tab, Enter): the focus returns to the row of that email. — no Patrol test
  - Spec: `tests/a11y.spec.ts`. Passes in CI. On phones and tablets (Playwright projects `mobile`
    and `tablet`) the tree is in a drawer: the menu button opens it with the focus inside, choosing
    a folder closes it and gives the focus back to the button.

## KBD — Keyboard shortcuts (no Patrol counterpart)

Single-key shortcuts of the web app (`c`, `/`, `j`, `k`, `e`, `#`, `s`, `u`, `z`, `?`), ignored in
text fields, dialogs and menus, and with Ctrl, Alt or Meta; they can be turned off (WCAG 2.1.4).

- [x] `KBD-01` In the list, `j` / `k` move the focus to the next / previous row; `e` archives the
  focused email (toast "Moved to Archive", the focus moves to the next row, the email is in Archive
  on the server) and `z` undoes it (back in the Inbox); in the open email, `s` stars it and `u`
  marks it unread and goes back to the list. — no Patrol test
  - Spec: `tests/shortcuts.spec.ts`. Passes in CI.
- [x] `KBD-02` `?` opens the list of the shortcuts (a named dialog, axe), whose switch turns them
  off: after a reload, `e` and `?` do nothing. — no Patrol test
  - Spec: `tests/shortcuts.spec.ts`. Passes in CI.
- [x] `KBD-03` On the open email, `r` replies, `Shift+R` replies to all and `f` forwards, as in
  tmail-flutter; the menu of a row (right click) replies too, and so do the buttons under a message of
  a conversation. — `thread_detail/.../key_shortcut_extension.dart` (no Patrol test)
- [x] `KBD-04` `R` with Caps Lock (no Shift) replies, not to all; replying again to the same email
  brings back the reply open, the focus in it; a key typed while the composer opens (`e`) does not
  reach the shortcuts of the email behind it. — no Patrol test
- [x] `KBD-05` `?` lists, besides the single keys, the keys of a message being written (Ctrl+Enter
  sends, Ctrl+K inserts a link, Escape minimizes…), in a table named by its heading (axe). — no
  Patrol test
- [x] `KBD-06` `/` moves the focus into the search, unfolding it first on phones, where Escape
  folds it back and gives the focus to the search button. — no Patrol test (issue #45)
  - Spec: `tests/shortcuts.spec.ts`, on `chromium`, `mobile` and `tablet` (`@mobile`).

## RESP — Phones and tablets (no Patrol counterpart)

The Playwright projects `mobile` (390 × 844, touch) and `tablet` (820 × 1180, touch) replay
`LOGIN-01`, `MBX-05`, `EML-01`, `A11Y-01` and the `RESP` specs (`grep` of `playwright.config.ts`);
the page objects open the folder drawer when the screen has one. Breakpoints: tmail-flutter's,
600, 900 and 1200 px (`common/src/ds/useScreenSize`).

- [ ] `RESP-01` At 320 px and at 640 px wide (a desktop browser zoomed to 400 % and 200 %), the
  login form, the list, the open drawer and an email with a long subject and long addresses show
  without horizontal scrolling of the page nor of its main content (RGAA 10.11); axe on the list
  and the email. — `chromium` project only
  - Spec: `tests/responsive.spec.ts`.
- [ ] `RESP-02` On phones and tablets, the folder drawer opened by the menu button is a named modal
  dialog holding the focus (Tab stays inside), passes axe, closes with Escape or its close button
  and gives the focus back to the menu button.
  - Spec: `tests/responsive.spec.ts`.
- [ ] `RESP-03` On a phone, the search button unfolds the search over the top bar with the focus in
  the field; Escape folds it back and focuses the button again.
  - Spec: `tests/responsive.spec.ts`.
- [ ] `RESP-04` At 1024 px (large tablet), the list stays beside the open email, its row marked
  `aria-current`; the back button closes the email, shows "No email selected" and gives the focus
  back to the row. — `chromium` project only
  - Spec: `tests/responsive.spec.ts`.
- [ ] `RESP-05` A phone held sideways (844 × 390): the email opens over the list, reads, and goes
  back, without horizontal scrolling. — `chromium` project only
  - Spec: `tests/responsive.spec.ts`.
- [ ] `LST-01` A list row with a label stays on one line (about 52 px) on a desktop, the chip before
  the subject. — `chromium` project only
  - Spec: `tests/list-rows.spec.ts`.
- [ ] `LST-02` The actions of a row replace its date on hover and on keyboard focus. — `chromium`
  project only
  - Spec: `tests/list-rows.spec.ts`.
- [ ] `RESP-06` On a 1440 x 789 desktop, the top bar is 50 px high and full width above the
  sidebar, the search is in the page under it (820 px at most) with the settings button at the far
  end of its row, and the list toolbar sits under the search; axe. — `chromium` project only
  - Spec: `tests/responsive.spec.ts`.
- [x] `LAYOUT-01` The document never scrolls (`scrollHeight <= clientHeight`) on the mailbox, the
  reading view and the settings, on a desktop and a tablet, standalone and framed as in Twake
  Workplace. — `chromium` project only
  - Spec: `tests/page-scroll.spec.ts`.
- [x] `THR-18` Opening a long conversation from the list with a view transition shows its target from the first frame of the conversation, nothing scrolls under the transition, and it ends on the final scroll position; `THR-19` the same from a search result. — web app (issue #108)
  - Spec: `tests/thread-scroll.spec.ts`, on `chromium`, `mobile` and `tablet`.
- [x] `TMB-01` The team mailbox says its address beside its name, and lists its folders as tmail-flutter: INBOX, Drafts, Outbox, Sent, Trash, Templates. — web app only, no Patrol test
  - Spec: `tests/team-mailboxes.spec.ts`.
- [x] `TMB-02` Deleting an email of a team mailbox moves it to the Trash of the team mailbox, with neither Archive nor Spam in its menu. — web app only, no Patrol test
  - Spec: `tests/team-mailboxes.spec.ts`.
- [x] `TMB-03` Deleting a team email found by a search moves it to the Trash of its team mailbox, with neither Archive nor Spam. — web app only, no Patrol test
  - Spec: `tests/team-mailboxes.spec.ts`.
- [x] `TMB-04` The default search leaves out the Trash of a team mailbox. — web app only, no Patrol test
  - Spec: `tests/team-mailboxes.spec.ts`.
- [x] `TMB-05` The banner of the Trash of a team mailbox empties it, with its subfolders, after a confirmation naming the Trash. — web app only, no Patrol test
  - Spec: `tests/team-mailboxes.spec.ts`.
- [x] `TMB-06` A message sent with the identity of a team mailbox keeps its copy in the Sent of the team mailbox, not in the one of the user. — web app only, no Patrol test
  - Spec: `tests/team-mailboxes.spec.ts`.
- [x] `TMB-07` A draft written with the identity of a team mailbox is saved in the Drafts of the team mailbox. — web app only, no Patrol test
  - Spec: `tests/team-mailboxes.spec.ts`; the manager and the rights come from `Mailbox/set` `sharedWith`.
- [x] `TMB-08` A member who may only read a team folder is offered no action that deletes, moves, reads or stars its emails, nor "New subfolder" or "Mark as read" on the folder. — web app only, no Patrol test
  - Spec: `tests/team-mailboxes.spec.ts`.
- [x] `TMB-09` The move picker lists a folder emails cannot be added to (`mayAddItems`) as unavailable. — web app only, no Patrol test
  - Spec: `tests/team-mailboxes.spec.ts`.
- [x] `MBX-31` A subfolder found by the folder search shows its path under its name, a team mailbox its address, whatever the case or the accents; no match says "No folder matches your search". axe on the results. — web app only, no Patrol test
  - Spec: `tests/folder-search.spec.ts`.
- [x] `MBX-32` A hidden folder is found by the folder search, marked hidden; with the keyboard (ArrowDown, Shift+F10) "Show folder" shows it again; Escape folds the search only (also in the drawer) and focuses the magnifier. axe. — web app only, no Patrol test
  - Spec: `tests/folder-search.spec.ts`.
- [x] `MBX-33` The folder search links to Settings > Folder visibility. — web app only, no Patrol test
  - Spec: `tests/folder-search.spec.ts`.
- [ ] `FBAR-01` The inbox toolbar offers refresh, "Select all messages of this page" and the three
  filters (menu); selecting all turns it into the selection bar; axe. — also on phones and tablets
  - Spec: `tests/folder-toolbar.spec.ts`.
- [ ] `FBAR-02` A filter narrows the folder in place (same URL), one at a time, with a toast; picking
  it again or the clear button restores the list. — also on phones and tablets
  - Spec: `tests/folder-toolbar.spec.ts`.
- [ ] `FBAR-03` In a filtered folder, an email leaving it (moved to the Trash) leaves the list and a
  new matching email joins it by push.
  - Spec: `tests/folder-toolbar.spec.ts`.
- [ ] `FBAR-04` The Trash has its empty banner and the filter (and the recovery button when the
  server keeps deleted messages); an empty Spam has neither "select all" nor the filter. Axe.
  - Spec: `tests/folder-toolbar.spec.ts`.
- [ ] `FBAR-05` Starred has no "starred" filter, a label view has the three, search results have
  their own filters bar and no list filter. Axe.
  - Spec: `tests/folder-toolbar.spec.ts`.

## Composer design (batch composer)

Web app only, no Patrol test: the composer follows the Figma "Composer" frames.

- [x] `CMP-61` With several identities, the To line has a "From" text button that opens the From line (the identity picker); it goes away once open. — web app only (tmail-flutter `prefix_from_recipient_from_button`). Axe.
  - Spec: `tests/composer.spec.ts`.
- [x] `CMP-62` Cc and Bcc open as 37 px lines of the same width as To; their close button hides them, emptied, and gives the focus back to To. — web app only (tmail-flutter `deleteEmailAddressType`). Axe.
  - Spec: `tests/composer.spec.ts`.
- [x] `CMP-63` The formatting toolbar is under the text; the footer button shows or hides it (`aria-pressed`), and the footer link button opens the link dialog. — web app only. Axe.
  - Spec: `tests/composer.spec.ts`.
- [x] `THR-20` Opening a conversation from the list with a view transition never animates towards a skeleton (the email and its conversation are loaded before the navigation, the transition is skipped when they take longer than 500 ms), the pane the transition snapshots does not move while the target is scrolled to (it would slide over the search row and the top bar), and the transition ends on the final scroll position; standalone and embedded, 1440, 1280 and 1000 px wide, with and without server latency. — web app (issue #120)
  - Spec: `tests/open-glitch.spec.ts`, on `chromium`.
- [x] `SET-10` Error reporting is configured (`SENTRY_*` of the app environment, an ingest host answered by the spec) but nothing is sent before the user opts in: an uncaught error and a `console.error` go nowhere. Turning "Send error reports" on in Settings → Preferences stores `sentry.user-opt-in` in the account and the next errors are posted to the ingest host, without a reload; what is posted holds the release, the environment and a 16 hex digits user id, and no address, name, password, `Bearer`/`Basic` value, subject, sender nor preview, and no session, replay or transaction envelope; turning it off stops the reports at once, and on again restarts them. Axe. — web app only (tmail-flutter `sentry.user-opt-in`)
  - Spec: `tests/error-reporting.spec.ts`.
- [x] `SET-11` The choice belongs to the account: it is on again at the next sign-in and reports resume; signing out stops the reports; another account in the same browser is off. — web app only
  - Spec: `tests/error-reporting.spec.ts`.
- [x] `SET-12` With `userOptInByDefault` in the `sentry` section of the ecosystem, a user who never chose is opted in (the switch is on and errors are posted), and can opt out. — web app only (tmail-flutter `userOptInByDefault`)
  - Spec: `tests/error-reporting.spec.ts`.
- [x] `SET-13` An aborted request and a failed network request, logged with `console.error`, are not reported, while a real bug right after is. — web app only (tmail-flutter ADR 0076)
  - Spec: `tests/error-reporting.spec.ts`.
- [x] `SET-14` Unread emails in Spam show "N message(s) in spam" above the lists of the other folders (a live region, never in Spam itself); "Dismiss" hides it for 24 hours (kept in the browser) and marks Spam as read, "View" opens Spam and hides it too; turning "Enable spam report" off in Settings → Preferences removes it for good. — web app only, no Patrol test (tmail-flutter's `SpamReportController`, `GetSpamMailboxCachedInteractor`)
  - Spec: `tests/preferences.spec.ts`.

## AI-ACTION — Action required and AI preferences (4)

`tests/ai-action-required.spec.ts` and `tests/scribe.spec.ts` add the `aibot` capability to the JMAP
session with `page.route`; the setting `ai.label-categorization.enabled` is stored by the real server.

- [x] `AI-03` With the AI capability, "Enable label categorisation" in Preferences adds the "Action required" folder right after Starred; it lists the unread emails with `needs-action`, tagged "Action required"; the tag of the opened email has a × taking the keyword off; switching the preference off removes the folder. — web app only (tmail-flutter `HandleAiNeedsActionExtension`)
- [x] `AI-04` Without the AI capability, even with the setting on and the keyword set: no folder (`/action-required` goes back to the inbox), no tag, no AI option in Preferences. — web app only
- [x] `AI-05` Selecting text in the composer shows an assistant button under it; the menu works on the selection; the answer is copied ("Result copied to clipboard"). — web app only (tmail-flutter `AiSelectionOverlay`, copy of the suggestion)
- [x] `AI-06` The "AI Scribe" preference (kept in this browser) hides the assistant of the composer. — web app only

## List toolbar and rows (batch P4)

Web app only, no Patrol test: the list follows the Figma "Email message list" and
finishes issue #112.

- [x] `FBAR-06` In a filtered folder, an email that stops matching the filter (marked as read under "Unread") leaves the list at once, as tmail-flutter's client-side `filterEmail`. — web app (issue #112)
  - Spec: `tests/folder-toolbar.spec.ts`.
- [x] `TBAR-01` With the messages vault, the personal Trash has a button recovering deleted messages, which opens the recovery dialog. The session is rewritten at the network level (`page.route`), the e2e stack being unable to guarantee the capability. Axe. — web app (issue #112)
  - Spec: `tests/toolbar-capabilities.spec.ts`.
- [x] `TBAR-02` Without the vault, the Trash has no recovery button. — web app (issue #112)
  - Spec: `tests/toolbar-capabilities.spec.ts`.
- [x] `TBAR-03` A support address makes the help button of the top bar open a message to it. — web app (issue #112)
  - Spec: `tests/toolbar-capabilities.spec.ts`.
- [x] `TBAR-04` A support web page makes the help button a link to it, in a new tab. Axe. — web app (issue #112)
  - Spec: `tests/toolbar-capabilities.spec.ts`.
- [x] `TBAR-05` Without a support contact there is no help button. — web app (issue #112)
  - Spec: `tests/toolbar-capabilities.spec.ts`.
- [x] `LST-03` The reply button of a row opens the composer on a reply to it ("Re: subject"). — `chromium`
  - Spec: `tests/list-rows.spec.ts`.
- [x] `LST-04` The hover actions open the email in a tab of its own, and open the folder picker to move it. — `chromium`
  - Spec: `tests/list-rows.spec.ts`.
- [x] `LST-05` Measures of the design: 32 px icon buttons, 16 px between toolbar controls, rows about 44 px. — `chromium`
  - Spec: `tests/list-rows.spec.ts`.


## ATT — Attachment cards and preview (batch P2)

- [x] `ATT-03` An email with four attachments shows "4 Attachments" and three cards with a "+1 more" tile; the card of an image opens it in a full-screen dialog named after the file (an `<img>`, axe), Escape closes it and gives the focus back to the card; a text file is shown as text (markup escaped) and downloaded from the viewer bar; "+N more" lists the others. — tmail-flutter `AttachmentItemWidget`, `previewImageFile`, `previewPlainTextFile` (no Patrol test)
  - Spec: `tests/attachments.spec.ts`.
- [x] `ATT-04` A hostile HTML attachment (script, handler, remote image, iframe, meta refresh, `javascript:` link) is previewed through the sanitizer, the CSP and the sandboxed frame of the email body: no dialog, no request outside the app, nothing of it left in the document (axe). — tmail-flutter `HtmlAttachmentPreviewer` (no Patrol test) · `@mobile`
  - Spec: `tests/attachments.spec.ts`.
- [x] `ATT-05` A hostile SVG attachment (script, handler, remote image), whatever type the sender gives it, is shown by an `<img>`: no frame, object nor embed, no dialog, no request outside the app. — web app only
  - Spec: `tests/attachments.spec.ts`.
- [x] `ATT-06` A PDF with a JavaScript open action and a link annotation is drawn page by page on canvases (pdf.js, worker served by the app under its CSP): no dialog, no request outside the app (axe). — tmail-flutter `PDFViewer` (no Patrol test)
  - Spec: `tests/attachments.spec.ts`.
- [x] `ATT-07` A .eml attachment is parsed by the server and shown as an email (subject, From/To, sanitized body in the sandboxed frame): no dialog, no request outside the app (axe). — tmail-flutter `EmailPreviewerController` (opens a window there, a dialog here; no Patrol test)
  - Spec: `tests/attachments.spec.ts`.

- [x] `ATT-08` A PDF with embedded fonts (printed by the browser, TrueType subsets) is drawn on its canvas with the glyphs as paths (`disableFontFace`), without any `eval` nor `Function` call (spied from `addInitScript`) and without any request outside the app; the worker `.mjs` is served as `text/javascript` with the CSP (no `worker-src`, no `unsafe-eval`) and `nosniff`. — web app only
  - Spec: `tests/attachments.spec.ts`.
- [x] `ATT-09` A PDF whose part is declared larger than 30 MB is not fetched nor drawn: the dialog says to download it, the viewer bar downloads it (axe). — web app only
  - Spec: `tests/attachments.spec.ts`.
- [x] `ATT-10` A 400-page PDF has one canvas per page but draws only the pages in view (fewer than 10 drawn at once); scrolled to the end, the last page is drawn and the first is released. — web app only
  - Spec: `tests/attachments.spec.ts`.

## CMP — Drafts, local first (#134)

Web app only, no Patrol test: the policy is in `docs/composer-drafts.md`.

- [x] `CMP-64` Typing for two minutes in a composer (a pause every ten seconds) writes nothing on the server: no `Email/set`, the composer is kept in the browser meanwhile (before: 12 creations and 11 destructions).
  - Spec: `tests/composer-drafts.spec.ts`, fake clock.
- [x] `CMP-65` A composer comes back after a reload with its recipients, subject and body, and in a new tab once the first is closed.
  - Spec: `tests/composer-drafts.spec.ts`.
- [x] `CMP-66` The draft is written once after five minutes without a change (one creation, no destruction), not again while unchanged; a real change writes one more version and destroys the previous one.
  - Spec: `tests/composer-drafts.spec.ts`, fake clock.
- [x] `CMP-67` Sending a message forgets the composer kept in the browser.
  - Spec: `tests/composer-drafts.spec.ts`.
- [x] `CMP-68` Signing out forgets the composers kept in the browser, none comes back at the next sign in.
  - Spec: `tests/composer-drafts.spec.ts`.
- [x] `CMP-69` A composer shown by a tab is not reopened by a second tab of the browser.
  - Spec: `tests/composer-drafts.spec.ts`.
- [x] `CMP-70` Signing out saves, once, the draft of a composer that has changes the server does not have, then forgets the composers kept in the browser.
  - Spec: `tests/composer-drafts.spec.ts`.
- [x] `SET-10` Unread emails in Spam show "N message(s) in spam" above the lists of the other folders (a live region, never in Spam itself); "Dismiss" hides it for 24 hours (kept in the browser), "View" opens Spam and hides it too; turning "Enable spam report" off in Settings → Preferences removes it for good. — web app only, no Patrol test (tmail-flutter's `SpamReportController`, `GetSpamMailboxCachedInteractor`)
  - Spec: `tests/preferences.spec.ts`.
## Email actions (batch P1)

Web app only: tmail-flutter web renders to a canvas, so Patrol never covered these actions on the web.
Spec: `tests/email-actions.spec.ts`. The reading view is the single email one (`emailsOneByOne`).

- [x] `EACT-01` "Print all" (toolbar button) prints the email through an invisible frame: title `Twake Mail - <subject>`, the address of the user, the Cc line, the body with its quoted history unfolded and the list of attachments. The toast says "Printing in progress". — tmail-flutter `printAll` (`PrintUtils.printEmail`). Axe.
- [x] `EACT-02` "Download message as EML" saves the JMAP blob of the email as `<subject>.eml`, characters a file name cannot hold replaced.  — tmail-flutter `downloadMessageAsEML`.
- [x] `EACT-03` "Edit as new email" opens a composer with the recipients, subject, body and attachments of the email; sending it creates another email, without `In-Reply-To` nor `References`. — tmail-flutter `editAsNewEmail`.
- [x] `EACT-04` "Unsubscribe" after the sender asks first (axe on the dialog); declining fetches and sets nothing; confirming with the keyboard opens the web link of `List-Unsubscribe` in a new tab (a GET, only after the confirmation), sets `$unsubscribe`, toasts, shows the "You unsubscribe from" note and drops the link. — tmail-flutter `unsubscribe`, `MailUnsubscribedBanner`. Axe.
- [x] `EACT-05` "Unsubscribe" with a `mailto:` link only opens the composer on its address and subject; `$unsubscribe` is set once the message is sent, not before. — tmail-flutter `composeFromUnsubscribeMailtoLink`.
- [x] `EACT-06` A `List-Unsubscribe` header holding no `http(s):` nor `mailto:` link (`javascript:`) offers no Unsubscribe, link or menu item.
- [x] `EACT-07` On a phone the Unsubscribe link is not shown beside the sender; the More menu has Unsubscribe, Print all, Download message as EML and Edit as new email. Axe. `@mobile`.
- [x] `STORAGE-01` Inside Twake Workplace (iframe, `WORKPLACE_EMBEDDING`), with the SaaS capability `com:linagora:params:saas` (`canUpgrade`, answered in the session by the spec) and a full storage, a link to the paywall (`https://<workplace>/settings/premium`) is in the quota banner ("Manage my storage"), the sidebar footer ("Increase your space", under the cloud, the 3 px gauge, "X available" and the version) and Settings > Storage ("Upgrade storage"); each opens in a new tab with `noopener noreferrer`, the opened page has no `opener`. Axe. — web app only (tmail-flutter `premiumCtaProvider`)
  - Spec: `tests/storage-upgrade.spec.ts`.
- [x] `STORAGE-02` A message the full storage refuses shows "over quota" in the composer with the link to the paywall. Axe. — web app only
  - Spec: `tests/storage-upgrade.spec.ts`.
- [x] `STORAGE-03` Outside Twake Workplace, without the SaaS capability, with `canUpgrade` false, or on the highest subscription (`isPaying` and not `canUpgrade`), the banner only advises to clean up and no link to a paywall is shown anywhere. Axe. — web app only
  - Spec: `tests/storage-upgrade.spec.ts`.
- [x] `MBX-50` "Move folder content" on a folder with three emails asks for a destination, moves them all (toast "Moved to Bulk target") and Undo puts exactly those back. axe on the picker. — web app only, no Patrol test (tmail-flutter: `moveFolderContent`)
  - Spec: `tests/folder-menu.spec.ts`, `@mobile`.
- [x] `MBX-51` A folder with 55 emails (more than one batch of 50) is moved whole; moving to Spam marks them read. — web app only
  - Spec: `tests/folder-menu.spec.ts`.
- [x] `MBX-52` An empty folder does not offer "Move folder content". — web app only
  - Spec: `tests/folder-menu.spec.ts`.
- [x] `MBX-53` "Create filter" on a folder opens the rule creator with "Move to <folder>" chosen; saving creates the rule (toast, `Filter/get`). axe on the dialog. — web app only (tmail-flutter: `createFilter`)
  - Spec: `tests/folder-menu.spec.ts`, `@mobile`.
- [x] `MBX-54` "Open in new tab" is a link (`target="_blank"`) to `/mailbox/<id>` and opens a tab. — web app only (tmail-flutter: `openInNewTab`)
  - Spec: `tests/folder-menu.spec.ts`.
- [x] `MBX-55` The unread count is hidden on the Trash and Drafts, shown on a folder with unread emails; Drafts shows the number of emails it holds. — web app only (tmail-flutter: `allowedToDisplayCountOfUnreadEmails`)
  - Spec: `tests/folder-menu.spec.ts`, `@mobile`.
- [x] `MBX-56` The title of the "Folders" section is a button (`aria-expanded`) that collapses and expands the tree, its actions stay; the choice survives closing and opening the folder drawer. axe. — web app only (tmail-flutter: `MailboxCategoriesExpandMode`, kept for the session only)
  - Spec: `tests/folder-menu.spec.ts`, `@mobile`.
- [x] `CMP-80` The formatting toolbar menus (text style, size, font, alignment, lists) and the colour popovers work with the keyboard: Alt+F10, Enter opens, arrows choose, Escape closes, `aria-expanded` follows; axe clean. — web app only, no Patrol test (tmail-flutter's `RichTextWebController`)
  - Spec: `tests/composer-format.spec.ts`.
- [x] `CMP-81` Each control of the toolbar (text style, size, font, colour, highlight, B/I/U/S, alignment, indentation) formats the text, the buttons say the current value, and the recipient receives the inline styles. — web app only, no Patrol test
  - Spec: `tests/composer-format.spec.ts`.
- [x] `CMP-82` The emoji picker (footer button, categories, search, recent) inserts the emoji at the caret, closes with Escape or a click outside, and gives the focus back to the text. — web app only: tmail-flutter has no emoji picker
  - Spec: `tests/composer-format.spec.ts`.
- [x] `CMP-83` On a phone the footer of the composer stays on one line (Send is an icon, no emoji button) and the formatting toolbar is one line that scrolls sideways, its last button reachable (#55). — web app only, no Patrol test
  - Spec: `tests/composer-format.spec.ts`.
- [x] `TWP-01` An email with an `X-TWP-Message` header shows a banner between its header and its body, with the localized text of a known code (`suspicious-sender`), its level said in words (axe; also on `mobile`); `TWP-02` several headers stack in order and an error replaces the sender avatar by a badge; `TWP-03` an unknown code shows the text of the server as plain text (no HTML, no link); `TWP-04` a dismissed warning stays dismissed after a reload with the keyword `twp-warning-dismissed-<index>`, the others stay; `TWP-05` an error in Spam offers "Not spam", which moves the email to the Inbox; `TWP-06` an error in the Inbox does not; `TWP-07` in a conversation the banners and the badge show in the expanded message that has them. — web app (issue #142)
  - Spec: `tests/twp-warnings.spec.ts`; fixtures `fixtures/eml/twp_warnings/`.
- [x] `CMP-71` The attached files are chips (type icon or thumbnail, name cut in the middle, size, a check once uploaded, a progress bar, a remove button); once all are uploaded and there are more than two, "Show less" folds the list to two and "Show more (+N)" shows the rest again (tmail-flutter's mobile composer threshold). — web app only, no Patrol test (Figma "Attachment", `AttachmentItemComposerWidget`)
  - Spec: `tests/composer-attachments-ui.spec.ts`, axe on both states.
- [x] `CMP-72` On a desktop, more than nine files uploading at once are listed in a labelled "Uploading N files" popup (a progress bar each) instead of chips, until they all end. — web app only, no Patrol test (Figma note "if there are more than 9 files upload in a time…")
  - Spec: `tests/composer-attachments-ui.spec.ts`, uploads held by a route.
- [x] `CMP-73` A failed upload says "Upload failed" (icon and words) and its Retry button sends the same file again. — web app only, no Patrol test
  - Spec: `tests/composer-attachments-ui.spec.ts`.
- [x] `CMP-74` The signature is a card under a "Signature" pill (`aria-expanded`) that folds it in the view only: the message still carries it. — web app only, no Patrol test (Figma "Signature")
  - Spec: `tests/composer-attachments-ui.spec.ts`.
- [x] `CMP-75` The recipients folded (focus on the subject or the body) show their chips with a "+N" counter for those that do not fit, in one button named after every recipient; a click unfolds them and focuses To, whose chips stay out of the tab order (ArrowLeft reaches them). — web app only, no Patrol test (`RecipientsCollapsedComposerWidget`)
  - Spec: `tests/composer-attachments-ui.spec.ts`.
- [x] `CMP-76` On a phone, more than nine uploads at once stay chips in the list, no popup. — web app only, no Patrol test
  - Spec: `tests/composer-attachments-ui.spec.ts`.
- [x] `CMP-77` Files dragged over the composer show the "Drop file here to attach them" panel (dashed light blue, Figma "Attachment - drag & drop"); dropping them attaches them and hides it. — web app only, no Patrol test
  - Spec: `tests/composer-attachments-ui.spec.ts`.
- [x] `CMP-78` At 360, 390 and 820 px every optional line of the composer opens, by touch and keyboard, with its button inside the window: on a phone one chevron "More recipient fields" shows From, Cc, Bcc and Reply to together (tmail-flutter's mobile expand button) and puts the focus in Cc; a tablet and a desktop keep the text buttons. — web app only, no Patrol test
  - Spec: `tests/composer-attachments-ui.spec.ts`.
- [x] `CMP-64` the expanded composer sits under the top bar, inset from the screen edges with the page showing around it (not dimmed, as in the design), and goes back to the dock. — web app (editor E3)
  - Spec: `tests/composer.spec.ts`.
- [x] `EML-38` The reading view of the new design (single email): the toolbar says "‹ Inbox" (named "Back to Inbox") and its previous / next buttons open the neighbours of the folder; the header has five icon buttons (reply, move, star, delete, "More") and a chevron after "Cc" showing the addresses; Reply all / Reply / Forward are in a bar at the bottom. axe. — web app, batch D1 (Figma "Teammail 1.1")
  - Spec: `tests/reading-view.spec.ts`.
- [x] `THR-21` A conversation has its answers in a bar at the bottom (Reply and Forward go to the latest message), the actions of every message (reply, archive, star, delete, "More") in its row, and the actions on all of its messages in the "More" menu of its toolbar. axe. — web app, batch D1
  - Spec: `tests/reading-view.spec.ts`.
- [x] `SBR-04` The system folders (Inbox to Archive) come first in the sidebar, in their own tree named "Mailboxes"; the "Folders" title comes after them, then the folders of the user, then "Labels". — web app (sidebar D4; tmail-flutter's `exchange` and `personalFolders` categories)
  - Spec: `tests/sidebar.spec.ts`.
- [x] `SBR-05` A hidden folder listed on demand keeps its whole name: the icon of hidden folders replaces its folder icon and the word "hidden" is said by the link (visually hidden), not shown as a badge. — web app (tmail-flutter `icHideFolder`)
  - Spec: `tests/sidebar.spec.ts`.
- [x] `SBR-06` The Spam row, with emails, has a "Clean" text button (described by "Delete all spam emails") that empties it after the confirmation; no other row has it. — web app (Figma sidebar, tmail-flutter `clean`)
  - Spec: `tests/sidebar.spec.ts`.
- [x] `SBR-07` The folder search field is the flat 40 px pill of the design system (no shadow). — web app (Figma)
  - Spec: `tests/sidebar.spec.ts`.
- [x] `SBR-08` With many folders and labels, at 1440x789 and 1280x650, the scrolling part of the sidebar ends above the footer (no overlap) and the footer stays inside the sidebar. — web app (sidebar D4)
  - Spec: `tests/sidebar.spec.ts`.
- [x] `SRCH-16` Given an invitation ("event" keyword) and a plain email matching "report", the "Don't include events" chip above the results leaves the invitation out (`aria-pressed`), and the "From" chip adds a sender nobody has: the chip "From: nobody@x.org" shows, the empty view follows, and removing it brings the email back. axe on the results. — web app (search design D2)
  - Spec: `tests/search.spec.ts`.
- [x] `SRCH-17` At 1440 px every chip of the filters above the results, "Clear filter" included, shares one line (nothing wraps, nothing scrolls), and the order of the results is a "Relevance" button of the list toolbar (`aria-haspopup="menu"`, menu of orders) rather than a chip: picking "Oldest" shows it on the button. axe on the results. — web app (search design D2)
  - Spec: `tests/search.spec.ts`.
- [x] `CMP-84` The composer has the measures of the design on a desktop: 790 x 634 window with an 8 px radius, 44 px title bar with three 40 px buttons 4 px apart, 37 px fields, a toolbar 40 px high under a 1 px rule with 32 px boxes 8 px apart and a 114 px wide B I U S group, a footer with 16 px padding, 40 px icon buttons 8 px apart and a 128 x 40 Send pill with a 100 px radius. — web app (Figma, editor E4)
  - Spec: `tests/composer-geometry.spec.ts`.
- [x] `CMP-85` At every width the close, formatting, attach, image and More buttons of the composer are 40 px round buttons, the toolbar boxes are 32 px high and the toolbar 41 px with its rule (touch screens enlarge the targets to 44 px). — web app (Figma, editor E4)
  - Spec: `tests/composer-geometry.spec.ts`.
- [x] `CMP-86` On a phone the composer has no title bar nor footer: a 56 px bar holds the close button, then Aa (the formatting toolbar is hidden until it is pressed), attach, image, a round Send (a disc in a 44 px target) and "More", every target at least 44 px, in that order. — web app (Figma phone composer, tmail-flutter `MobileResponsiveAppBarComposerWidget`, editor E5)
  - Spec: `tests/composer-mobile.spec.ts`.
- [x] `CMP-87` At 390 and 360 px "Aa" shows the formatting toolbar at the bottom of the window, nothing overflows the screen horizontally, the toolbar scrolls sideways, its last button is whole at the end and a swipe stops on the start of a group. — web app (editor E5)
  - Spec: `tests/composer-mobile.spec.ts`.
- [x] `CMP-88` The More menu of a phone holds Insert link, Save as draft, Save as template, Request read receipt, Mark as important and Delete draft; a tablet's holds the four of tmail-flutter's desktop menu (no link, no delete: they are in the footer). — web app (tmail-flutter mobile app bar, editor E5)
  - Spec: `tests/composer-mobile.spec.ts`.
- [x] `CMP-89` On a tablet (820 px) the composer is a 772 x 710 window with 24 px around it, its title centred and minimize, expand and close at the end (44 px), no horizontal overflow; it minimizes into the dock. — web app (Figma tablet composer, tmail-flutter `TabletResponsiveContainerView`, editor E5)
  - Spec: `tests/composer-mobile.spec.ts`.
- [x] `CMP-90` Several long addresses in "To": the label keeps the first chip company, and the input stays on the row of the last chip while 56 px are left, else takes the row under the chips with nothing empty after it (every width). — web app (editor E5)
  - Spec: `tests/composer-mobile.spec.ts`.
- [x] `CMP-49` / `CMP-83` (updated, editor E5) — the composer fills the screen on a phone only (a tablet shows it as a window in the dock), so CMP-49 checks the "+N messages" menu in the top bar of a 390 px phone and then the 1700 px desktop, and CMP-83 checks the one line top bar of a phone (no footer) before the toolbar it shows on "Aa". — web app (editor E5)
  - Spec: `tests/composer.spec.ts`, `tests/composer-format.spec.ts`.

- [x] `CMP-91` Two tabs saving their first template at the same time make a single Templates folder (Web Lock, then the folders are read again before creating one), holding both templates. — web app only, no Patrol test (issue #54)
  - Spec: `tests/composer-templates.spec.ts`.
- [x] `CMP-92` A draft reopened from Drafts and saved as a template leaves no draft behind, with no question asked (the draft is the user's own). — web app only, no Patrol test (issue #54)
  - Spec: `tests/composer-templates.spec.ts`.
- [x] `CMP-93` A message written as a team mailbox and saved as a template goes to the Templates of that team mailbox (none is made for the user), and the template opened from there keeps the identity of the team mailbox. — web app only, no Patrol test (issue #54)
  - Spec: `tests/composer-templates.spec.ts`.
- [x] `CMP-94` A draft of a team mailbox reopened and saved as a template asks "Delete the shared draft?" first: Cancel saves nothing, "Save and delete the draft" files the template and destroys the draft. — web app only, no Patrol test (issue #54)
  - Spec: `tests/composer-templates.spec.ts`.
- [x] `CMP-95` "Insert template" in the More menu opens a named dialog with the focus in its filter field, listing the templates of the user and of the team mailboxes; typing filters them and announces "N templates found" in a live region; Enter inserts the subject and the body of the active one into an empty message and puts the focus in the body. No axe violation. — web app only, no Patrol test (tmail-flutter has no picker, issue #54)
  - Spec: `tests/composer-templates.spec.ts`.
- [x] `CMP-96` Inserting a template into a message that has text asks to insert it at the cursor (the subject and the text stay) or to replace the message; Escape closes the picker and gives the focus back to "More". — web app only, no Patrol test (issue #54)
  - Spec: `tests/composer-templates.spec.ts`.
- [x] `CMP-97` The picker is a sheet from the bottom edge, as wide as the screen, on a phone, and a centred dialog on a tablet and a desktop; it filters and inserts by touch. — web app only, no Patrol test (issue #54, `@mobile`)
  - Spec: `tests/composer-templates.spec.ts`.
- [x] `CMP-98` A template found by a search opens in the composer (a new message linked to the template), not in the reading view; the search stays behind. — web app only, no Patrol test (issue #54)
  - Spec: `tests/composer-templates.spec.ts`.
- [x] `CMP-88` (updated, issue #54) — the More menu holds "Insert template" between "Save as draft" and "Save as template", on a phone and on a tablet. — web app (issue #54)
  - Spec: `tests/composer-mobile.spec.ts`.
- [x] `LST-06` A row with three labels shows the first one then a "+2" chip; the list of labels of the row names the hidden ones ("2 more labels: Personal, Urgent"); on a desktop the row is as high as a row without labels with the chip before the subject, on a phone and a tablet the chips end the preview line, inside the row; axe. — web app (Figma list rows, tmail-flutter `LabelTagListWidget`) (issue #110)
- [x] `LST-06` A row with three labels shows the first one then a "+2" chip; the list of labels of the row names the hidden ones ("2 more labels: Personal, Urgent"); on a desktop the row is as high as a row without labels with the chip before the subject, on a phone and a tablet the chips end the preview line, inside the row; axe. — web app (Figma list rows, tmail-flutter `LabelTagListWidget`) (issue #110)
  - Spec: `tests/list-rows.spec.ts`.
- [x] `LST-07` The row of a conversation shows the labels of the email that stands for it (the last one), not those of the older emails: a label on the first email only is not on the row. — tmail-flutter `thread_view.dart` (`presentationEmail.getLabelList`) (issue #110)
  - Spec: `tests/list-rows.spec.ts`.
- [x] `LST-08` In a label view, a row labelled with a long name has the height of the same row in the Inbox, and the chip is cut with an ellipsis, its title holding the whole name. — web app (Figma list rows) (issue #110)
  - Spec: `tests/list-rows.spec.ts`.
- [x] `CRD-01` The sender of an opened email is a button (`aria-haspopup="dialog"`) opening its contact card, a named dialog (the name) with the avatar, the address and a "Copy the email address" button (the address lands in the clipboard, a toast confirms); 383 px wide on a desktop and a tablet, a bottom sheet resting on the bottom edge on a phone; axe; Escape closes it and the focus goes back to the sender. — tmail-flutter `EmailAddressDialogBuilder` / `EmailAddressBottomSheetBuilder` (issue #132)
  - Spec: `tests/contact-card.spec.ts`.
- [x] `CRD-02` A recipient of To and of Cc opens its card; "Compose email" closes it and opens a message to that address. — tmail-flutter `openEmailAddressDialog` (issue #132)
  - Spec: `tests/contact-card.spec.ts`.
- [x] `CRD-03` With `CALENDAR_SPA_URL` and `CHAT_SPA_URL` set, the card has "Invite to an event" (a link to `<CALENDAR_SPA_URL>/newEvent?attendee=<address>`) and "Chat" (a link to `CHAT_SPA_URL` with `{target}` the local part), both opening a new tab with `noopener`. — Twake Calendar `AttendeeActions` (no such action in tmail-flutter) (issue #132)
  - Spec: `tests/contact-card.spec.ts`.
- [x] `CRD-04` The focus stays inside the card while tabbing; its close button closes it and gives the focus back to the address. — web app (RGAA 7.1, 12.8) (issue #132)
  - Spec: `tests/contact-card.spec.ts`.
- [x] `CRD-05` Without `CALENDAR_SPA_URL` and `CHAT_SPA_URL` the card offers "Compose email" and no link. — web app (issue #132)
  - Spec: `tests/contact-card.spec.ts`.
- [x] `CRD-06` A recipient of an expanded message of a conversation (a `mailto:` link in its "To" line, which wraps with the text) opens its card too; Escape closes it and gives the focus back to the recipient. — web app (issue #132)
  - Spec: `tests/contact-card.spec.ts`.
- [x] `LST-09` At 600, 720, 820, 1024, 1180, 1280 and 1440 px a list row (with a label) has its date clear of its subject and a subject more than 150 px wide: below the desktop size the rows are the two or three line rows of phones, with no permanent hover actions (tmail-flutter: the wide tile is for the web desktop only). — web app (tmail-flutter `thread_view.dart`, `EmailTileBuilder`)
  - Spec: `tests/list-rows.spec.ts`.
- [x] `TRE-01` Each folder tree (the system folders, the folders of the user, a team mailbox) is one tab stop, on the selected folder (else the first), the links and the buttons of the other rows being out of the tab sequence; Down / Up go to the next / previous visible folder (the subfolders of the Inbox, then Starred, then Drafts), Home / End to the first / last, and stop at the ends; the focused row becomes the tab stop; axe. Desktop and folder drawer. — web app, WAI-ARIA APG tree view (issue #102)
  - Spec: `tests/folder-tree-keyboard.spec.ts`.
- [x] `TRE-02` Right expands a collapsed folder (the focus stays on it), then goes to its first child; Left goes from a child to its parent, collapses an expanded folder; Right on a folder without children does nothing; `aria-level`, `aria-posinset`, `aria-setsize` and `aria-expanded` follow; Enter opens the folder and the drawer closes. — web app, WAI-ARIA APG tree view (issue #102)
  - Spec: `tests/folder-tree-keyboard.spec.ts`.
- [x] `TRE-03` The actions of the focused folder stay reachable: Tab goes to its expand arrow then its menu button (Shift+Tab back to the row), Shift+F10 and the menu key open its menu with the focus in it, Escape gives the focus back to the row, the arrows work again. — web app (issue #102)
  - Spec: `tests/folder-tree-keyboard.spec.ts`.
- [x] `TRE-04` The folders of the user and the team mailboxes are trees of their own (one tab stop each, arrows stopping at their ends); Right and Left work in a team mailbox; from the field of the folder search, Down goes to the first result, a row of a tree. — web app (issue #102)
  - Spec: `tests/folder-tree-keyboard.spec.ts`.
- [x] `TRE-05` Deleting the folder that holds the focus, from its menu with the keyboard, leaves the focus on a folder of the tree (not on the page), which is the only tab stop, and the arrows still work. — web app (issue #102)
  - Spec: `tests/folder-tree-keyboard.spec.ts`.
- [x] `TRE-06` A folder destroyed from another client while it holds the focus (push) hands the focus to a neighbour. — web app (issue #102)
  - Spec: `tests/folder-tree-keyboard.spec.ts`.
- [x] `TRE-07` Typeahead: a letter goes to the next folder starting with it, the same letter again to the one after; the focused row has a visible outline; Escape is left alone. — web app, WAI-ARIA APG tree view (issue #102)
  - Spec: `tests/folder-tree-keyboard.spec.ts`.
- [x] `MBX-06b` (updated, issue #102) — the order Inbox, its subfolder, Starred, Drafts is walked with the arrow keys from the Inbox, no longer with Tab.
  - Spec: `tests/folders.spec.ts`.
