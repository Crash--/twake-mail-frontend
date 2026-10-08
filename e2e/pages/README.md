# Page objects and the `data-testid` contract

The specs never hold a selector: they call the page objects of this folder, and the page
objects locate elements by `data-testid` (kebab-case, Twake convention) or, when it is
unambiguous, by accessible role and name. This file is the contract between the suite and
the app: **the app must expose these ids**. Add the id to the component when you build it,
add it here when a page object starts using it.

| Page object | Patrol robots it replaces |
|---|---|
| `LoginPage` | `login_robot.dart`, `web/web_login_robot.dart` |
| `MailboxPage` | `mailbox_folder_robot.dart`, `mailbox_menu_robot.dart`, `mailbox_navigation_robot.dart`, `mailbox_assertion_robot.dart`, `mailbox_empty_trash_robot.dart`, `thread_robot.dart`, `thread_assertion_robot.dart`, `thread_empty_trash_robot.dart` |
| `EmailPage` | `email_robot.dart`, `email_address_dialog_robot.dart` |
| `ComposerPage` | `composer_robot.dart`, `web/web_composer_robot.dart`, `identities_list_menu_robot.dart` |
| `SearchPage` | `search_robot.dart`, `search_*_robot.dart`, `web/web_search_*_robot.dart` |
| (to write) `SettingsPage` | `setting_robot.dart`, `preferences_robot.dart`, `profiles_robot.dart`, `language_robot.dart`, `identity_creator_robot.dart`, `web/web_email_rules_setting_robot.dart`, `web/web_rules_filter_creator_robot.dart` |
| (to write) `LabelModals` | `labels/*_robot.dart` |

Conventions:

- One id per *kind* of element, not per instance: rows share `mailbox-item` / `email-list-item`
  and carry what identifies them as `data-*` attributes (`data-mailbox-id`,
  `data-mailbox-role`, `data-email-id`) or as their text. No `mailbox-item-${id}`.
- State is exposed the accessible way first (`aria-current="page"` on the selected folder,
  `aria-expanded`, `aria-pressed` / `aria-checked`, `disabled`), then as `data-*` when no ARIA
  attribute fits (`data-unread="true"`). Never through a CSS class.
- Ids are derived from the Flutter keys (`lib/features/base/model/ui_keys.dart`, `Key('…')`
  used by the robots) when one exists, so that porting a scenario is a mechanical translation.
  The Flutter key is in the last column.

## Phase 0 — login, folder tree, email list, reading

### Login (basic auth)

| `data-testid` | Element | Flutter key |
|---|---|---|
| `login-username-input` | username / email input | `login_username_input` |
| `login-password-input` | password input | `login_password_input` |
| `login-submit-button` | submit button | `loginSubmitForm` |
| `login-error` | error message (bad credentials, server unreachable) | — |
| `login-sso-button` | "Sign in with SSO" (OIDC, phase 1) | — |

### Application shell

| `data-testid` | Element | Flutter key |
|---|---|---|
| `twake-bar` | the platform bar of Twake Workplace (`@linagora/twake-bar`, `data-status` `public` / `waiting` / `ready`), absent inside an iframe of the Workplace; its own ids: `twake-bar-home`, `twake-bar-apps-button`, `twake-bar-user-button`, `twake-bar-logout` | `UiKeys.userAvatar`, `UiKeys.toggleAppGridButton` |
| `logout-button` | Sign out button of the platform bar while it has no account menu (no Workplace, or the Workplace refused the token) | — |
| `mobile-mailbox-menu-button` | top bar button opening the folder drawer, below 1200 px | `UiKeys.mobileMailboxMenuButton` |
| `mailbox-drawer` | the folder drawer (`role="dialog"` named "Navigation"), holding `mailbox-tree` | — |
| `mailbox-drawer-close-button` | its close button | — |
| `top-bar-folder-name` | name of the current folder in the top bar, on phones | — |
| `twake-feedback-button` | the draggable "Send feedback" button of `@linagora/twake-feedback`, only with `SENTRY_FEEDBACK_ENABLED` and the opt-in to error reporting; its menu (`twake-feedback-menu`, Shift+F10) moves it to a side | — |
| `compose-email-button` | "New message": in the sidebar on a desktop, a floating button below 1200 px | `UiKeys.composeEmailButton` |

### Folder tree (sidebar)

| `data-testid` | Element | Flutter key |
|---|---|---|
| `mailbox-tree` | the sidebar folder tree (`role="tree"`, named by `mailbox-tree-title`) | — |
| `mailbox-tree-title` | the "Folders" heading above the tree | — |
| `mailbox-item` | one folder row (`role="treeitem"`), with `data-mailbox-id`, `data-mailbox-role` (JMAP role, absent for personal folders), `aria-current="page"` when selected, `aria-expanded` when it has children | — (found by name in Patrol) |
| `mailbox-item-name` | the folder name inside the row | — |
| `mailbox-unread-count` | unread badge inside the row (absent when 0) | — |
| `mailbox-expand-button` | expand / collapse arrow | — |
| `mailbox-more-button` | ⋮ button shown on hover or focus (always on touch screens), named "Actions on <folder>" | `UiKeys.mailboxMoreActionButton` |
| `mailbox-context-menu` | folder actions menu (⋮, right click, menu key or Shift+F10); items `mailbox-action-<action>`: `new-subfolder`, `mark-as-read`, `empty-trash`, `empty-spam`, `move`, `rename`, `hide`, `show`, `delete` | — |
| `add-new-folder-button` | "+" new folder in the "Folders" header | `UiKeys.addNewFolderButton` |
| `show-hidden-folders-button` | toggle listing the hidden folders (`aria-pressed`), shown when some are hidden | — (Settings > Folder visibility in tmail-flutter) |
| `mailbox-item-hidden` | "hidden" beside a hidden folder listed on demand (the row has `data-hidden="true"`) | — |
| `mailbox-name-dialog` / `mailbox-name-input` / `mailbox-name-location-button` / `mailbox-name-submit-button` / `mailbox-name-cancel-button` | the dialog naming a folder to create or rename it, and where it goes | `create_new_mailbox_*` |
| `mailbox-search-button` | magnifier in the "Folders" header | `UiKeys.mailboxSearchButton` |
| `team-mailboxes-section` | "Team-mailboxes" category of the Folders section and its tree, after the folders of the user; its roots have no icon and their address on a second line | — |
| `team-mailbox-unavailable` / `team-mailbox-session-expired` | the facade of a team mailbox (`/embed/team-mailboxes/<id of its root>`, TwakeSpace, no sidebar: `compose-email-button` floats at every size): the screen of a mailbox the user is not a member of, the screen of a silent login refused by the SSO (`-action` retries) | — |
| `mailbox-item` with `data-mailbox-role="favorite"` | the Starred virtual folder (`/starred`), after the Inbox | `favorite` folder |
| `quota-indicator` (`data-used`) + `quota-refresh-button`, `quota-text` / `quota-banner` / `storage-settings` | the storage used at the bottom of the sidebar, the banner past the warning limit, Settings > Storage | `MailboxSidebarFooter`, `QuotasBannerWidget` |
| `mailbox-action-recover-deleted-messages` / `recovery-dialog` + `recovery-deletion-select`, `recovery-reception-select`, `recovery-subject-input`, `recovery-recipients-input`, `recovery-sender-input`, `recovery-cancel-button`, `recovery-restore-button`, `recovery-error` / `recovery-banner` / `recovery-open-button` | "Recover deleted messages" of the Trash menu, its progress banner and the "Open" of its toast | `recoverDeletedMessages` |

