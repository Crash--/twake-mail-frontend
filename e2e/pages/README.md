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
| `user-avatar` | avatar button opening the account menu | `UiKeys.userAvatar` |
| `account-menu` | the account menu (Settings, Sign out) | `<alias>_account_menu_item_tile` |
| `logout-button` | Sign out item | — |
| `app-grid-toggle-button` | app grid button | `UiKeys.toggleAppGridButton` |
| `app-grid-list` | app grid panel | `UiKeys.listViewAppGrid` |
| `mobile-mailbox-menu-button` | top bar button opening the folder drawer, below 1200 px | `UiKeys.mobileMailboxMenuButton` |
| `mailbox-drawer` | the folder drawer (`role="dialog"` named "Navigation"), holding `mailbox-tree` | — |
| `mailbox-drawer-close-button` | its close button | — |
| `top-bar-folder-name` | name of the current folder in the top bar, on phones | — |
| `search-open-button` | button unfolding the search over the top bar, on phones | — |
| `search-back-button` | button folding it back (also the back button of the search, later) | `search_email_back_button` |
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
| `mailbox-toggle-slot` | room of the expand arrow, only when some folder has subfolders | — |
| `mailbox-more-button` | ⋮ button shown on hover or focus (always on touch screens), named "Actions on <folder>" | `UiKeys.mailboxMoreActionButton` |
| `mailbox-context-menu` | folder actions menu (⋮, right click, menu key or Shift+F10); items `mailbox-action-<action>`: `new-subfolder`, `mark-as-read`, `empty-trash`, `empty-spam`, `move`, `rename`, `hide`, `show`, `delete` | — |
| `add-new-folder-button` | "+" new folder in the "Folders" header | `UiKeys.addNewFolderButton` |
| `show-hidden-folders-button` | toggle listing the hidden folders (`aria-pressed`), shown when some are hidden | — (Settings > Folder visibility in tmail-flutter) |
| `mailbox-item-hidden` | "hidden" beside a hidden folder listed on demand (the row has `data-hidden="true"`) | — |
| `mailbox-name-dialog` / `mailbox-name-input` / `mailbox-name-location-button` / `mailbox-name-submit-button` / `mailbox-name-cancel-button` | the dialog naming a folder to create or rename it, and where it goes | `create_new_mailbox_*` |
| `mailbox-search-button` | magnifier in the "Folders" header | `UiKeys.mailboxSearchButton` |
| `team-mailboxes-section` | "Team-mailboxes" heading and tree, after the folders of the user | — |
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
| `quick-filter-attachments` / `quick-filter-unread` / `quick-filter-starred` | quick filters | `attachments_filter`, `unread_filter`, `starred_filter` |
| `scroll-to-top-button` | floating "back to top" button | `ScrollToTopButtonWidget` |
| `selection-toolbar` | toolbar shown when emails are selected (a `section` named "Selection actions") | — |
| `selection-toolbar-count` / `selection-toolbar-select-all` / `selection-toolbar-select-folder` / `selection-toolbar-clear` | "N selected" (`role="status"`), the select all checkbox, "Select all N messages in this folder", clear | — |
| `selected-email-action-<action>` | its buttons, by `EmailActionId`: `not-spam`, `move-to-trash`, `delete-permanently`, `archive`, `mark-as-read`, `mark-as-unread`, `star`, `unstar`, `move`, `mark-as-spam`; `more` on phones (menu `selection-toolbar-menu`) | `<action>_selected_email_button` |
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
| `remote-content-show-button` / `remote-content-always-show-button` | show them for this email / always for this sender | — |
| `email-view-back-button` | back to the list | `EmailViewBackButton` |
| `email-view-empty` | "No email selected", beside the list from 900 to 1199 px | `EmailViewEmptyWidget` |
| `attachment-item` | one attachment chip (name as text) | `AttachmentItemWidget` |
| `download-all-attachments-button` | "Download all" | `UiKeys.downloadAllAttachmentsButton` |
| `reply-email-button` / `reply-all-emails-button` / `reply-to-list-email-button` / `forward-email-button` | reply actions, under the email and under each expanded message of a conversation (group `email-reply-actions`); "Reply all" when the email reaches more than one other address, "Reply to list" with a `List-Post` | same keys, kebab-cased |
| `email-view-actions` | the actions beside the back button | — |
| `email-view-star-button` | star toggle (`aria-pressed`) | — |
| `email-view-action-<action>` | the main actions as buttons, not on phones: `archive`, `move-to-trash` / `delete-permanently`, `mark-as-unread`, `move`, `mark-as-spam` / `not-spam` | — |
| `email-view-more-button` / `email-view-menu` | "more" button and its menu, holding every action | `email_detailed_more_button` |
| `email-action-<action>` | the items of every email actions menu: `reply`, `reply-all`, `reply-to-list`, `forward` (one email, not in Drafts), `not-spam`, `move-to-trash`, `delete-permanently`, `archive`, `mark-as-read`, `mark-as-unread`, `star`, `unstar`, `move`, `mark-as-spam` (`label-as` later) | `markAsStarred_action`, `moveToSpam_action`, `labelAs_action`… |
| `delete-thread-button` | delete the whole thread | `delete_thread_button` |
| `email-address` / `email-address-menu` + `email-address-copy-item`, `email-address-create-rule-item` | the sender of an email (reading view of one email) and its menu: copy, "Create a rule with this email" | `copy_email_address`, `quickCreatingRule` |
| `calendar-event-card` | iMIP invitation card | `CalendarEventCardWidget` |

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
| `search-filter-<filter>` (`folder`, `date-time`, `has-attachment`, `starred`, `unread`, `sort-by`) | a filter (`aria-pressed`, or `aria-haspopup="menu"` for folder, date and order) | `<filter>_search_filter_button`, `sortBy_search_filter_button` |
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
| `conversation-subject` / `conversation-count` | its subject (`h1`, focused when it opens) and "N messages" | — |
| `conversation` | the messages (`ol` named "Messages of the conversation") | — |
| `conversation-message` | a message (`data-expanded`) | `ThreadDetailCollapsedEmail`, `EmailView` |
| `conversation-message-toggle` | its header, a button (`aria-expanded`); ArrowUp / ArrowDown / Home / End move between them | — |
| `conversation-message-from` / `conversation-message-to` / `conversation-message-preview` / `conversation-message-unread` | sender, recipients (expanded), preview (collapsed), unread marker | — |
| `conversation-toggle-seen` / `conversation-toggle-star` | mark the conversation read or unread, star or unstar it (`aria-pressed`) | `thread_detail_app_bar` buttons |
| `email-view-back-button` / `email-view-body` | back to the list, the body of an expanded message | same ids as the reading view |

