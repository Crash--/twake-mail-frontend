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
| (to write) `SearchPage` | `search_robot.dart`, `search_*_robot.dart`, `web/web_search_*_robot.dart` |
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
| `user-avatar` | avatar button opening the account menu | `UiKeys.userAvatar` |
| `account-menu` | the account menu (Settings, Sign out) | `<alias>_account_menu_item_tile` |
| `logout-button` | Sign out item | — |
| `app-grid-toggle-button` | app grid button | `UiKeys.toggleAppGridButton` |
| `app-grid-list` | app grid panel | `UiKeys.listViewAppGrid` |

### Folder tree (sidebar)

| `data-testid` | Element | Flutter key |
|---|---|---|
| `mailbox-tree` | the sidebar folder tree (`role="tree"`) | — |
| `mailbox-item` | one folder row (`role="treeitem"`), with `data-mailbox-id`, `data-mailbox-role` (JMAP role, absent for personal folders), `aria-current="page"` when selected, `aria-expanded` when it has children | — (found by name in Patrol) |
| `mailbox-item-name` | the folder name inside the row | — |
| `mailbox-unread-count` | unread badge inside the row (absent when 0) | — |
| `mailbox-expand-button` | expand / collapse arrow | — |
| `mailbox-more-button` | ⋮ button shown on hover | `UiKeys.mailboxMoreActionButton` |
| `mailbox-context-menu` | folder actions menu (⋮ or right-click) | — |
| `add-new-folder-button` | "+" new folder in the "Folders" header | `UiKeys.addNewFolderButton` |
| `mailbox-search-button` | magnifier in the "Folders" header | `UiKeys.mailboxSearchButton` |
| `team-mailboxes-section` | "Team mailboxes" group | — |
| `quota-indicator` | used / total storage | — |

### Email list (thread view)

| `data-testid` | Element | Flutter key |
|---|---|---|
| `email-list` | the list (`role="list"` or `grid`) | — |
| `email-list-item` | one row, with `data-email-id`, `data-thread-id`, `data-unread="true"` when unread, `aria-selected` when selected | `EmailTileBuilder` |
| `email-list-item-subject` | subject inside the row | — |
| `email-list-item-sender` | sender inside the row | — |
| `email-list-item-preview` | preview text inside the row | — |
| `email-list-item-date` | date inside the row | — |
| `unread-status-icon` | unread marker of the row | `UiKeys.unreadStatusIcon` |
| `email-list-item-star` | star toggle (`aria-pressed`) | — |
| `email-list-item-checkbox` | selection checkbox | `UiKeys.tabletEmailSelectionAvatar` |
| `important-flag-icon` | "important" marker | `important_flag_icon` |
| `empty-thread-view` | empty folder view | `UiKeys.emptyThreadView` |
| `compose-email-button` | "Compose" | `UiKeys.composeEmailButton` |
| `quick-filter-attachments` / `quick-filter-unread` / `quick-filter-starred` | quick filters | `attachments_filter`, `unread_filter`, `starred_filter` |
| `scroll-to-top-button` | floating "back to top" button | `ScrollToTopButtonWidget` |
| `selection-toolbar` | toolbar shown when emails are selected | — |
| `selected-email-action-<action>` | its buttons: `mark-as-read`, `mark-as-unread`, `star`, `move-to-trash`, `move-to-spam`, `move`, `more` | `<action>_selected_email_button` |
| `empty-trash-banner` | "Empty trash now" / "Delete all spam emails now" banner | `empty_trash_banner`, `UiKeys.cleanMessageBannerNotVisible` |

### Reading an email

