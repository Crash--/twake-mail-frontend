# Team mailboxes: parity with tmail-flutter

Audit of the team mailbox behaviours of tmail-flutter (master, the web app)
against this app. Status: ✅ at parity, ⚠️ partly, ❌ missing, ➕ beyond
tmail-flutter (asked by "respect `myRights` everywhere"). Effort: S (< half a
day), M (about a day), L (several days). The last column says where the gap is
handled once this document is up to date.

## How a team mailbox looks to the client

James (tmail-backend) exposes the team mailboxes a user belongs to as
mailboxes of the user's own account, told apart by their `namespace`
(`Mailbox/get` needs `urn:apache:james:params:jmap:mail:shares` in `using`;
tmail-flutter adds it, as `CapabilityIdentifier.jmapTeamMailboxes`, to every
mail request when the session has it):

- `Personal` or no namespace: a folder of the user;
- anything else (`TeamMailbox[team@example.com]`, `Delegated[alice@example.com]`
  for a folder shared by another user): not personal. A folder without a
  parent is the **root** of a team mailbox (`isTeamMailboxes`), the others are
  its folders (`isChildOfTeamMailboxes`). The system folders of a team mailbox
  (INBOX, Drafts, Sent, Outbox, Trash, Templates) have **no role**: the clients
  know them by their name, directly under the root.
- `myRights` says what the member may do in each folder (`mayCreateChild`,
  `mayRename`, `mayDelete`, `mayRemoveItems`, `mayAddItems`, `maySetSeen`,
  `maySetKeywords`, `maySubmit`, `mayReadItems`); the system folders have
  `mayDelete: false`.
- Members get an identity whose address is the team mailbox address.

## Gap table

Flutter paths are relative to `tmail-flutter/` (`lib/features/` abbreviated
`f/`), React paths to `common/src/features/` (abbreviated `r/`).

### Detection, session, structure

| Behaviour | Flutter | React | Status | Effort |
|---|---|---|---|---|
| Not personal = `namespace` neither null nor `Personal`; root = no parent | `model/lib/extensions/presentation_mailbox_extension.dart` (`isPersonal`, `isTeamMailboxes`, `isChildOfTeamMailboxes`) | `r/mailbox/mailboxTree.ts` (`isPersonalMailbox`) | ✅ | |
| `namespace` asked in `Mailbox/get` | `f/mailbox/domain/constants/mailbox_constants.dart` | `r/mailbox/queries.ts` (`MAILBOX_PROPERTIES`) | ✅ | |
| Shares capability added to every mail request when the session has it | `lib/main/error/capability_validator.dart` (`toCapabilitiesSupportTeamMailboxes`) | `jmap/withExtraCapabilities.ts`, `jmap/JmapSessionProvider.tsx` | ✅ | |
| Address of the team mailbox = what the namespace holds between brackets | `presentation_mailbox_extension.dart` (`emailTeamMailBoxes`) | `r/mailbox/mailboxTree.ts` (`teamMailboxAddress`) | ✅ | |
| System folders known by name (no role): Trash, Drafts, Templates, Sent, Outbox | `presentation_mailbox_extension.dart` (`isTrashTeamMailbox`, `isDraftsTeamMailbox`, `isTemplatesTeamMailbox`) | only Trash (`isTeamTrash`) and the delete-forever list (`useRemoveEmails.ts`); the other places test `role` | ✅ done |  |
| Only a first-level system folder of a team mailbox counts as such (not `Team/Project/Trash`) | `isFirstLevelTeamSystemFolder` | none | ✅ done (`isFirstLevelTeamFolder`) |  |
| Capability `subaddressingSupported` of the same extension | `session_extensions.dart` (`isSubAddressingSupported`), personal folders only | none (no subaddressing at all) | ❌ out of the team scope | M, follow-up |

### Sidebar section