## Later phases (planned, used by `ComposerPage` already)

| `data-testid` | Element | Flutter key |
|---|---|---|
| `composer` | a composer window (`role="dialog"` named by its subject; `data-mode`: `normal`, `minimized`, `fullscreen`), the newest first; `composer-dock` holds them | — |
| `composer-minimize-button` / `composer-fullscreen-button` | minimize (then "Show"), full screen (then "Exit fullscreen"), desktop only | `minimize`, `fullscreen` buttons of `desktop_app_bar_composer_widget` |
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
| `composer-more-button` + `composer-save-draft-item` (phase 3), `composer-save-template-item`, `composer-read-receipt-item`, `composer-mark-important-item` | more menu | `UiKeys.composerMoreButton`, `save_as_draft_popup_item`, `saveAsTemplatePopupItem`, `read_receipt_popup_item`, `mark_as_important_popup_item` |
| `composer-attach-file-button` / `composer-file-input` | "Attach file" and its hidden file input | `attach_file` |
| `composer-attachments` + `composer-attachment-item` (`data-status`: `uploading`, `done`, `failed`) + `composer-attachment-remove-button` | the attached files (a list named "Attachments (n)"), each removed (or its upload cancelled) by its button | `AttachmentItemComposerWidget` |
| `composer-drop-zone` | the composer, where dropped files are attached | `dropFileHereToAttachThem` |
| `composer-save-status` | what the autosave did ("Saving…", "Draft saved", "Draft not saved"), a `status` | — |
| `composer-send-error` | why the server refused the message (`role="alert"`) | — |
| `composer-delete-draft-button` / `composer-discard-draft-button` | delete the draft and close; "Discard" of the "Draft saved" toast after a close | `discard` |
| `composer-identity-select` | From identity picker, shown with more than one identity | `identities_list_menu_robot` |
| `confirm-dialog-alternative-button` | the third button of a choice (`useChoose`), e.g. "Discard changes" when closing a modified message | — |
| `settings-menu-item` | "Settings" in the account menu | `manage_account` item |
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
| `label-page` (`data-label-id`) / `label-chips` + `label-chip`, `label-chip-more` | the emails of a label; the labels of an email (list rows, under the subject, with a × there) | `LabelWidget` |
| `advanced-search-label-select` | the label of the advanced search | `UiKeys.advancedSearchLabelDropDown` |
| `confirm-dialog` / `confirm-dialog-confirm-button` / `confirm-dialog-cancel-button` | confirmation dialogs (the focus starts on Cancel) | `confirm_dialog_action` |
| `toast` | the toast shown (`data-severity`); its message is announced by live regions always in the page (`role="status"`, `role="alert"` for errors) | — |
| `toast-undo-button` / `toast-retry-button` / `toast-close-button` | its action ("Undo" after an action, "Retry" after a failure) and close | — |
| `shortcuts-dialog` / `shortcuts-enabled-switch` / `shortcuts-dialog-close-button` | keyboard shortcuts list (`?`), the switch turning them off | `keyboardShortcuts` setting |