### Email list (thread view)

| `data-testid` | Element | Flutter key |
|---|---|---|
| `email-list` | the list: a `table` named "Messages", column headers for screen readers only; each row holds one link (`[data-row-focus]`) that opens the email, the arrow keys move between rows | — |
| `email-list-item` | one row, with `data-email-id`, `data-thread-id`, `data-unread="true"` when unread, `aria-selected` when selected | `EmailTileBuilder` |
| `email-list-item-subject` | subject inside the row | — |
| `email-list-item-sender` | sender inside the row; the participants of a conversation ("Alice, Bob, Me") | — |
| `email-list-item-preview` | preview text inside the row | — |
| `email-list-item-date` | date inside the row | — |
| `unread-status-icon` | unread marker of the row | `UiKeys.unreadStatusIcon` |
| `email-list-item-star` | star toggle (`aria-pressed`) | — |
| `email-list-item-toggle-seen` | "Mark as read" / "Mark as unread", shown on row hover or focus | — |
| `email-list-item-remove` | "Move to trash" / "Delete permanently" (Trash, Spam, Drafts), shown on row hover or focus | `move_to_trash` hover action |
| `email-list-item-more` | ⋮ opening the actions menu of the row (wide list) | `more` hover action |
| `email-context-menu` | the actions menu of a row: ⋮, right click, menu key or Shift+F10; items `email-action-<action>` | — |
| `email-list-item-checkbox` | selection checkbox (Shift+click selects a range) | `UiKeys.tabletEmailSelectionAvatar` |
| `important-flag-icon` | "important" marker | `important_flag_icon` |
| `empty-thread-view` | empty folder view | `UiKeys.emptyThreadView` |
| `quick-filter-attachments` / `quick-filter-unread` / `quick-filter-starred` | items of the "Filter" menu of the list toolbar (filter the folder in place) | `attachments_filter`, `unread_filter`, `starred_filter` |
| `scroll-to-top-button` | floating "back to top" button | `ScrollToTopButtonWidget` |
| `selection-toolbar` | toolbar shown when emails are selected (a `section` named "Selection actions") | — |
| `selection-toolbar-count` / `selection-toolbar-select-all` / `selection-toolbar-select-folder` / `selection-toolbar-clear` | "N selected" (`role="status"`), the select all button (`aria-pressed`, tmail-flutter's ticked box, phones and tablets, where the toolbar takes the place of the bar of the mail; none on desktops, as tmail-flutter: "Select all messages of this page" of the list toolbar), "Select all N messages in this folder", clear | — |
| `selected-email-action-<action>` | its buttons, by `EmailActionId`: `not-spam`, `move-to-trash`, `delete-permanently`, `archive`, `mark-as-read`, `mark-as-unread`, `star`, `unstar`, `move`, `mark-as-spam`; `more` on phones and tablets (menu `selection-toolbar-menu`, a sheet from the bottom edge with all the actions, as tmail-flutter) | `<action>_selected_email_button` |
| `empty-trash-banner` / `empty-trash-banner-button` | "Empty trash now" / "Delete all spam emails now" banner and its button | `empty_trash_banner`, `UiKeys.cleanMessageBannerNotVisible` |
| `mailbox-picker` / `mailbox-picker-search-input` / `mailbox-picker-list` / `mailbox-picker-item` / `mailbox-picker-close-button` | the folder picker ("Move To"): a filter field (`role="combobox"`) driving a list box of folders | `destination_picker` |
| `new-emails-status` | live region announcing the emails pushed into the list | — |

### Reading an email

| `data-testid` | Element | Flutter key |
|---|---|---|
| `email-view` | the opened email (reading pane or full screen) | — |
| `email-view-subject` | subject | `EmailSubjectWidget` |
| `email-view-from` / `email-view-to` / `email-view-cc` / `email-view-bcc` | address lines; each address is an `email-address` button | `InformationSenderAndReceiverBuilder` |
| `email-view-date` | received date | — |
| `email-view-body` | the body, **a sandboxed iframe** (the page object enters it with `contentFrame()`) | — |
| `remote-content-banner` | "Remote images hidden", above the body when the email has remote images, backgrounds or fonts | — (web app only) |
| `twp-warnings` + `twp-warning-<index>`, `twp-warning-dismiss-<index>`, `twp-warning-not-spam-<index>`, `email-view-danger-badge` / `conversation-message-danger-badge` | The banners of the `X-TWP-Message` warnings of an email (position of the header), their dismiss and "Not spam" buttons, the red badge replacing the sender avatar | — (`TwpWarningBanner`, `UiKeys.twpWarningBannerPrefix`) |
| `remote-content-show-button` / `remote-content-always-show-button` | show them for this email / always for this sender | — |
| `email-view-back-button` | back to the list | `EmailViewBackButton` |
| `email-view-empty` | "No email selected", beside the list from 900 to 1199 px | `EmailViewEmptyWidget` |
| `attachment-item` | one attachment chip (name as text) | `AttachmentItemWidget` |
| `download-all-attachments-button` | "Download all" | `UiKeys.downloadAllAttachmentsButton` |
| `reply-email-button` / `reply-all-emails-button` / `reply-to-list-email-button` / `forward-email-button` | reply actions, under the email and under each expanded message of a conversation (group `email-reply-actions`); "Reply all" when the email reaches more than one other address, "Reply to list" with a `List-Post` | same keys, kebab-cased |
| `email-view-actions` | the actions beside the back button; also in each expanded message of a conversation (a `group` named "Actions on the message from <sender>, <date>"), with the ids below | — |
| `email-view-star-button` | star toggle (`aria-pressed`) | — |
| `email-view-action-<action>` | the main actions as buttons, not on phones: `archive`, `move-to-trash` / `delete-permanently`, `mark-as-unread`, `move`, `mark-as-spam` / `not-spam`; in a message of a conversation `mark-as-unread`, `move-to-trash` / `delete-permanently` only | — |
| `email-view-more-button` / `email-view-menu` | "more" button and its menu, holding every action | `email_detailed_more_button` |
| `email-action-<action>` | the items of every email actions menu: `reply`, `reply-all`, `reply-to-list`, `forward` (one email, not in Drafts), `not-spam`, `move-to-trash`, `delete-permanently`, `archive`, `mark-as-read`, `mark-as-unread`, `star`, `unstar`, `move`, `mark-as-spam` (`label-as` later) | `markAsStarred_action`, `moveToSpam_action`, `labelAs_action`… |
| `delete-thread-button` | delete the whole thread | `delete_thread_button` |
| `email-address` / `email-address-menu` + `email-address-copy-item`, `email-address-compose-item`, `email-address-create-rule-item` | the sender of an email (reading view of one email, each expanded message of a conversation) and its menu: copy, "Compose email", "Create a rule with this email" | `copy_email_address`, `compose_email`, `quickCreatingRule` |
| `calendar-event-card` | iMIP invitation card ("Orange Bar"), a `region` named "Event: <title>", above the body (`CalendarEventCard` page object) | `CalendarEventCardWidget` |
| `calendar-event-banner` | the state badge, who did what ("… has invited you to a meeting", "… has proposed changes to the event") | — |
| `calendar-event-when` (+ `calendar-event-recurrence`) / `calendar-event-where` / `calendar-event-video` (+ `calendar-event-video-link`, `calendar-event-copy-link`) / `calendar-event-who` | the details rows | — |
| `calendar-event-description` | the description of the event, as text, after the card | `CalendarEventDetailWidget` |
| `calendar-event-people` + `calendar-event-person` / `calendar-event-see-all-attendees` | organizer and attendees, each with its answer; past six people "See all attendees (n)" / "Hide" (`aria-expanded`) | `seeAllAttendees` |
| `calendar-event-replies` + `calendar-event-reply-yes` / `-maybe` / `-no` | "Attending?" group, each answer `aria-pressed`; only "Yes" on a counter proposal | `yesEventAction`, `maybeEventAction`, `noEventAction` |
| `calendar-event-mail-to-attendees` / `calendar-event-open-in-calendar` | "Mail to attendees"; "See in your Calendar" (with `CALENDAR_SPA_URL`) | `mailToAttendees` |
| `calendar-event-not-invited` / `calendar-event-busy` | "You are not invited…", "You have another event at that same time" | — |

## Phase 2 — search (`SearchPage`)

| `data-testid` | Element | Flutter key |
|---|---|---|
| `search-bar` | the search field of the top bar and its suggestions | `SearchInputFormWidget` |
| `search-input` | the field (`role="combobox"`, `aria-expanded`, `aria-activedescendant`) | `search_email_text_field` |
| `search-clear-button` | clears the field | — |
| `search-suggestions` | the suggestions (`role="listbox"`, groups "Recent", "Contacts", "Messages") | — |
| `search-suggestion-show-all` | "Search for "…"": every result; "Search with these filters" when the field is empty and filters are picked | `showingResultsFor` row |
| `search-suggestion-recent` / `search-suggestion-contact` / `search-suggestion-item` | a recent search, a contact, an email | `RecentSearchItemTileWidget`, `ContactQuickSearchItem`, `EmailQuickSearchItemTileWidget` |
| `quick-search-filters` + `quick-search-filter-<filter>` (`has-attachment`, `last-7-days`, `from-me`, `starred`) | quick filters above the suggestions (`aria-pressed`) | `quick_search_filter_button_<filter>` |
| `advanced-search-button` | opens the advanced search | `UiKeys.openAdvancedSearchButton` |
| `advanced-search-dialog` | the advanced search (`role="dialog"`); fields `advanced-search-{from,to,subject,text,not-words}-input`, `advanced-search-{folder,date,sort}-select`, checkboxes by label | `advanced_search_view` |
| `advanced-search-submit-button` / `advanced-search-clear-button` | Search / Clear filter | `UiKeys.advancedSearchSearchButton`, `clear_filter_button` |
| `advanced-search-cancel-button` | Cancel: closes the advanced search without searching (the only way out of the full screen dialog on a phone) | — |
| `search-page` / `search-results` | the results screen (`/search?…`) and its list pane | — |
| `search-results-title` / `search-results-back-button` | its heading (focused when it opens) and back to the mailboxes | `search_email_back_button` |
| `search-filters-bar` | the filters above the results (`role="toolbar"`) | — |
| `search-filter-<filter>` (`folder`, `date-time`, `has-attachment`, `starred`, `unread`; `sort-by` is the order button at the end of the list toolbar, not in the row) | a filter (`aria-pressed`, or `aria-haspopup="menu"` for folder, date and order) | `<filter>_search_filter_button`, `sortBy_search_filter_button` |
| `search-filter-menu` | the menu of a filter (`menuitemradio` items) | — |
| `search-filter-removable` | a sender, recipient, subject or excluded words filter, removed on click | — |
| `search-clear-filter-button` | "Clear filter" | `clear_filter_button` |
| `email-list-item-mailbox` | the folders of a result, in its row | `mailboxContain` |
| `empty-search-view` | no result | `UiKeys.emptySearchEmailView` |

## Phase 2 — conversations (`ConversationPage`)

| `data-testid` | Element | Flutter key |
|---|---|---|
| `thread-setting-toggle` / `read-receipts-setting-toggle` / `sender-priority-setting-toggle` | switches of Settings > Preferences (each holds the `switch` input) | `ValueKey(AppLocalizations().thread)`, `setting_option_switch_on` |
| `language-select` | Settings > Language | `language_drop_down_button` |
| `vacation-form` + `vacation-enable-toggle`, `vacation-start-date-input`, `vacation-start-time-input`, `vacation-end-toggle`, `vacation-end-date-input`, `vacation-end-time-input`, `vacation-subject-input`, `vacation-message-editor`, `vacation-error`, `vacation-cancel-button`, `vacation-save-button` | Settings > Vacation | `VacationView` |
| `vacation-banner` + `vacation-end-now-button`, `vacation-settings-button` | the banner of an active vacation response, over every screen | `VacationNotificationMessageWidget` |
| `folder-visibility-personal` / `folder-visibility-team` / `folder-visibility-item` (`data-mailbox-name`, `data-hidden`) + `folder-visibility-toggle` | Settings > Folder visibility | `MailboxVisibilityView` |
| `email-list-item-thread-count` | number of messages of a conversation row, "(3)" (absent for one email) | — |
| `conversation-view` | an email shown with its conversation | `ThreadDetailView` |
| `conversation-header` | its subject, labels (`label-chip`, × takes one off every email of the conversation) and count | — |
| `conversation-subject` / `conversation-count` | its subject (`h1`) and "N messages" | — |
| `conversation-toolbar` | the actions of the conversation (back, read, star, archive…), sticky at the top of the scrolling area | — |
| `conversation` | the messages (`ol` named "Messages of the conversation") | — |
| `conversation-message` | a message (`data-expanded`) | `ThreadDetailCollapsedEmail`, `EmailView` |
| `conversation-message-toggle` | its header, a button (`aria-expanded`); ArrowUp / ArrowDown / Home / End move between them | — |
| `conversation-message-from` / `conversation-message-preview` / `conversation-message-unread` | in the header: sender name, preview (collapsed), unread marker | — |
| `conversation-message-sender` / `conversation-message-to` / `conversation-message-cc` / `conversation-message-bcc` | in an expanded message: "From:" with the address menu (`email-address`), recipients; then its actions (`email-view-actions`), its labels (`label-chip`, × takes one off this message) | `EmailView` of the thread detail |
| `conversation-toggle-seen` / `conversation-toggle-star` | mark the conversation read or unread, star or unstar it (`aria-pressed`) | `thread_detail_app_bar` buttons |
| `email-view-back-button` / `email-view-body` | back to the list, the body of an expanded message | same ids as the reading view |
| `conversation-message-draft` | the "Draft" marker of a draft of the conversation | — |
| `conversation-draft-actions`, `conversation-draft-edit-button` / `conversation-draft-delete-button` | under an expanded draft, instead of the answers: edit it in the composer, delete it | — (tmail-flutter opens drafts in the composer) |

## Later phases (planned, used by `ComposerPage` already)

| `data-testid` | Element | Flutter key |
|---|---|---|
| `composer` | a composer window (`role="dialog"` named by its subject; `data-mode`: `normal`, `minimized`, `fullscreen`), the newest first; `composer-dock` holds them | — |
| `composer-minimize-button` / `composer-fullscreen-button` | minimize (then "Show"), full screen (then "Exit fullscreen"), desktop only | `minimize`, `fullscreen` buttons of `desktop_app_bar_composer_widget` |
| `composer-overflow-button` / `composer-overflow-menu` / `composer-overflow-item` | "+N messages", the composers left out for lack of room (at the start of the dock, or in the title bar of the composer filling the screen), its menu and its items | — (web app only) |
| `composer-recipients-summary` | the recipient fields folded into one line (focus on the subject or the body), unfolds them | `RecipientsCollapsedComposerWidget` |
| `composer-to-suggestions` (… `-cc-`, `-bcc-`, `-reply-to-`) | the contact suggestions of a field (`role="listbox"`) | — |
| `composer-to-input` / `composer-cc-input` / `composer-bcc-input` / `composer-reply-to-input` | recipient inputs | `prefix_to_recipient_composer_widget`… |
| `composer-to-field` (… `-cc-`, `-bcc-`, `-reply-to-`) + `recipient-chip` | recipient chips of a field | — |
| `composer-show-cc-button` / `composer-show-bcc-button` / `composer-show-reply-to-button` | reveal hidden fields | `prefix_cc_recipient_expand_button`… |
| `composer-subject-input` | subject | — |
| `composer-editor` | rich text editor (contenteditable) | `mobile_editor` |
| `rich-text-<item>-button` (`undo`, `redo`, `bold`, `italic`, `underline`, `strike`, `color`, `size`, `align`, `bullet-list`, `ordered-list`, `blockquote`, `link`, `image`, `clear-formatting`) | buttons of the formatting toolbar (Alt+F10) | — |
| `link-dialog-text-input` / `link-dialog-url-input` / `link-dialog-apply-button` | the insert link dialog (Ctrl+K) | — |
| `rich-text-image-toolbar` + `rich-text-image-<item>-button` (`small`, `medium`, `large`, `original`, `smaller`, `larger`, `remove`) | toolbar of the selected image (arrows select it, Enter opens it) | — |
| `html-block-edit-<kind>` | "Edit the quoted message" (`kind` = `quote`) | — |
| `composer-send-button` | send | `UiKeys.sendEmailButton` |
| `composer-close-button` | close (saves a draft when dirty) | `UiKeys.closeComposerButton` |
| `composer-more-button` + `composer-save-draft-item` (phones only), `composer-save-template-item`, `composer-read-receipt-item`, `composer-mark-important-item` | more menu, after the link in the bottom bar as tmail-flutter (`…`) | `UiKeys.composerMoreButton`, `save_as_draft_popup_item`, `saveAsTemplatePopupItem`, `read_receipt_popup_item`, `mark_as_important_popup_item` |
| `composer-attach-file-button` / `composer-file-input` | "Attach file" and its hidden file input | `attach_file` |
| `composer-drive-button` | "Attach from Drive" (`TDRIVE_ENABLED`, OIDC) | `attachFromDrive` |
| `composer-scribe-button` + `composer-scribe-menu` (`composer-scribe-actions`: `ai-scribe-category` with `data-category`, its `ai-scribe-submenu` of `ai-scribe-action` with `data-action`; `composer-scribe-task` the "Help me write" prompt, `composer-scribe-task-send`) | the AI assistant (with `com:linagora:params:jmap:aibot`) and what it opens above its button, as tmail-flutter: the menu of categories (alone "Help me write" when nothing is written) | `AiAssistantButton`, `AiScribeContextMenu`, `AIScribeBar` |
| `composer-scribe-dialog` + `ai-scribe-suggestion-loading`, `-result`, `-error`, `-copy`, `-retry`, `-improve` (with `composer-scribe-improve-menu`), `-replace`, `-insert`, `-close` | the answer of the assistant, a card above its button | `AiScribeSuggestionWidget` |
| `drive-picker-dialog` + `drive-picker-frame`, `drive-picker-retry-button` | the Twake Drive picker: dialog "Twake Drive", its iframe, "Retry" after a failure | `DriveIntentWebViewModal` |
| `composer-attachments` + `composer-attachment-item` (`data-status`: `uploading`, `done`, `failed`) + `composer-attachment-remove-button` | the attached files (a list named "Attachments (n)"), each removed (or its upload cancelled) by its button | `AttachmentItemComposerWidget` |
| `composer-drop-zone` | the composer, where dropped files are attached | `dropFileHereToAttachThem` |
| `composer-save-status` | what the autosave did ("Saving…", "Draft saved", "Draft not saved"), a `status` | — |
| `composer-send-error` | why the server refused the message (`role="alert"`) | — |
| `composer-delete-draft-button` / `composer-discard-draft-button` | delete the draft and close; "Discard" of the "Draft saved" toast after a close | `discard` |
| `composer-identity-select` | From identity picker, shown with more than one identity | `identities_list_menu_robot` |
| `confirm-dialog-alternative-button` | the third button of a choice (`useChoose`), e.g. "Discard changes" when closing a modified message | — |
| `settings-menu-<section>` (`profiles`, `preferences`, `keyboard-shortcuts`, later `email-rules`, `language-region`…) | settings navigation: the sidebar on a desktop, the list of sections below | `setting_preferences`, `setting_profiles`, `setting_email_rules`, `setting_language_region` |
| `settings-sidebar` / `settings-nav` / `settings-section-list` | the settings column (desktop), its navigation, the list of the sections (phones and tablets) | `setting_menu` |
| `settings-back-button` / `settings-section-back-button` | back to the mail; back from a section to the list (below the desktop size) | `back_to_dashboard_button` |
| `settings-section-<section>` | the section opened (its heading is the `h1` of the page) | — |
| `create-new-identity-button` / `identity-list` / `identity-item` (`data-identity-name`, `data-default`) + `identity-item-name`, `identity-default-badge`, `identity-default-radio`, `identity-edit-button`, `identity-delete-button` | Settings > Profiles | `create_new_identity_button`, `IdentityListTileBuilder` |
| `identity-form-dialog` + `identity-name-input`, `identity-email-select`, `identity-reply-to-input`, `identity-bcc-input`, `identity-signature-editor`, `identity-default-checkbox`, `identity-cancel-button`, `save-identity-button`, `identity-form-error` | the identity creator | `IdentityCreatorView`, `save_identity_button` |
| `add-rule-button` / `email-rule-list` / `email-rule-item` (`data-rule-name`) + `email-rule-name`, `email-rule-edit-button`, `email-rule-delete-button` / `email-rules-empty` | Settings > Email rules | `addARule`, `editEmailRuleButton_<name>` |
| `rule-form-dialog` + `rule-name-input`, `rule-combiner-select`, `rule-condition` (group "Condition N": `rule-condition-field-select`, `rule-condition-comparator-select`, `rule-condition-value-input`, `rule-condition-remove-button`), `rule-add-condition-button`, `rule-action` (group "Action N": `rule-action-select`, `rule-action-folder-button`, `rule-action-remove-button`), `rule-add-action-button`, `rule-form-error`, `rule-cancel-button`, `create-rule-button` | the rule creator | `RuleFilterCreatorView`, `UiKeys.createRuleButton`, `UiKeys.addActionButton` |
| `forward-input` / `forward-add-button` / `forward-list` / `forward-item` (`data-email`) + `forward-remove-button` / `forward-local-copy-toggle` / `forward-warning-banner` | Settings > Forwarding | `forward_*` |
| `labels-section` / `label-item` (`data-label-name`) + `label-item-menu-button`, `label-item-menu` (`label-edit-item`, `label-delete-item`) / `add-new-label-button` | the labels of the sidebar | `UiKeys.addNewLabelButton`, `label_action_type_context_menu` |
| `label-modal` + `label-name-input`, `label-description-input`, `label-color-picker`, `label-cancel-button`, `label-save-button` | create or edit a label | `create_new_label_modal`, `edit_label_modal`, `label_name_input_field`, `save_label_button_action` |
| `choose-label-modal` + `choose-label-list`, `choose-label-item`, `choose-label-empty`, `choose-label-create-button`, `choose-label-apply-button`, `choose-label-cancel-button` | "Label as" (`email-action-label-as` in the email menus) | `add_label_to_email_modal`, `ChooseLabelModal`, `NoLabelYetWidget` |
| `label-page` (`data-label-id`) / `label-chips` + `label-chip`, `label-chip-more` | the emails of a label; the labels of an email (list rows: inline, before the subject; with a × elsewhere) | `LabelWidget` |
| `advanced-search-label-select` | the label of the advanced search | `UiKeys.advancedSearchLabelDropDown` |
| `confirm-dialog` / `confirm-dialog-confirm-button` / `confirm-dialog-cancel-button` | confirmation dialogs (the focus starts on Cancel) | `confirm_dialog_action` |
| `toast` | the toast shown (`data-severity`); its message is announced by live regions always in the page (`role="status"`, `role="alert"` for errors) | — |
| `toast-undo-button` / `toast-retry-button` / `toast-close-button` | its action ("Undo" after an action, "Retry" after a failure) and close | — |
| `shortcuts-dialog` / `shortcuts-enabled-switch` / `shortcuts-dialog-close-button` | keyboard shortcuts list (`?`), the switch turning them off | `keyboardShortcuts` setting |
| `email-list-item-avatar` | the 32 px gradient avatar of the sender, its first letter (decorative, `aria-hidden`), in a list row | — |
| `search-row` / `settings-button` | desktop only: the row at the top of the page holding the search (`search-bar`) and, at its far end, the settings button (below the desktop size the search and `settings-button` are in `top-bar`) | `manage_account` item |
| `list-toolbar` | the toolbar above the list while nothing is selected (a `section` named "List actions"); it becomes `selection-toolbar` once rows are selected | — |
| `mailbox-item-address` / `folder-visibility-address` | the address of a team mailbox, beside the name of its root (sidebar, Settings > Folder visibility) | — |
| `mailbox-search-button` (implemented) | the magnifier toggles the folder search (`aria-expanded`, `aria-controls`); Escape closes it and focuses it again | `UiKeys.mailboxSearchButton` |
| `mailbox-search` / `mailbox-search-input` / `mailbox-search-clear-button` | the folder search panel (`role="search"`), its field (focused on open) and its clear button | `SearchMailboxView` |
| `mailbox-search-status` / `mailbox-search-results` | the count of folders found announced (`role="status"`), or "No folder matches your search"; the results, `mailbox-item` rows with the path under the name (a team root keeps its address beside it), hidden folders included (`data-hidden`) | `MailboxSearchedItemBuilder` |
| `mailbox-search-visibility-link` | link to Settings > Folder visibility, in the search panel | — (Settings menu in tmail-flutter) |
| `list-refresh-button` / `list-refresh-spinner` | refresh (the spinner replaces the button while it runs) | `refresh_all_mailbox_and_email_button` |
| `list-select-all-button` | "Select all messages of this page" (hidden for an empty list; icon alone on phones) | — |
| `list-filter-button` / `list-filter-menu` / `list-filter-clear-button` | the "Filter" dropdown (shows the active filter, hidden in an empty Trash or Spam and in search results, where `search-filters-bar` sits above the list, under the search; on phones an icon in the top bar, `list-filter-slot`), its menu (`menuitemradio`, items `quick-filter-*`: they filter the folder in place) and the button clearing the filter | `FilterMessageButton` |
| `recover-deleted-messages-button` | personal Trash, when the server keeps deleted messages: opens the recovery | `recover_deleted_messages_button` |
| `help-button` | top bar, when the server gives a support contact (`com:linagora:params:jmap:contact:support`): a link, or a message to the support address | `icHelp` button |
| `composer-show-from-button` | "From" on the To line (only with several identities): opens the From line holding `composer-identity-select`; a draft, an answer or a template with an identity of its own opens it already | `prefix_from_recipient_from_button` |
| `composer-hide-cc-button` / `composer-hide-bcc-button` / `composer-hide-reply-to-button` | the close button at the end of the line of an optional field: hides it and empties it, the focus goes back to To | `prefix_*_recipient_delete_button` |
| `composer-formatting-button` | footer, first button: shows or hides the formatting toolbar (`aria-pressed`, shown by default) | — |
| `rich-text-link-button` / `rich-text-image-button` | the link and image buttons moved from the formatting toolbar to the footer of the composer (same ids; the vacation editor keeps them in its toolbar) | `insertLinkButton`, `insertImageButton` |
| `error-reporting-setting-toggle` | switch of Settings > Preferences, "Send error reports", shown when error reporting is configured and the server keeps the setting (holds the `switch` input) | `errorReporting` option (`sentry-reporting`) |
| `action-required-tag` (`action-required-tag-bar` on the opened email) | the "Action required" tag of an email, with a × on the opened one | `ActionRequiredTag`, `EmailActionRequiredTag` |
| `ai-scribe-setting-toggle`, `ai-label-categorization-setting-toggle` | the AI options of Settings > Preferences | `PreferencesSettings` |
| `composer-scribe-selection-button` | the assistant button under the selected text (a white disc, a blue sparkle) | `InlineAiAssistButton` |
| `email-list-item-open-in-new-tab` | hover action opening the email in a tab of its own (not on drafts and templates) | `open in new` hover action |
| `email-list-item-move` | hover action asking for a folder, then moving the email | `move_to_mailbox` hover action |
| `list-filter-slot` | phones: the place of the filter button in the top bar (`list-filter-button` and its menu are rendered there) | `mobile_filter_message_button` |
| `attachment-item` (chip) + `attachment-item-open` / `attachment-item-download` | an attachment chip of tmail-flutter (260 x 36 px), its main button (preview, or download when the type has no preview) and its download button at its end; `attachment-list` holds the header and the chips | `AttachmentItemWidget` |
| `attachment-show-more` / `attachment-show-less` | "Show +N more" after the chips that fit on one row (three on a phone) and "Hide N" once expanded | `showMoreAttachmentButton`, `hideAttachmentButton` |
| `attachment-preview` (+ `-close`, `-download`) | the full-screen dialog previewing an attachment, named after the file; `attachment-preview-image` / `-text` / `-html` / `-eml` / `-error` / `-too-large` its content, `pdf-preview` the PDF canvases | `PDFViewer`, `HtmlAttachmentPreviewer`, `TwakeImagePreviewer` |
| `attachment-preview` (+ `-close`, `-download`) | the full-screen dialog previewing an attachment, named after the file; `attachment-preview-image` / `-text` / `-html` / `-eml` / `-error` its content, `pdf-preview` the PDF canvases | `PDFViewer`, `HtmlAttachmentPreviewer`, `TwakeImagePreviewer` |
| `spam-report-banner` / `spam-report-banner-view` / `spam-report-banner-dismiss` | the unread spam reminder above the lists, its "View" and close buttons | `ReportMessageBanner` |
| `spam-report-setting-toggle` / `drive-attachment-setting-toggle` | Settings → Preferences: spam report, Drive button of the composer | `SpamReportPreferenceOption`, `DriveAttachmentPreferenceOption` |
| `accessibility-setting-toggle` | Settings → Preferences: thick outline on the keyboard focus (not in tmail-flutter) | — |
| `email-view-action-print` | toolbar button "Print all" of an open email (not on phones, not for a message of a conversation) | `icPrinter` button (`printAll`) |
| `email-action-print` / `email-action-download-eml` / `email-action-edit-as-new` / `email-action-unsubscribe` | items of the "More" menu of an open email; `edit-as-new` is also in the menu of a list row (not in Drafts nor Templates) | `printAll_action`, `downloadMessageAsEML_action`, `editAsNewEmail_action`, `unsubscribe_action` |
| `email-unsubscribe-link` | "Unsubscribe" link after the sender of an email (or message of a conversation) with a usable `List-Unsubscribe` link, not yet unsubscribed; not on phones | `unsubscribe` text button |
| `email-unsubscribed-banner` | note "You unsubscribe from <sender>" on an email with the `$unsubscribe` keyword | `MailUnsubscribedBanner` |
| `print-frame` | the invisible `iframe` "Print all" prints through; it goes away once printed | — |
| `quota-banner-upgrade-link` / `quota-upgrade-link` / `storage-upgrade-button` / `composer-upgrade-link` | the link to the paywall (new tab), only on the Twake platform with the SaaS capability: in the quota banner, the sidebar footer, Settings > Storage, the composer send error | `quotaBannerWarningSubtitleWithPremium` link, `LinagoraSidebarUpsellButton`, `UpgradeStorageWidget`, over-quota dialog |
| `sidebar-footer` / `sidebar-version` | the foot of the sidebar (storage + version) and its "version x.y.z" line | `MailboxSidebarFooter`, `ApplicationVersionWidget` |
| `mailbox-action-open-in-new-tab` / `mailbox-action-create-filter` / `mailbox-action-move-content` | items of the folder menu: a link opening the folder in a new tab, the rule creator moving to the folder, the move of every email to another folder (picker `mailbox-picker`, then the toast with Undo) | `MailboxActions.openInNewTab`, `createFilter`, `moveFolderContent` |
| `folders-section-toggle` / `personal-folders-section-toggle` / `team-mailboxes-section-toggle` | the title of a sidebar section (Folders), or of a category in it (Personal folders, Team-mailboxes), a button (`aria-expanded`, `aria-controls`) that collapses it; the Labels do not fold, as in tmail-flutter | `MailboxCategoriesExpandMode` |
| `mailbox-total-count` | the number of emails of the Drafts, in place of the unread count | `allowedToDisplayCountOfTotalEmails` |
| `rich-text-text-style-button` / `rich-text-font-button` / `rich-text-highlight-button` / `rich-text-lists-button` | batch E1: formatting toolbar buttons "Aa" (paragraph, headings, quote, code), font, highlight colour, lists and indentation; menus except the highlight popover | `RichTextStyleType.headerStyle`, `fontName`, `textBackgroundColor`, `orderList` |
| `rich-text-color-menu` / `rich-text-highlight-menu` | the colour popovers (`dialog`, a radio group of swatches, "Reset to default"/"No highlight" button, a free colour input) | `ColorDialogPicker` |
| `rich-text-bullet-list-button` / `rich-text-ordered-list-button` / `rich-text-indent-button` / `rich-text-outdent-button` / `rich-text-blockquote-button` | correction of the earlier rows: they are items of the "Lists and indentation" menu (`rich-text-blockquote-button` an item of the "Text style" menu), no longer toolbar buttons; open the menu first (`ComposerPage.chooseFromMenu`) | `OrderListType`, `ParagraphType.indent`/`outdent`, `HeaderStyleType.blockquote` |
| `composer-emoji-button` / `composer-emoji-picker` (+ `-search`, `-tab-<group>`) | footer emoji button (not on phones) and its popover (`dialog` named "Emoji") | — (tmail-flutter has no emoji picker) |
| `composer-delete-draft-item` | on phones the delete button moves into the "More" menu (`composer-delete-draft-button` stays on tablets and desktops) | `delete_draft_button` |
| `composer-attachments-toggle` | the "Show less" / "Show more (+N)" button folding the attached files (`aria-expanded`) | `showMoreAttachmentButton`, `MobileAttachmentComposerWidget` |
| `composer-attachment-retry-button` | "Retry <file>" of a failed upload | none (new) |
| `composer-upload-popup` (+ `-item`, `-remove-button`, `-retry-button`, `-close-button`) | the "Uploading N files" popup listing the uploads when there are more than nine, on a desktop or tablet | none (Figma) |
| `composer-signature-toggle` | the "Signature" pill folding the signature card in the editor (`aria-expanded`) | none (Figma) |
| `composer-show-more-fields-button` | on a phone, the chevron of the To line showing From, Cc, Bcc and Reply to together | `_buildExpandButton` of `RecipientComposerWidget` |
| `email-view-previous-button` / `email-view-next-button` | batch D1: the email above / below in the folder, in the toolbar of an open email or conversation (disabled when there is none, same moves as `k` / `j`) | — |
| `email-view-back-button` | batch D1: now says the folder ("Inbox", accessible name "Back to Inbox"), "Back" outside a folder | `EmailViewBackButton` |
| `email-view-action-reply` / `email-view-action-move` / `email-view-action-archive` / `email-view-action-move-to-trash` / `email-view-action-delete-permanently` | batch D1, replaces the older row of `email-view-action-<action>`: the five icon buttons of the header of an open email are reply, move, star (`email-view-star-button`), delete and "More"; a message of a conversation has archive in place of move. On a message not expanded the same ids sit in `conversation-message-row-actions`. Everything else (mark as unread, spam, print, download as EML…) is in the menu (`email-view-more-button`, `email-action-<action>`): `email-view-action-print` is gone, `EmailPage.print()` opens the menu | — |
| `email-view-recipients-toggle` | batch D1: the chevron after the last recipient line of an open email, showing the addresses (`aria-expanded`) | — |
| `conversation-more-button` / `conversation-menu` | batch D1: the "More" button of the toolbar of a conversation and its menu; the items `conversation-toggle-seen`, `conversation-toggle-star`, `conversation-archive`, `conversation-move-to-trash`, `conversation-mark-as-spam` are now its menu items (`ConversationPage.runToolbarAction`), no longer buttons | `thread_detail_app_bar` |
| `reply-email-button` / `reply-all-emails-button` / `reply-to-list-email-button` / `forward-email-button` | batch D1: one bar at the bottom of an open email or conversation (Reply all, Reply, Reply to list, Forward; a conversation answers its latest message that is not a draft), no longer under each expanded message | same keys |
| `conversation-message-sender` | batch D1: in an expanded message, the address alone (`<address>`) as the button of its address menu, with Unsubscribe, under the name of the header | `EmailView` of the thread detail |
| `mailbox-folders-tree` | the folders of the user, under the "Folders" title (`role="tree"`, named by `mailbox-tree-title`); `mailbox-tree` is now the system folders (Inbox to Archive, Starred, Action required), named "Mailboxes", and the title only folds `mailbox-folders-tree` | `MailboxCategories.personalFolders` |
| `mailbox-clean-button` | the "Clean" text button of the Spam row (with emails), described by "Delete all spam emails" | `clean` |
| `search-filter-labels` / `search-filter-from` / `search-filter-to` / `search-filter-not-include-events` | the "All labels" menu chip (only when labels are available), the "From" and "To" chips (they open `search-filter-address-popover` with `search-filter-address-input` and `search-filter-address-add-button`; a sender or recipient added shows as `search-filter-removable`), and the "Don't include events" toggle (`aria-pressed`) of the filters above the results | `labels_search_filter_button`, `from_search_filter_button`, `to_search_filter_button`, `events_search_filter_button` |
| `composer-top-bar` | batch E5: on a phone, the 56 px bar of the composer (no title bar, no footer): `composer-close-button`, then `composer-formatting-button` ("Aa", `aria-pressed`, the formatting toolbar is hidden until it is pressed), `composer-attach-file-button`, `rich-text-image-button`, `composer-drive-button` (Drive configured), `composer-send-button` (round), `composer-more-button` ("⋯") | `MobileResponsiveAppBarComposerWidget` |
| `composer-link-item` | batch E5: "Insert link" in the More menu of a phone (the bar has no room for the link button, which stays in the footer elsewhere); the delete is `composer-delete-draft-item` there | `MobileResponsiveAppBarComposerWidget` (popup items) |
| `composer-insert-template-item` | issue #54: "Insert template" in the More menu (every width), between "Save as draft" and "Save as template"; `ComposerPage.openTemplatePicker()` | — (tmail-flutter has no template picker) |
| `template-picker` | issue #54: the picker of "Insert template", `role="dialog"` named "Insert a template" (a centred dialog, a sheet from the bottom on a phone), with `template-picker-close-button`, the filter field `template-picker-search-input` (`role="combobox"`, "Search templates"), the list `template-picker-list` (`role="listbox"`) of `template-picker-item` options (the subject, then the team address and the preview while filtering), `template-picker-results` (live region, "N templates found", filled once the filter changes) and `template-picker-none` when there is no template. Asking whether to insert or replace uses `confirm-dialog` | — |
| `email-address` / `email-address-card` + `email-address-compose-item`, `email-address-invite-item`, `email-address-chat-item`, `email-address-create-rule-item`, `contact-card-name`, `contact-card-address`, `contact-card-copy`, `contact-card-close`, `contact-card-actions` | batch D5: each address of a header (the sender, To, Cc, Bcc, of an email and of an expanded message) opens its contact card, a named dialog (a bottom sheet on a phone): avatar, name, address with a copy button, then "Compose email", "Invite to an event" (with `CALENDAR_SPA_URL`), "Chat" (with `CHAT_SPA_URL`) and "Create a rule with this email" (with filtering rules). `email-address-menu` and `email-address-copy-item` are gone (copy is `contact-card-copy`). The page object has `EmailPage.addressCard` and `EmailPage.addressButton(line, name)` | `EmailAddressDialogBuilder`, `EmailAddressBottomSheetBuilder`, `copy_email_address`, `compose_email`, `quickCreatingRule` |
| `label-chips` / `label-chip` / `label-chip-more` | batch D5: in a list row, the first label then "+N" (its tooltip and the accessible name of the list name the hidden labels); on a phone and a tablet they end the preview line | `LabelTagListWidget` |
| `treeitem` rows of the folder trees | issue #102: a row of a folder tree (`mailbox-item`, `role="treeitem"`) holds the keyboard focus, not its link (`tabindex="-1"`, for the pointer; a click on it hands the focus to the row). A tree is one tab stop (`tabindex="0"` on one row, `-1` on the others, and on the links and buttons of the other rows); Tab then goes to the expand arrow and the menu button of that row. `MailboxPage.focusFolder(ref)`, `expectFolderFocused(ref)`, `focusedFolderName()` and `treeTabStops(tree)` drive and check it; `folder(ref).getByRole('link')` is still the way to click a folder with the pointer. The name of the row is the one of its link (`aria-labelledby`) | — |
| `rich-text-image-alt-input` / `composer-save-announcement` | batch E8: the "Alternative text" field of the image toolbar (`ComposerPage.imageAltInput`; Enter writes it, Escape cancels, empty means `alt=""`; an image inserted starts empty) and the live region (`role="status"`, visually hidden) that says an autosave ("Draft saved", "Draft not saved"). `composer-save-status` is now plain text, no live region: a save asked for is said by its toast only. `ComposerPage.selectLastImage()` selects the image before the caret. The chips of a recipient field announce their addition in the `role="status"` of the field ("alice@example.com added", "N recipients added"), and a field with many chips scrolls inside 3 rows | — |
| `label-color-picker` / `label-color-custom` / `label-color-hex-input` / `label-color-native-input` | issue #59: in the label modal, the colour group (`fieldset`, legend "Choose a label color"), its last radio "Custom color" (named "Custom color #RRGGBB" once it holds a colour; checked for a colour out of the palette), and, when it is checked, the hexadecimal field (`aria-invalid` and a `role="alert"` message when it is not `#RRGGBB`; `#RGB` and no `#` are read) and the native colour input ("Open the color picker"). "No color" is only offered at creation and to a label without colour (the backend refuses `color: null`). `LabelModals.colorSwatch(name)`, `customColorSwatch`, `customColorHexInput`, `customColorNativeInput` and `chooseCustomColor(hex)` drive them | `ColorPickerModal` (`create_new_label_modal.dart`) |
| `email-list-loading` / `mailbox-tree-loading` / `email-view-loading` | batch D8: the skeletons of the email list (and of the search results), of the system folders and of an open email or conversation while they load: `aria-busy="true"`, their shapes `aria-hidden`. Rows of the list skeleton are the `tbody tr` of `email-list-loading`; the open email keeps its real toolbar (`conversation-toolbar`, `email-view-back-button`). `LoadingPage` has them, the `box` of an element, `expectSameBox` and the layout shift; `support/jmapGate.ts` (`holdJmapMethods`) holds the JMAP requests of given methods to look at them | — |
| `loading-announcement` | batch D8: the one polite live region of the page (`role="status"`, visually hidden) that says "Loading" while at least one skeleton shows, empty otherwise | — |
| `offline-banner` / `network-announcement` | batch D8: the red banner "No internet connection" with its "Dismiss" button (hides it for the session), shown while the browser is offline (`navigator.onLine`), and the polite live region (`role="status"`, visually hidden) saying "No internet connection", then "Back online" once | `NetworkConnectionController`, `no_internet_connection` |
| `skip-to-content` | issue #228: the skip link, first Tab stop of the signed-in pages, visible only while focused ("Skip to main content"); following it focuses `main-content` (`tabIndex="-1"`), which also takes the focus after a navigation that left it on `<body>` (signing in) | — |
| `compose-intent` / `intent-error-<reason>` | the `/intents` page (cozy-stack intent `CREATE io.cozy.mails`, `docs/cozy-intents.md`): the composer alone filling the frame, its title then `composer-close-button` (on a phone, the `composer-top-bar` of the form); and why an intent cannot be served, `intent-error-unavailable`, `-forbidden`, `-failed`, `-session-expired`, `-unsupported`, `-invalid-data`, `-untrusted-frame` (a page the cozy-stack does not allow frames the client app) | — |
| `email-list-item-answered` | answered or forwarded state icon of a wide row (named "Replied message", "Forwarded message"…) | `buildIconAnsweredOrForwarded` |
| `folder-action-progress-banner` / `folder-action-progress-bar` / `folder-action-progress-status` | issue #319: while every email of a folder is marked read or the Trash / Spam is emptied, the thin progress bar above the list (`role="progressbar"`, `aria-valuenow` in % once the total is known, none while `Mailbox/clear` runs) and the polite live region saying the action started; the long folder actions are disabled meanwhile | `MarkMailboxAsReadLoadingBanner` |
| `folder-visibility-folders-toggle` / `folder-visibility-folders` | Settings > Folder visibility: the "Folders" bar folding the personal folders and the team mailboxes, and what it folds | `MailboxVisibilityFoldersBarWidget` |
| `folder-visibility-expand-button` | Settings > Folder visibility: expands or collapses the subfolders of a folder | `MailboxExpandButton` |
| `composer-save-draft-button` | "Save as draft" icon button beside "Delete" in the bottom bar of the composer (not on phones, where it is `composer-save-draft-item`) | `UiKeys.saveDraftButton` |
| `login-password-toggle` | "Show password" / "Hide password" button of the password field of the basic login, as tmail-flutter's eye | — |
| `settings-sign-out-button` | "Sign out" at the end of the settings menu of a desktop, after a divider, as tmail-flutter | `AccountMenuItem.signOut` |
| `create-first-rule-button` | "Create My First Rule" of the empty Email rules; `add-rule-button` ("Add a rule") is now beside the title whether rules exist or not, as tmail-flutter | `createMyFirstRule` |
| `composer-sending-dialog` | "Sending message" modal dialog while a message is built ("Creating message...") then sent ("Sending message..."), as tmail-flutter; the Send button keeps its label | `SendingMessageDialogView` |
| `shortcuts-categories` | the tabs of the keyboard shortcuts (Settings and the `?` dialog), as tmail-flutter: "Navigation & Closing", "Reading & Replying", "Message Management & Selection" | `ShortcutCategory` |
| `email-link-tooltip` | the address of the link of the body under the pointer or holding the focus, in a black tooltip under it (decorative, `aria-hidden`), as tmail-flutter | `IframeTooltipOverlay` |
| `drawer-header` | the top of the folder drawer below the desktop size: the logotype, and without the platform of Twake Workplace (status `public`) the `help-button`, `settings-button` and `logout-button`, as tmail-flutter's drawer (the bar of the mail then has the filter alone) | — |
| `email-list-item-checkbox` (compact rows) | below the desktop size, the 48 px avatar of the row is its selection checkbox (`role="checkbox"`, a blue disc with a check once selected), as tmail-flutter; the compact rows have no star nor read toggle, the selection toolbar has them | — |
| `recipient-card` + `recipient-card-copy-button`, `recipient-card-edit-button`, `recipient-card-create-rule-button`, `recipient-card-close-button` | the card a recipient tag of the composer opens on a click or Enter (a `dialog` named by the recipient): copy the address, "Edit email" (the tag back into the input; F2 or a double click on the tag does it directly), "Create a rule" (with filtering rules) | `EditRecipientsView` (`DesktopEditRecipientsView`) |