| Behaviour | Flutter | React | Status | Effort |
|---|---|---|---|---|
| Section "Team-mailboxes", shown only when there is one; own heading and tree | `f/mailbox/presentation/model/mailbox_sidebar_category_tree_source_resolver.dart`, `mailbox_categories.dart` (`teamMailBoxes`) | `r/mailbox/MailboxTree.tsx` (`team-mailboxes-section`) | ✅ | |
| One root per team mailbox, its folders under it, nested subfolders | `mailbox_tree_builder.dart` (`teamMailboxTree`) | `mailboxTree.ts` (`buildMailboxSections`) | ✅ | |
| Collapsed folders, the path to the selected one expanded | `ExpandMode` of the nodes | `MailboxTree.tsx` (`toggled`, `selectedAncestors`) | ✅ | |
| Collapse the whole section by its heading | `MailboxCategoriesExpandMode` | `r/mailbox/SidebarSectionsProvider.tsx`, `ds/NavSectionHeader` (`toggle`); kept for the session, all expanded at first | ✅ done | |
| Unread count per folder | `mailbox_item_widget.dart`, `countUnReadEmailsAsString` | `MailboxTreeItem.tsx` | ✅ | |
| No unread count on Trash, Spam, Drafts, Templates, Sent; a team Trash, Drafts and Templates by name, not its Sent or Spam (role only in tmail-flutter) | `allowedToDisplayCountOfUnreadEmails` | `r/mailbox/mailboxDisplay.ts` (`showsUnreadCount`, `showsTotalCount` for the Drafts) | ✅ done | |
| Order: roots alphabetical; under a root the system folders first (Inbox, Drafts, Outbox, Sent, Trash, Spam, Junk, Templates, Archive), then alphabetical; deeper levels alphabetical | `mailbox_tree_builder.dart` (`_applyTeamMailboxSorting`) | `mailboxTree.ts` (`compareMailboxes`: applied at every level, server `sortOrder` before the name) | ✅ done |  |
| Address of the team mailbox under the name of its root (row, picker, visibility settings, folder search) | `sidebar_mailbox_item.dart` (`supportingText`), `label_mailbox_item_widget.dart`, `destination_picker_search_mailbox_item_builder.dart`, `mailbox_searched_item_builder.dart`, `label_mailbox_visibility_item_widget.dart` | none (name only) | ✅ done |  |
| Icons of the system folders of a team mailbox (by name) | `f/mailbox/presentation/extensions/presentation_mailbox_extension.dart` (`getMailboxIcon`) | `r/mailbox/mailboxDisplay.ts` (role only) | ✅ done |  |
| Hide / show a team mailbox (roots only), drives the sidebar and the picker | `mailbox_widget_mixin.dart` (`disableMailbox` for `isTeamMailboxes`), `manage_account/.../mailbox_visibility` | `folderActionItems.ts`, `r/mailbox/FolderVisibilitySettings.tsx` (`folder-visibility-team`) | ✅ | |

### Folder actions and `myRights`

| Behaviour | Flutter | React | Status | Effort |
|---|---|---|---|---|
| New subfolder only with `mayCreateChild` | `mailbox_widget_mixin.dart` (`_listActionForTeamMailbox`) | `r/mailboxActions/folderActionItems.ts` | ✅ | |
| Rename only with `mayRename` (not a root) | same | same | ✅ | |
| Delete only with `mayDelete` (not a root, not a system folder) | same | same | ✅ | |
| Mark as read when there are unread emails | same | same | ✅ | |
| Mark as read needs `maySetSeen` | not checked | not checked | ➕ done |  |
| Team folders do not move; personal folders cannot go under a team mailbox | no `move` for team; `mailbox_creator` has no team tree | `folderActionItems.ts`, `FolderActionsProvider.tsx` (`personalOnly`) | ✅ | |
| Empty the Trash of a team mailbox, only with `mayRemoveItems` | `mailbox_widget_mixin.dart`, `isEmptyableTrash` | `folderActionItems.ts` (`empty-trash`) | ✅ for the menu entry | |
| ...the confirmation says Trash, the banner shows above the list, the subfolders go too | `empty_folder_provider.dart`, `f/mailbox_dashboard/.../trash_folder_strategy.dart`, `mailbox_dashboard_controller.dart` (`isEmptyTrashBannerEnabled...`) | `r/mailboxActions/useEmptyFolder.ts`, `EmptyFolderBanner.tsx`, `emptyFolder.ts`: all test `role === 'trash'`, so a team Trash gets the Spam texts, no banner, keeps its subfolders | ✅ done |  |
| `Mailbox/clear` not used on the first-level system folders of a team mailbox (emails deleted by query instead) | `empty_folder_listener_delegate.dart` (`useJmapClear`) | `emptyFolder.ts` calls `Mailbox/clear` whenever the server has it | ✅ done (works on the memory image, skipped for parity) |  |
| Create a folder at the top level / under a personal folder only | `mailbox_creator_controller.dart` | `FolderActionsProvider.tsx` (`personalOnly`) | ✅ | |
| Folder menu hides what the rights forbid (no reason shown) | `mailbox_widget_mixin.dart` | `folderActionItems.ts` | ✅ | |
| Move the content of a folder: never offered on a team folder | `mailbox_widget_mixin.dart` (`_listActionForTeamMailbox`) | `r/mailboxActions/folderActionItems.ts` (`move-content`) | ✅ done | |
| ...needs `mayRemoveItems` on the source (hidden otherwise) and `mayAddItems` on the destination (listed, not selectable: `requireAddItems`) | not checked | `folderActionItems.ts`, `FolderActionsProvider.tsx` | ➕ done | |
| Create a filter from a folder: not on a team folder | `mailbox_widget_mixin.dart` | `folderActionItems.ts` (`create-filter`, needs the filter capability) | ✅ done | |