| `data-testid` | Element | Flutter key |
|---|---|---|
| `email-view` | the opened email (reading pane or full screen) | — |
| `email-view-subject` | subject | `EmailSubjectWidget` |
| `email-view-from` / `email-view-to` / `email-view-cc` / `email-view-bcc` | address lines; each address is an `email-address` button | `InformationSenderAndReceiverBuilder` |
| `email-view-date` | received date | — |
| `email-view-body` | the body, **a sandboxed iframe** (the page object enters it with `contentFrame()`) | — |
| `email-view-back-button` | back to the list | `EmailViewBackButton` |
| `attachment-item` | one attachment chip (name as text) | `AttachmentItemWidget` |
| `download-all-attachments-button` | "Download all" | `UiKeys.downloadAllAttachmentsButton` |
| `reply-email-button` / `reply-all-emails-button` / `reply-to-list-email-button` / `forward-email-button` | reply actions | same keys, kebab-cased |
| `email-view-more-button` | "more" menu | `email_detailed_more_button` |
| `email-action-<action>` | its items: `mark-as-unread`, `star`, `unstar`, `move`, `move-to-trash`, `mark-as-spam`, `archive`, `label-as` | `markAsStarred_action`, `moveToSpam_action`, `labelAs_action`… |
| `delete-thread-button` | delete the whole thread | `delete_thread_button` |
| `email-address` / `email-address-dialog` | clickable address and its dialog (copy, compose, create rule) | `copy_email_address`, `email_address_dialog_close_button` |
| `calendar-event-card` | iMIP invitation card | `CalendarEventCardWidget` |

## Later phases (planned, used by `ComposerPage` already)

| `data-testid` | Element | Flutter key |
|---|---|---|
| `composer` | the composer dialog / pane | — |
| `composer-to-input` / `composer-cc-input` / `composer-bcc-input` / `composer-reply-to-input` | recipient inputs | `prefix_to_recipient_composer_widget`… |
| `composer-to-field` (… `-cc-`, `-bcc-`, `-reply-to-`) + `recipient-chip` | recipient chips of a field | — |
| `composer-show-cc-button` / `composer-show-bcc-button` / `composer-show-reply-to-button` | reveal hidden fields | `prefix_cc_recipient_expand_button`… |
| `composer-subject-input` | subject | — |
| `composer-editor` | rich text editor (contenteditable) | `mobile_editor` |
| `composer-send-button` | send | `UiKeys.sendEmailButton` |
| `composer-close-button` | close (saves a draft when dirty) | `UiKeys.closeComposerButton` |
| `composer-more-button` + `composer-save-draft-item`, `composer-save-template-item`, `composer-read-receipt-item`, `composer-mark-important-item` | more menu | `UiKeys.composerMoreButton`, `save_as_draft_popup_item`, `saveAsTemplatePopupItem`, `read_receipt_popup_item`, `mark_as_important_popup_item` |
| `composer-attach-file-button` / `composer-attachment-item` | attachments | — |
| `composer-identity-select` | From identity picker | `identities_list_menu_robot` |
| `search-input` / `search-back-button` / `search-suggestion-item` | search bar | `search_email_text_field`, `search_email_back_button` |
| `search-filter-<filter>` (`date-time`, `sort-by`, `labels`, `has-attachment`) | quick search filters | `quick_search_filter_button_<filter>`, `dateTime_search_filter_button`… |
| `advanced-search-button` / `advanced-search-submit-button` | advanced search | `UiKeys.openAdvancedSearchButton`, `UiKeys.advancedSearchSearchButton` |
| `empty-search-view` | no result | `UiKeys.emptySearchEmailView` |
| `settings-menu-<section>` (`preferences`, `profiles`, `email-rules`, `language-region`) | settings navigation | `setting_preferences`, `setting_profiles`, `setting_email_rules`, `setting_language_region` |
| `create-rule-button` / `email-rule-item` / `email-rule-edit-button` | email rules | `UiKeys.createRuleButton`, `editEmailRuleButton_<name>` |
| `label-item` / `add-new-label-button` / `label-modal` / `label-name-input` / `label-save-button` | labels | `UiKeys.addNewLabelButton`, `create_new_label_modal`, `label_name_input_field`, `save_label_button_action` |
| `confirm-dialog` / `confirm-dialog-confirm-button` / `confirm-dialog-cancel-button` | confirmation dialogs | `confirm_dialog_action` |
| `toast` | snackbar / toast (`role="status"`) | — |