### Emails in a team mailbox

| Behaviour | Flutter | React | Status | Effort |
|---|---|---|---|---|
| Delete moves to the Trash of the same team mailbox, not the personal one | `f/mailbox_dashboard/.../get_trash_mailbox_id_and_path_extension.dart` | `r/emailActions/useEmailActions.ts` (`findActionDestination`), `mailboxTree.ts` (`findTeamFolderId`) | ✅ from a folder | |
| ...also from a search, Starred, any list not tied to one folder: each email goes to the Trash of its own mailbox | `handle_action_type_for_email_selection.dart` (`_moveEmailsToTrashAcrossNamespaces`) | one destination for all, the personal Trash when no folder (`toOperation`) | ✅ done |  |
| Delete forever from the Trash and Drafts of a team mailbox | `email_action_reactor.dart` (`_canDeletePermanently`) | `r/emailActions/useRemoveEmails.ts` (`deletesForever`) | ✅ | |
| No Archive, no Spam / Not spam on a team email | `email_action_reactor.dart`, `email_more_action_context_menu_mixin.dart`, `on_thread_detail_action_click.dart` | `r/emailActions/emailActionItems.ts` (`isTeam`), only when the list is a folder | ✅ done |  |
| Swipe archive off on team emails | `thread_controller.dart` (`getSwipeDirection`) | no swipe in the web app | ✅ n/a | |
| Drafts of a team mailbox are drafts (edit, no reply/forward) | `isDraftsTeamMailbox`, TF-4392 | `r/emailActions/EmailActionsMenu.tsx` tests `role === 'drafts'`; the draft itself opens by its `$draft` keyword | ✅ done |  |
| Recipients (not the sender) in the lists of Drafts, Sent, Outbox, Templates | `isOutgoingMailbox` (team Drafts yes, team Sent no) | `r/thread/EmailList.tsx` (`RECIPIENT_ROLES`, role only) | ✅ done (Drafts, Templates) |  |
| Drop an email on the Trash / Spam of the tree | `mailbox_controller.dart` | `r/emailActions/useDropEmails.ts` (role test): dropping on a team Trash runs a plain move | ⚠️ | S |
| Move between personal and team folders from the picker | `destination_picker_view.dart` (team section when moving) | `r/mailbox/MailboxPickerProvider.tsx` | ✅ | |
| Destinations without `mayAddItems` refused (drop) | not checked | `useDropEmails.ts` refuses; the picker offers them | ➕ done (picker and action) |  |
| Read / star / move / delete need `maySetSeen` / `maySetKeywords` / `mayRemoveItems` of the folder | not checked (the server refuses) | not checked | ➕ done |  |
| Read receipt goes out from the identity of the team mailbox | `single_email_controller.dart` (`_getReceiverEmailAddress`) | `r/email/useReadReceiptRequest.ts` | ✅ | |
| Flags (read, starred) on a team email | `Email/set` keywords | `useEmailActions.ts` | ✅ | |

### Composer

| Behaviour | Flutter | React | Status | Effort |
|---|---|---|---|---|
| From lists the identity of the team mailbox | `f/composer/.../setup_list_identities_extension.dart` (only identities with `mayDelete`) | `r/composer/ComposerForm.tsx` (every identity) | open question: this app lists every identity, tmail-flutter keeps those with `mayDelete: true` when the composer gets none from the dashboard, and James gives the team identity (and the default one) `mayDelete: false` on the memory image; production may differ, to confirm |  |
| Replying / forwarding an email of a team mailbox picks its identity and signature | `single_email_controller.dart` (`_setUpDefaultIdentityForTeamMailbox`) | `r/identities/identityForEmail.ts`, `r/composer/replyContent.ts` | ✅ | |
| The draft is saved in the Drafts of the team mailbox of the identity chosen | `get_draft_mailbox_id_for_composer_extension.dart` | `ComposerForm.tsx` (`drafts` taken once, role `drafts`) | ✅ done |  |
| The sent copy goes to the Sent of the team mailbox of the identity | `get_sent_mailbox_id_for_composer_extension.dart` | `ComposerForm.tsx` (`sent`), `composeEmail.ts` (`sendEmail`) | ✅ done |  |
| Outbox of the team mailbox (mobile offline sending) | `get_outbox_mailbox_id_for_composer_extension.dart` | the web app has no outbox | ✅ n/a | |
| A draft reopened from a team Drafts stays there | `get_draft_mailbox_id_for_composer_extension.dart` (`savedDraftMailboxId`) | draft re-saved in the personal Drafts | ✅ done through its identity (a draft without the identity header goes to the personal Drafts) |  |
| Templates folder of a team mailbox | `isTemplatesTeamMailbox`, edit as new | personal Templates only (issue 54) | ❌ | M, follow-up |
| Sending as the team address (`EmailSubmission` with the team identity) | identity id in the submission | same | ✅ | |

### Search, visibility, quotas, push

| Behaviour | Flutter | React | Status | Effort |
|---|---|---|---|---|
| Default search leaves out Trash and Spam, team Trash included | `mailbox_dashboard_controller.dart` (`trashSpamMailboxIds`: `isTrash \ | \ | ✅ done |  | ❌ | S |
| Search finds emails of team mailboxes (shares capability in `using`) | same capability on all requests | same | ✅ | |
| Search scoped to one folder, a team one too | `search_email_filter.dart` | `r/search/searchFilter.ts` (`scope.mailboxId`) | ✅ | |
| Quota of a team mailbox | none (personal quota only) | `r/quota/` personal | ✅ n/a | |
| Push: team mailbox changes (counters, new emails) | `Mailbox/changes`, `Email/changes` of the account | `r/push/pushSync.ts` | ✅ (e2e check) | |
| Rights display (what a member may do) | none | none | ✅ n/a | |

## Beyond tmail-flutter: `myRights` everywhere

tmail-flutter hides the folder actions the rights forbid and leaves the rest to
the server. The task asks this app to respect the rights everywhere, so the
rows marked ➕ add: actions on emails offered only when the folder they are in
allows them (`maySetSeen` for read / unread, `maySetKeywords` for star and
labels, `mayRemoveItems` for delete and move), destinations in the picker
refused without `mayAddItems`, and "Mark as read" on a folder needing
`maySetSeen`.

## Backend and library notes

Found while testing on the memory image (`tmail-backend:memory-1.0.21.x`):

- the root of a team mailbox and its system folders have `mayRename` and `mayDelete` false, everything else true for a member, and `rights` (ACL letters) per member; a manager can restrict a member with `Mailbox/set` `sharedWith/<member>`, which the e2e rights scenarios use;
- `Mailbox/clear` works on the Trash of a team mailbox, although tmail-flutter avoids it;
- the team identity has `mayDelete: false` and the address of the team mailbox as name;
- left for later: team Templates (issue 54), collapsing the section, hiding the unread count of Trash, Drafts, Sent and Templates, subaddressing.
