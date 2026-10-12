# twake-mui gaps

Components, variants and fixes that `@linagora/twake-mui` (10.0) does not
provide yet, what Twake Mail uses instead, where, and what twake-ui would
need. Outside the local design system, raw MUI is never used: the UI twake-mui
lacks is built in `common/src/ds/` (imported as `@/ds/...`, rules in its
[README](../common/src/ds/README.md)), from the MUI components twake-mui
re-exports, its own components and `@linagora/twake-css` utility classes.
Each `ds/` component says in its header whether it should go upstream.

## Components

| Component / variant | Intended usage | Used meanwhile | Where | Needed upstream |
|---|---|---|---|---|
| `AppTitle` (logotype) | Top bar, login card | Rebuilt from twake-icons (`Mail`, `TwakeText`, `MailText`), one `img` named by a `label` prop | `ds/AppTitle`, wrapped by the injectable `layout/AppTitle.tsx` | Export `Apptitle`: still not exported from the entry point in 10.0 (the component exists in `src/components/Apptitle`) |
| Top bar / app header | Below the desktop size, under the platform bar (`@linagora/twake-bar`, which holds the logo, the apps and the account): a menu button, the folder name, the search (folded on phones), help and settings | `AppBar position="static" color="inherit" elevation={0}` + `Toolbar` with title, search and actions slots, `IconButton`s for the menu and the search | `ds/AppTopBar`, filled by `layout/TopBar.tsx` | A top bar matching `Layout`/`Main` (`withTopBar`, 48 px reserved below `lg`), with title, centre and actions slots and its responsive behaviour (see "Responsive"). The Layout story fakes one with `Box` + `sx` |
| `SearchBar` labels | Top bar search | `SearchBar` with `disabledClear` and a translated clear button passed as the input `endAdornment` | `ds/SearchCombobox` | Fixed in 9.17 (so in 10.0): the clear button label is translated (en, fr, ru, vi). Remains: the default input label (`Search`) is hard-coded in English (accept a label), and a slot for buttons after the input (advanced search); `ds/SearchCombobox` keeps its own clear button |
| Search with suggestions | Search field of the top bar: suggestions while typing, quick filters above them | ARIA 1.2 combobox around `SearchBar`: `role="combobox"` input, grouped `listbox` with `aria-activedescendant`, a free header (filters) in a `Popper` kept next to the field in the DOM (tab order), Escape closing the list before reaching the page, right click focusing the field | `ds/SearchCombobox`, filled by `features/search/SearchField.tsx` | A search field with suggestions (MUI `Autocomplete` cannot host `SearchBar` nor a header of filters); every Twake app with a search needs one |
| Centered auth card | Basic login form | `Box component="main"` with twake-css centering + `Paper variant="outlined"` | `ds/CenteredCard` | A centered card layout for sign-in and error pages |
| Event card ("Orange Bar") | The calendar event of an invitation, above the body of the email: date icon, state badge, title, labelled details (when, where, video, who), answers, "Mail to attendees", "See in your Calendar" | The design of linagora-design-flutter `LinagoraEventCard` (#119, #122) rebuilt with `Box` + `sx`: a `section` region named by its label, a `dl` of details (label column of 67 px, labels above values on phones), `ButtonBase` pills as `aria-pressed` toggles (a check on the chosen one), text actions as `ButtonBase` or `Link` | `ds/EventCard` (`EventCard`, `EventAnswerButton`, `EventTextAction`), filled by `features/calendar/CalendarEventCard.tsx` | An event card in twake-ui, which Twake Calendar (event preview) and Chat could share. Colours of the design darkened for AA: pills #0A84FF → #0067D6 (3.6:1 → 5.6:1 with white), the orange of the date icon #F67E35 → #C25414 (white text), labels #424244 at 64 % → 80 %, the calendar action #0C8CE9 → `primary.dark` |
| Dialog framing an app | The Twake Drive picker of the composer | MUI `Dialog` (named by a visually hidden title: the framed page has its header; full screen on phones, elsewhere centred at the size the framed page asks for through the cozy intent `resize`, 900 × 800 by default, capped by the screen, its transition off under `prefers-reduced-motion`) holding an `iframe` with a `title`, a `role="status"` progress until the framed page is ready, then the focus in the frame; a close button over the frame while it loads, which the framed page takes over once ready (`showCloseButton`, the intent `showCross` / `hideCross`); an error in a `role="alert"` with its actions | `ds/FramedDialog`, used by `features/composer/DriveAttachButton.tsx` | A dialog variant hosting another app (Drive picker, Calendar and Chat intents), with its loading state |
| Colour swatches | The colour of a label | A native radio group of round swatches, a "no colour" choice, visible focus and selection rings | `ds/ColorSwatchPicker`, used by `features/labels/LabelDialog.tsx` | A colour picker (swatches, custom colour) |
| Coloured tag | The labels of an email (list rows, reading view) | A `span` in the colour, black or white text for contrast, an optional × `ButtonBase` | `ds/ColorTag`, used by `features/labels/LabelChips.tsx` | A `Chip` taking any colour, with a readable text colour |
| Full-page loader | Waiting for the SSO, the session | `CircularProgress` centered with twake-css classes, `aria-busy` | `ds/FullPageLoader` | A full-page spinner |
| Full-page error | Session, crash, configuration errors | `Empty` + `Button` in a `role="alert"` box | `ds/ErrorScreen` | An error variant of `Empty` with a recovery action |
| Mailbox tree | Sidebar folders (and the "Team-mailboxes" tree, its own heading and `role="tree"`), and the labels | `NavTree` (`Nav` without its fixed `margin: 24px 0`, `role="tree"`) of `NavTreeItem`s: a `NavItem` (`role="treeitem"`, `aria-level`) whose row carries the hover and selected backgrounds (full 36 px, radius 8), the `NavLink` stretched over it, then the expand arrow as an `IconButton` of its own after the label (44 px on touch screens), a `CountBadge` and the actions that replace it on hover or keyboard focus; indentation by padding (8, 44, 52, +8) without a cap; the name in a tooltip when truncated. The "Folders" title is a heading outside the tree (`NavSectionHeader`; a `ListSubheader` inside it breaks the tree role) | `ds/NavTreeItem`, `ds/NavTree`, `ds/NavSectionHeader`, `ds/CountBadge`; used by `features/mailbox/MailboxTreeItem.tsx`, `StarredTreeItem.tsx` and `features/labels/LabelsSection.tsx` | Nested, collapsible `NavItem`s (more than the one level of `NavDesktopDropdown`) with the expand arrow after the label, an uncapped indentation, a counter, hover actions and drop target support; the selected background on the `NavItem`, not on a `NavLink` that is `height: 100%` of a parent with no height (it measured 124 x 19 px inside the drop target); a `Nav` without margin or with a `subheader` that does not end up inside a `role="tree"` list
| Message list | The email list: thousands of rows loaded page by page, one line per email | `VirtualizedTable` of twake-mui, as in Twake Contacts, through `VirtualizedListTable` with a `RowLink` per row and `RowHoverActions` (also used by the folders of the tree, `in="listItem"`) | `ds/VirtualizedListTable`, `ds/RowLink`, `ds/RowHoverActions`; used by `features/thread/EmailList.tsx` and `EmailCell.tsx` | See "VirtualizedTable" below |
| Unread dot | Unread marker of a list row | `CircleFilled` icon (8 px) in a `Typography color="primary"`, named by a `label` | `ds/StatusDot` | A status dot / badge without a number |
| Readable secondary text | Preview, dates, address lines, hints | `Typography` coloured Grey 900 at 80 % (5.4:1 on white) | `ds/SecondaryText` | Fix `text.secondary` in the theme (see "Accessibility") |
| Compose button | The main action of the sidebar | `Button variant="contained"` restyled: radius 12 (twake-mui forces `radius.pill` on every `Button`), 14/18.4 medium label (twake-mui `button` is 16 px), 12 px icon, 39 px high, official primary colour | `ds/ComposeButton`, used by `layout/MailSidebar.tsx` | A `Button` radius/size variant |
| Navigation counter | Unread count of a folder | A pill (`span`): Action/selected background, 11/16 medium, min-width 16, padding-x 4.5, "999+" past 999; `Badge` is a dot over an avatar and a small `Chip` is 24 px high | `ds/CountBadge` | A navigation badge next to `NavText` |
| Navigation section header | "Folders", "Labels" and their action buttons | A level 2 `Typography caption` (12/500) in `text.secondary`, above the list it titles; collapsing the section comes later | `ds/NavSectionHeader` | A `Nav` `subheader` that keeps the tree role, with an actions slot |
| Icons of the system folders | Inbox, Outbox, Spam, Templates, and a vertical "more" (⋮) | The closest existing icons: `Email`, `Send`, `Warning`, `Note`, horizontal `Dots` | `features/mailbox/mailboxDisplay.ts`, `MailboxTreeItem.tsx` | `Inbox`, `Outbox`, `Spam`, `Template` and `DotsVertical` in twake-icons (the Figma file has them); the folders use `FolderOutlined`, drafts `FileOutline`, starred `StarOutline` |
| Sidebar width | The folder column | `SIDEBAR_WIDTH` (236, twake-mui's own) in `ds/ResponsiveSidebar`, passed as `sx` | `ds/ResponsiveSidebar` | A `width` prop on `Sidebar`. At 236 px "Boîte de réception" is cut by 2, 8, 15 and 28 px with 1, 2, 3 digits and "999+" (name and tooltip stay complete) |
| Email header | Subject, sender with avatar, To/Cc/Bcc lines, date of the reading view | `Typography`, `Avatar` in a CSS grid whose date goes under the recipients on phones, long addresses wrapping | `ds/MessageHeader`, filled by `features/email/EmailView.tsx` | A message header component (identity, recipients, date, actions) that reflows on narrow screens |
| Attachment chip | Attachments of an email, as tmail-flutter: 260 x 36 px chips (file icon, name keeping its extension, size, blue download button), the ones fitting on one row then "Show +N more" (three in a column on a phone), a grey header with "Download all" | `ButtonBase`, `IconButton`, `Tooltip`, a `ResizeObserver` measuring the row | `ds/AttachmentCard` (`AttachmentCard`, `AttachmentCardRow`, `AttachmentHeader`, `AttachmentDownloadAll`, `AttachmentTextButton`, `AttachmentListFrame`, `visibleAttachmentCount`) | An attachment chip (file type icon, name, size, download and preview actions) |
| Rich text editor | Composer body: formatting toolbar, link dialog, inline images with their size toolbar, quoted email and signature kept as HTML blocks, a line above them on demand | TipTap 3 (MIT) with `RichTextToolbar` (APG toolbar, roving tabindex), `LinkDialog`, `ImageToolbar` (sizes in % of the image, smaller, larger, remove: the keyboard alternative to the resize handles), `HtmlBlock` (atom node, sandboxed iframe), `InlineImage`, `SmartTrailingBlock` (from Messages, MIT), `cleanPastedHtml`; a `disabled` prop (TipTap `editable: false`, `aria-disabled` on the editing area and on every toolbar button, which stays in the tab order, greyed like a disabled field); every `data-testid` comes from the caller (`testIds`) | `ds/RichTextEditor`, used by the composer (`features/composer/ComposerForm.tsx`), the vacation message (`features/vacation/VacationSettings.tsx`, disabled while the response is off) and the DEBUG route `/spike/composer` | A `RichTextEditor` in twake-ui (Twake Chat and Docs need one too), or at least a `Toolbar` with roving focus and toggle/menu buttons |
| Field of chips with suggestions | Recipients of the composer (To, Cc, Bcc, Reply-To), later attendees and sharing | ARIA 1.2 combobox (`InputBase` with `role="combobox"`, `aria-activedescendant`, listbox in a `Popper` kept next to the field) after MUI `Chip`s out of the tab order, reached with ArrowLeft or Backspace, removed with Delete (announced in a live region), edited with Enter, F2 or a double click; invalid chips say so in their name and with an icon. MUI's `Chip`, not twake-mui's (its `React.FC` dropped the `ref` under React 18; since React 19 the `ref` is a plain prop and twake-mui 10's `Chip` forwards it, checked: the ds could use it, not done in the React 19 upgrade) | `ds/RecipientField`, filled by `features/composer/` | A chips field with suggestions (MUI `Autocomplete` `multiple` has no chip editing, no paste of lists and puts every chip in the tab order) |
| Docked window | The composer: windows at the bottom end of the screen, several side by side, minimized to their title bar or full screen, the page still usable around them; full screen on small screens | `Paper role="dialog"` named by its title, `FocusTrap` and `Backdrop` once full screen (`aria-modal`), the content kept mounted in every mode, Escape handed to the owner, focus moved to the title bar on minimize and back on restore; `WindowDock` lines them up, `fitWindows` minimizes what does not fit and puts the rest in `WindowOverflowMenu` (a named menu button at the start of the dock, or in the title bar of the full screen window through `titleBarActions`), so no window is ever out of reach | `ds/DockedWindow`, used by `features/composer/` | A window dock (Gmail's composer, chat windows); `Dialog` has no non modal nor minimized variant |
| Overlay of the host page | Framed by TwakeSpace, the docked windows and the dialogs sit on the page of TwakeSpace, not inside the frame: the composer at the bottom end of the window, a dialog centred on it and dimming all of it | `OverlayPortal` renders into the body of an overlay frame TwakeSpace puts over its whole page, on the app's origin (`public/embed/overlay.html`); `overlayThemeOptions` gives `MuiDialog` and `MuiDrawer` its body as `container` (menus and tooltips follow their anchor's document); the app's CSS rules are copied into it, and the region it draws in is sent to TwakeSpace, which clips the overlay to it | `SpaceOverlay` of `@linagora/twake-mui`, used by `ds/DockedWindow/WindowDock` and `app/AppProviders` | A host overlay for framed apps (twake-space-architecture `specs/twake-surface.md`) |
| Upload list | The attachments of the composer: name, size, progress, cancel or remove | A named `ul` of bordered items with an icon, `LinearProgress` (named `progressbar`) while uploading, a warning icon and words when it failed, an `IconButton` removing it; a live region announcing what changed | `ds/UploadList`, used by `features/composer/` | A file upload list (Mail attachments, Chat files, Drive uploads) |
| File drop zone | Dropping files on the composer to attach them | A `Box` handling the drag events (capture phase) of files only, with the Figma panel over it while files are dragged (dashed light blue frame, file icon, "Drop file here to attach them"); the keyboard way is the button picking files | `ds/FileDropZone`, used by `features/composer/` | A drop zone (Mail, Chat, Drive) |
| Sandboxed HTML viewer | Body of an email | A plain `iframe` (`sandbox`, `srcdoc`, `title`, height from its content) styled by a stylesheet inside the email document | `features/email/emailBody.ts` | Nothing expected from twake-mui, but the theme (fonts, colours) does not reach inside the iframe: the email document repeats a minimal style |
| Conversation (thread detail) | The messages of a conversation, each collapsed (sender, date, preview) or expanded (the message) | `ol` of `li`, each with a full-width `ButtonBase` toggle (`aria-expanded`, `aria-controls`) and a `region` named by it; ArrowUp / ArrowDown / Home / End between the toggles; `MessageHeader` rendered as `span`s inside the toggle | `ds/MessageThread` (`MessageThread`, `MessageThreadItem`), filled by `features/thread/ConversationView.tsx` | A message thread component; MUI's `Accordion` (card look, side expand icon, no keyboard moves between items) does not fit a message list |
| Breakpoints | Phone, tablet and desktop layouts | `useMediaQuery` on 600, 900 and 1200 px (tmail-flutter `ResponsiveUtils`), named `mobile`, `tablet`, `tabletLarge`, `desktop` | `ds/useScreenSize` | See "Responsive": twake-mui's `useBreakpoints` and theme keys (md 769, lg 1024) are made for the Cozy bottom bar |
| Navigation drawer | Folders below the desktop size | Temporary `Drawer` from the start edge, its paper a named `role="dialog"` with `aria-modal`, a header slot and a close button; twake-mui's desktop `Nav*` styles inside | `ds/NavigationDrawer`, `ds/ResponsiveSidebar` (twake-mui `Sidebar` on a desktop, the drawer below) | A `variant="drawer"` of `Sidebar`, and `Nav*` that stay vertical in it (see "Responsive") |
| Touch targets | Icon buttons, list actions, tree toggles on touch screens and phones | `GlobalStyles` giving `IconButton`, `Button`, clickable `Chip`, `MenuItem` a 44 px minimum under `(pointer: coarse), (max-width: 599.95px)`; a 2rem / 44 px slot for the tree expand arrow | `ds/TouchTargets` (in `layout/AppLayout.tsx`), `ds/IconSlot` | The same rule in the theme overrides, and an icon slot in a nested `NavItem` |
| Floating action button | "New message" on phones and tablets | `ExtendableFab` fixed at the bottom end (safe area included), label darkened to 5.3:1 | `ds/FloatingActionButton` | A placement prop on `ExtendableFab`, an AA label colour, and a scroll container to follow (it listens to `window`) |
| Toast (snackbar) | Outcome of an action ("Moved to Trash" with Undo, errors with Retry), one at a time at the bottom of the screen | Two live regions always in the page (`role="status"` polite, `role="alert"` for errors) holding the message, and a `Paper` with the message (hidden from screen readers, read by the regions), an action `Button` and a close `IconButton`; a countdown paused on hover, focus and hidden page; Escape closes it; no animation with reduced motion | `ds/ToastRegion`, filled by `features/notifications/NotificationsProvider.tsx` | MUI's `Snackbar` mounts its `role="alert"` content with the text (often not read), knows no polite message, and closes on its timer while the focus is in it: a notification region with persistent live regions, pause on hover and focus, an action and a severity |
| Filterable list (picker) | The folder picker of "Move message": a filter field and the folders, always shown | `TextField` as an ARIA 1.2 combobox (`aria-activedescendant`) driving a `List` `role="listbox"` of `ListItemButton` options (`aria-selected`, `aria-disabled`), indented by level, the path shown while filtering | `ds/FilterableListbox`, filled by `features/mailbox/MailboxPickerProvider.tsx` | A picker list (`Autocomplete` only knows a popup list): Drive and Calendar pick folders and calendars the same way |
| Drop target | Folders of the tree receiving emails dragged from the list | A `Box` with the drag events, outlined (dashed primary) while an accepted drag is over it; `setDragLabel` shows "Move 2 messages" under the pointer | `ds/DropTarget`, used by `features/mailbox/MailboxTreeItem.tsx` | Drop target support on `NavItem` (see "Mailbox tree"), and a drag preview helper |
| List and detail | The email list and the open email: one at a time, or side by side from 900 to 1199 px | Two `Box` panes (list 375 px, as tmail-flutter), only the shown ones rendered, focus given back to the list when the detail closes beside it | `ds/ListDetailLayout`, used by `apps/private/src/features/mailbox/MailboxPage.tsx` | A master-detail layout |
| Sticky bar | The actions of a conversation (back, read, star, move) staying in view over a long thread, on phones above all | A `Box` `position: sticky; top: 0` over the paper background; the messages scrolled to leave `scroll-margin-top` for it | `ds/StickyBar`, used by `features/thread/ConversationView.tsx` (`MessageThreadItem` for the margin) | A sticky variant of the toolbar / app bar |
| View transitions (list ↔ item) | Opening and closing an email: a swipe-like slide below 900 px, a fade through above, nothing with reduced motion or without the API | `prepareViewTransition(direction)` (API and `prefers-reduced-motion` check, direction on `<html>`) passed as the `viewTransition` option of the router `navigate`; `view-transition-name` on the panes and `::view-transition-*` rules in `GlobalStyles` | `ds/ViewTransition`, styles in `ds/ListDetailLayout`; called from `features/thread/EmailCell.tsx`, `features/email/EmailView.tsx`, `features/email/useEmailViewShortcuts.ts`, `features/search/SearchField.tsx` | Transitions between views in the theme (durations, easings, a reduced-motion switch), or the master-detail layout with them |
| Search row (desktop) | The search pill (820 px at most) at the top of the page, under the app bar, with the settings icon button at the far end of the row | `Box` flex row: `SearchCombobox` (around `SearchBar`) then the actions | `ds/SearchRow`, filled by `layout/MailSearchRow.tsx` | A page header / toolbar row with a start slot growing to a max width and an end slot |
| List filter ("Filter ˅") | Dropdown of the list toolbar as tmail-flutter's `FilterMessageOption`: attachments, unread, starred, one at a time, a toast, a clear button; the icon alone on phones | twake-mui `DropdownButton` + `Menu` of `menuitemradio`. The filtered folder is a query list (`Email/query` filter ANDed to `inMailbox`) that push keeps in sync; no `ds/` component needed | `features/thread/EmailListFilterMenu.tsx`, `listFilter.ts`, `ListFilterProvider.tsx` | A list toolbar / filter button pattern in twake-mui |
| Text button size | "Select all" and "Filter" of the list toolbar are 14/500/20 in the design | `Button variant="text" color="inherit"` (grey, as the design); twake-mui `typography.button` is 16/500, left as is (no global theme override) | `features/thread/EmailListDefaultToolbar.tsx` | A 14 px button size in the theme |
| Flat body (`Layout` variant) | The body plain white, one card for the whole main pane on a desktop (16 px from the platform bar and the window, 16 px radius, the grey of the `Layout` around it), flush below the desktop size; no card inside it | `Main` and `Content` with `sx` (`bgcolor`, margins and radius of `Main` with `inset`, `m: 0`, `borderRadius: 0` on `Content`) | `ds/FlatPanes` (`FlatMain inset`, `FlatContent`) | A flat variant of `Layout` / `Main` / `Content` (still missing in 10.0) |

## VirtualizedTable

The email list uses `VirtualizedTable` like Twake Contacts (`ContactsTable.tsx`,
`ContactCell.tsx`, `AddressBookPage.tsx`): one cell component switching on
`column.id`, rows given as data objects with a stable `computeItemKey`,
`endReached` loading the next page, no column sort (the server sorts), hover
actions revealed by a `.MuiTableRow-root:hover` rule. Twake Mail needs more
than 10.0 offers; `ds/VirtualizedListTable` composes `VirtualizedTable`
(nothing re-implemented: virtualization, cells, memoized rows and selection
stay twake-mui's) and passes its own `components`, the only extension point.
What it adds, each a candidate for the PR below:

1. **No row attributes.** The `tr` only gets virtuoso's attributes: no way to
   put `data-testid`, `data-email-id`, `data-unread` or `aria-*` on a row.
   Wrapper: a `getRowProps(row)` read by its own `TableRow`.
2. **`components` replaces everything, and `virtuosoComponents` is not
   exported.** Changing the row means restating the five adapters
   (`Scroller`, `Table`, `TableHead`, `TableBody`, `TableRow`), which the
   wrapper does.
3. **The header cannot be hidden.** `fixedHeaderContent` is forced after the
   props. A message list has no visible header, but screen readers need the
   column names. Wrapper: `TableHead` with `u-visuallyhidden` (its
   `!important` beats virtuoso's inline `position: sticky`).
4. **No name, no row count.** The table has no accessible name, and screen
   readers cannot tell how many rows exist beyond the rendered ones. Wrapper:
   `label` (`aria-label`), `rowCount` (`aria-rowcount`), `aria-rowindex` on
   rows.
5. **Rows are neither links nor focusable.** `rowContent.onClick` makes a
   cell clickable, but a row can neither be focused with the keyboard nor
   opened in a new tab (middle click, Ctrl+click, context menu). Wrapper: a
   `RowLink`, a real `<a href>` stretched over its row with `::after` (plain
   clicks go through the router), in a cell; the other buttons of the row
   stay above it. Rows are therefore not clickable through
   `rowContent.onClick`, which would navigate twice.
6. **No keyboard navigation between rows.** Wrapper: ArrowUp / ArrowDown move
   the focus to the `RowLink` of the previous / next row (rows just beyond
   the viewport are rendered by the overscan, `increaseViewportBy`).
7. **No focus or scroll restoration.** Coming back from an email, the list
   restarted at the top and the focus was lost. Wrapper: `focusedRowIndex`
   (virtuoso `initialTopMostItemIndex`, then focus of the row link). Passing
   `initialTopMostItemIndex={undefined}` explicitly renders no row at all.
8. **Column widths ignored with a fixed layout.** The first row of a virtuoso
   table is a one-cell spacer, so `table-layout: fixed` takes no width from
   the cells. Wrapper: a `colgroup` built from `columns[].width`.
9. **Hover-only actions.** No theme rule nor slot: Contacts uses an `sx` rule
   on `.MuiTableRow-root:hover &` (its `ContactRowActions.tsx` waits for a
   twake-mui rule). Wrapper: `RowHoverActions`, shown on hover and on
   `:focus-within` (keyboard), always on touch screens, transparent rather
   than hidden so that the actions stay in the tab order.
10. **`HeadCell` needs a twake-i18n provider** (`useExtendI18n` for its sort
    labels) even when no column is sortable: a library component should not
    require the i18n context of the app.
11. **Body cells are greyed** with `text.secondary` (3.6:1, see below).
    Wrapper: cells in `text.primary`.
12. **`endReached` is not reported again** when the page just appended still
    ends in view (virtuoso only fires it when the last index changes while in
    view). The list also follows `rangeChanged` and asks for the next page
    while fewer than 10 rows are left below the visible ones.
13. **No narrow mode.** Six columns do not fit a phone, nor the 375 px list
    beside an open email. Wrapper: `compactColumns`, used while the table is
    narrower than 600 px (a `ResizeObserver` on the scroller) or when
    `compact` is set: Twake Mail swaps to an unread marker, a four-line
    message cell (sender and date, subject, two lines of preview, in the
    `RowLink`, `multiline`) and the star and read toggle stacked. Virtuoso
    measures the taller rows by itself.
14. **No room after the last row.** A floating button covers the end of the
    list. Virtuoso's `fixedFooterContent` is sticky; the wrapper's
    `TableFoot` drops that style and renders an `aria-hidden` spacer row of
    `bottomInset` pixels (padding on the scroller is not scrollable).
15. **No row menu.** A right click, the menu key or Shift+F10 on a row
    should open the actions of the row. Wrapper: `onRowMenu(row, anchor)`,
    the anchor being the pointer (right click) or the row (keyboard), the
    contextmenu event sent after the menu key ignored.
16. **No draggable rows.** Wrapper: `onRowDragStart(row, event)` makes the
    rows `draggable` and lets the app set the dragged data.

**Proposed twake-ui PR**, "feat(VirtualizedTable): list mode with row
attributes, hidden header and row links":

- export `virtuosoComponents`, or merge `components` with the defaults
  instead of replacing them;
- `getRowProps?: (row) => TableRowProps` applied to each `tr`;
- `hideHeader?: boolean` rendering the header visually hidden but kept for
  screen readers, plus `aria-label`, `aria-rowcount` and `aria-rowindex`;
- `getRowHref?: (row) => string` and `LinkComponent`, rendering a link
  stretched over the row (focus ring on the row, plain clicks delegated to
  `LinkComponent`), with ArrowUp / ArrowDown between rows;
- `focusedRowIndex` (initial scroll and focus), a `colgroup` from the column
  widths, a `MuiTableRow` theme rule for hover / focus-within actions;
- `HeadCell` without `useExtendI18n` when no column is sortable (or sort
  labels as props), and body cells in `text.primary`;
- `compactColumns` (with a width threshold) and `bottomInset`;
- `onRowMenu` and `onRowDragStart`.

## Accessibility (RGAA 4.1)

Violations found by axe (`e2e/support/a11y.ts`, WCAG 2.0 / 2.1 A and AA) or by
review, that come from twake-mui itself. The e2e helper lists the axe ones in
`TWAKE_MUI_KNOWN_VIOLATIONS`: they are reported as annotations of the test,
never silently ignored.

Colour contrast is deferred to a dedicated theme (decision of 2026-10-05):
meanwhile the app follows the official Twake palette, and the helper reports
every `color-contrast` violation as a `deferred a11y rule` annotation
(`DEFERRED_RULES`). The `color-contrast` rows below and the colours darkened
before that decision (`ds/EventCard`, `ds/SecondaryText`,
`ds/FloatingActionButton`) are inputs for that theme.

| Component | Rule (axe) | Measured | Fix upstream |
|---|---|---|---|
| Theme `text.secondary` (Grey 900 at 64 %), used by `Typography color="textSecondary"`, `TableCell` body, `ListSubheader` | `color-contrast` | 3.6:1 on white, 3.5:1 on Grey 100 (4.5:1 needed) | Grey 900 at 80 % or more (5.4:1). Worked around with `ds/SecondaryText` and the list table |
| `TextField` / `InputLabel` (login form) | `color-contrast` | #868687 on white, 3.63:1 | Same theme fix |
| `Empty` `text` and `title` | `color-contrast` | #868687 on white, 3.63:1 ("No Rules Configured", "No Labels yet" in a dialog) | Same theme fix. Worked around: `ds/SecondaryText` as the text, `Typography color="textPrimary"` as the title (`features/rules/EmailRulesSettings.tsx`, `features/labels/ChooseLabelsDialog.tsx`) |
| `TextField` helper text (`FormHelperText`, identity form) | `color-contrast` | #868687 on white, 3.63:1; in error, `error.main` #ff3347, 3.61:1 | The theme fixes of `text.secondary` and `error.main` |
| `NavLink` with a `ListItemText` (list of the settings sections on phones) | `color-contrast` | The nav text colour #868687 on white, 3.63:1 | Same theme fix. Worked around: `Typography color="textPrimary"` and `ds/SecondaryText` in `features/settings/SettingsSectionList.tsx` |
| `Button variant="contained"` primary (sign in, new message) | `color-contrast` | White on #0a84ff, 3.64:1 at 15–16 px normal weight | A darker `primary.main` for filled buttons (4.5:1 with white needs about #0067d6) |
| `Button variant="text"` primary ("Clear filter" of the search) | `color-contrast` | #0a84ff on white, 3.64:1 at 13-14 px | The same darker `primary.main` (or `primary.dark` for text buttons) |
| Selected `NavLink` (current folder) | `color-contrast` | #0a84ff on `action.selected` #e5e8eb, 2.96:1 | Darker selected text (`primary.dark`) |
| `Nav` `subheader` | `aria-required-children`, `listitem` | A `ListSubheader` `li` inside a `role="tree"` list | Render the subheader outside the list. Worked around: heading outside the `Nav` |
| Focused `TextField` label (composer spike link dialog) | `color-contrast` | #2684e3 on white, 3.82:1 | Same theme fix |
| `ExtendableFab` `color="primary"` | `color-contrast` | `primary.dark` #006bd8 on `primary.light` #d2e9ff, 4.11:1 at 16 px | A darker label (#005ab7, 5.3:1). Worked around in `ds/FloatingActionButton` |
| `IconButton size="small"`, `NavItem`, `Chip` | (review, WCAG 2.5.5) | 32, 36 and 32 px high on touch screens | 44 px on coarse pointers. Worked around with `ds/TouchTargets` |
| `DialogContentText` | `color-contrast` | text.secondary #868687 on white, 3.63:1 (confirmation dialogs) | Same theme fix. Worked around: `Typography color="textPrimary"` in `features/confirm/ConfirmProvider.tsx` |
| `Button variant="outlined"` / `"text"` primary | `color-contrast` | #0a84ff on white, 3.64:1 | A darker primary for text. Worked around: `color="inherit"` (Cancel, "Select all N messages in this folder") |
| `Checkbox indeterminate` | `aria-conditional-attr` | MUI puts `aria-checked="mixed"` on an input it leaves unchecked (it does not set the `indeterminate` property) | Set `input.indeterminate` instead of `aria-checked`. Worked around: the "Select all" checkbox of the selection toolbar is never indeterminate |
| Theme `error.main` (#ff3347) as text | `color-contrast` | 3.61:1 on white ("Delete folder", "Delete permanently" in menus) | A darker `error.main` for text. Worked around: `error.dark` for the destructive menu items |
| `Drawer` | (review) | The paper has no role nor name: a screen reader does not know a panel opened | `role="dialog"`, `aria-modal` and a label on the temporary variant. Worked around in `ds/NavigationDrawer` |
| Theme (focus indicator) | (review, WCAG 2.4.7) | twake-mui draws no focus style of its own, beyond the MUI tints: each component drew a 2 px outline, also shown on a click in a text field (`:focus-visible`), and nothing lets a user ask for a stronger one | A focus indicator in the theme (`discreet` / `enhanced`): one `:focus-visible` rule in `MuiCssBaseline` and `.Mui-focusVisible` in `MuiButtonBase`, set by `--focus-ring-*` custom properties. Worked around: `ds/FocusIndicator` (theme options), the choice in Settings > Preferences > Accessibility |
| `VirtualizedTable` | (review) | No table name, header neither hideable nor hidden for screen readers only, rows not focusable, no row count | See "VirtualizedTable" above |

## Icons and twake-css

`@linagora/twake-icons` has no text formatting icon: bold, italic,
underline, strike, quote, text colour, alignment (left, centre, right,
justify), text size, clear formatting, undo and redo. The editor draws them
from Material Icons paths (Apache-2.0, via `@mui/icons-material` MIT) with
`SvgIcon` in `common/src/ds/RichTextEditor/editorIcons.tsx`, and takes from
twake-icons the ones it has: `List` (bulleted list), `Number` (numbered
list), `Link`, `Image`, `Plus` and `Dash` (larger, smaller image), `Trash`
(remove image). twake-icons should get the missing ones, and the "open in
full" and "close full screen" icons of `ds/DockedWindow` (Material paths
too); its minimize and restore buttons use `Dash` and `Up`.

Before the composer, every icon needed existed in `@linagora/twake-icons` (`Mail`,
`MailText`, `TwakeText`, `Pen`, `Apps`, `Logout`, `Email`, `EmailOpen`,
`Warning`, `File`, `Send`, `Paperplane`, `Trash`, `Note`, `Archive`, `Folder`,
`Bottom`, `Right`, `Left`, `Star`, `StarOutline`, `CircleFilled`,
`Attachment`, `Download`). There is no dedicated inbox, spam nor template
icon: `Email`, `Warning` and `Note` stand in.

The answers of an email have one icon, `Reply`: there is no "reply all" nor
"forward" icon. The buttons under an email are labelled (`Reply` icon on the
replies, none on Forward); the menus use `Reply` for the three replies and
`Share` for Forward. twake-icons should get `ReplyAll` and `Forward`.

There is no "important" icon (tmail-flutter `ic_mark_as_important.svg`):
the list, the reader and the conversation use `WarningCircle`, always with
the word "Important" for screen readers (`features/email/ImportantMark`).
twake-icons should get `Important`, and a read receipt icon
(`ic_read_receipt.svg`), absent too: the "More" menu of the composer shows
a `Check` beside the options turned on (`menuitemcheckbox`).

twake-css:

- `u-fw-bold` has no `!important`, unlike most utilities: it loses against
  the font weight of a `Typography`. Bold text goes in an inner `<span>`.
- There is no `min-width: 0` class (`u-miw-0`) to let a flex item shrink
  below its content: `u-ov-hidden` (or `u-ellipsis`) does it as a side
  effect.

## Responsive

twake-mui's responsive behaviour is the one of Cozy apps: a few destinations
in a bottom tab bar and a top bar fixed over the page below `lg` (1024 px).
A mail client follows tmail-flutter instead (`ResponsiveUtils`): folders in a
drawer below 1200 px, list and email side by side from 900 to 1199 px, one
view at a time below 900 px. What Twake Mail does, and what twake-ui would
need:

1. **Breakpoints.** The theme keys are sm 544, md 769, lg 1024, xl 1201, and
   `useBreakpoints` (exported) reads them. Twake Calendar's
   `useScreenSizeDetection` uses lg as the desktop limit; tmail-flutter uses
   600 / 900 / 1200. `ds/useScreenSize` reads explicit media queries on the
   tmail-flutter values, and treats a browser without `matchMedia` (jsdom) as
   a desktop. Upstream: screen size helpers that take the app's limits.
2. **`Layout` and `Main` reserve room for chrome Twake Mail does not have.**
   Below `lg`, `Main` with `withTopBar` draws a 48 px block for a top bar
   fixed over the layout, and `Layout`/`Main` subtract `--sidebarHeight`
   (52 px, the bottom bar). Twake Mail's top bar is in the flow and its
   sidebar becomes a drawer: `layout/AppLayout.tsx` passes
   `withTopBar={false}` and, below 1200 px, `monoColumn` (no two-pane
   background, no `Content` margin). Upstream: a top bar component that owns
   that reservation, and a `Layout` that knows about a drawer sidebar.
3. **`Sidebar` becomes a bottom tab bar below `lg`** (`position: fixed`,
   52 px). Twake Mail renders twake-mui's `Sidebar` from 1200 px only and a
   modal drawer below (`ds/ResponsiveSidebar`, `ds/NavigationDrawer`).
   Upstream: `<Sidebar variant="drawer" open onClose>`.
4. **`Nav`, `NavItem`, `NavLink`, `NavIcon`, `NavText` switch to bottom tabs
   below `lg` whatever their container** (centred 11-12 px labels, items
   side by side). Inside the drawer they must stay a vertical list:
   `ds/NavigationDrawer` wraps its content in a nested `ThemeProvider` whose
   `breakpoints.down/between/only/not` never match and `up` always does
   (MUI's function form, which keeps the CSS variables of the outer theme).
   Upstream: a `variant` (or a context set by `Sidebar`) choosing the
   vertical style, instead of the viewport.
5. **No top bar** (see "Components"): `ds/AppTopBar` has the desktop, tablet
   and phone arrangements of Twake Calendar's three `Menubar`s in one
   component, with the search folded behind a button on phones (focus moved
   into it, Escape and back give it back to the button).
6. **Touch targets.** `IconButton size="small"` is 32 px, `NavItem` 36 px,
   `Chip` 32 px. `ds/TouchTargets` raises them to 44 px on touch screens and
   phones; the drawer rows are 44 px high. Upstream: theme overrides under
   `(pointer: coarse)`.
7. **`ExtendableFab`** has no placement, listens to the scroll of `window`
   (an app whose content scrolls in a container never sees it shrink) and
   fails AA contrast in `primary` (see "Accessibility").
8. **`VirtualizedTable` has no narrow mode nor end inset** (items 13 and 14
   of "VirtualizedTable").
9. **No master-detail layout**: `ds/ListDetailLayout`.

Not a twake-mui gap, but for the record: the email body iframe keeps the
sender's layout; a newsletter wider than the screen scrolls horizontally
inside its frame (content that needs two dimensions, an exception of RGAA
10.11), the page itself does not.

**Proposed twake-ui PRs**, in order of value:

- "feat(Sidebar): drawer variant below a breakpoint", with `Nav*` keeping
  their vertical style inside it (items 3 and 4);
- "feat: TopBar component" with title, centre and actions slots, a menu
  button and a folding search, owning the room `Main` reserves (items 2 and
  5);
- "feat(theme): 44 px touch targets on coarse pointers" (item 6) and the
  `ExtendableFab` contrast fix (item 7);
- the `VirtualizedTable` narrow mode, with the list mode PR above (item 8).

## List rows and states (design batch B)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `Row` hover actions | Actions replacing a cell (the date) on row hover and focus-within, beside it without hover | Email list rows | `ds/RowHoverActions` (`replaces`) | `VirtualizedTable` slot for hover actions |
| One-line row content | Title never cut before 70 % of the line, preview cut first, chips before the title | Email list rows | `ds/RowLine` | `VirtualizedTable` row layout |
| `Banner` | Persistent inline banner (offline) with a dismiss button, pinned at the bottom of its parent | "No internet connection" | `ds/OfflineBanner`, not mounted yet: no offline detection in the app | `Banner` / `PointerAlert` with a dismiss action |
| `ListSkeleton` | One-line rows with several segments (checkbox, avatar, sender, subject, preview, date) as in the Figma loading state | Loading of the email list | none: `ListSkeleton` `count` + `divider` is used | `ListSkeleton` `variant="table"` with segments |
| `Avatar` | Decorative 20 px initials in the row (`aria-hidden`) | Sender of a list row | twake-mui `Avatar`, `size={20}` | none |
| `VirtualizedTable` rows | Selected row at primary 8 % (mock, `#ebf5ff`) instead of `selectedOpacity` 18 %; body rows of 49 px instead of about 44; cells in `text.secondary`; a column header the mock does not have | Email list | `ds/VirtualizedListTable` (`ROW_SX`, selected colour only) | Theme `MuiTableRow` selected opacity; `VirtualizedTable` density |
| `Alert` / `Snackbar` | Banner that stays (no auto hide) pinned to a positioned parent | Offline banner | `ds/OfflineBanner` (composes `Alert`) | `Snackbar` `persistent` / `anchor` parent option |
| `Checkbox`, `Avatar` | No 14 px box nor 20 px named size; the empty box is `text.secondary`, the mock uses `border.main` | List rows | twake-mui `Checkbox size="small"`, `Avatar size={20}` as is | Size props, empty colour |
| Theme palette | `divider`, `action.hover`, `action.selected` are tinted `#424244`, Figma uses `#1d192b` at the same opacity | everywhere | not overridden (no global theme override) | `makePalette` |
| `SearchBar` | The clear button is English only and cannot be named, so `disabledClear` plus an `IconButton` with a translated label; no accessible name prop on the input (set through `inputProps`) | Folder search of the sidebar | `features/mailbox/MailboxSearch` composes twake-mui `SearchBar` | Translated, named clear button; `inputProps` label |
| `NavItem` | A second line under the name (path of a search result) | Folder search results | `ds/NavTreeItem` (`secondary` prop) | Optional `secondary` on `NavItem` |

## Composer design (batch composer)

The composer follows the Figma "Composer" frames (window 790 px, flat 37 px
field lines, boxed formatting toolbar, footer). No global theme override: what
twake-mui lacks lives in `@/ds/`.

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| Field line | A flat line: label on the left, value inline, full width divider, 37 px; no outlined or filled look, no floating label | From, Subject, and the line of `RecipientField` (To, Cc, Bcc, Reply to) | `ds/FieldLine` (`FIELD_LINE_SX` shared with `ds/RecipientField`) | `TextField variant="line"` (or a `FormRow`) |
| `Button` | Underlined text button: Inter Medium 14 / 18.4, secondary colour, padding 2 4, pill radius (twake-mui text buttons are 16 px, primary, not underlined) | "From", "Cc", "Bcc", "Reply to" at the end of the To line | `ds/FieldTextButton` | `Button variant="link"` and a 14 px `size="medium"` |
| `Button` | "button medium": 14 / 20 with letter spacing 0.1, fixed width, 18 px icon, pill radius (twake-mui forces 16 px) | Send | `ds/PillButton` | Button typography in the theme (`button` is 16 px, Figma 14) |
| `IconButton` | Plain `size="medium"` is the 40 px of the design (the default `large` is 48) | Title bar and footer of the composer | twake-mui `IconButton size="medium"` as is | none |
| Toolbar | Bordered boxes (1 px divider, radius 4, 32 px high) for the controls, one box for a group (bold, italic, underline, strikethrough: 24 px buttons, 114 px wide), a value shown in the box (size), a 10 x 2 colour bar under the "A" | Formatting toolbar | `ds/RichTextEditor/RichTextToolbar` (APG toolbar kept: roving tabindex, `aria-pressed`, Alt+F10) | A `Toolbar` with `ToolbarGroup` and `ToolbarSelect` in twake-ui |
| Window | 790 x 634, radius 8 all around, Material 3 elevation 3 (`0 1px 3px rgba(0,0,0,.3), 0 4px 8px 3px rgba(0,0,0,.15)`), title bar 44 px on `background.default`, title `h5`, minimized bar 400 px, 24 px from the edges | Composer | `ds/DockedWindow`, `ds/DockedWindow/WindowDock` | `Paper elevation` M3 levels (twake-mui has MUI shadows only) |
| `@linagora/twake-icons` | No "open in full" (still the Material path in `ds/DockedWindow`), no "format size" (Material path `fontSize` of `editorIcons`, used for the footer toggle), no highlighter | Title bar, footer, toolbar | `ds/DockedWindow`, `ds/RichTextEditor/editorIcons` | Add `OpenInFull`, `FormatSize`, `Highlighter` |
| Icons substituted | Send `Paperplane`, attach `Attachment`, image `Image`, link `Link`, Drive `ToTheCloud` (cloud upload), AI `AssistantColor` (multicolour star), delete `Trash`, templates/save `FileOutline`, minimize `Dash`, close `Cross` | Footer and title bar | `features/composer`, `ds/DockedWindow` | Match the Figma icon set |
| `LinearProgress` | The sidebar storage gauge: 3 px high, square ends, track on `action.selected`, bar in the primary (warning, error) colour; twake-mui's bar is thicker and rounded | Sidebar footer | `ds/StorageGauge` | `LinearProgress size="thin"` (square) |
| Nav footer | The foot of the sidebar: 24 px padding sides and bottom, the storage block, the version centred in an `overline` coloured Steel gray 400 (#818C99, 3.4:1 on white: colour contrast is deferred to the dedicated theme) | Sidebar footer | `ds/SidebarFooter` | `Nav` `footer` slot, with a `version` line and a Steel gray text token |

**Not in the composer, because the editor has no such feature** (shown as the
design does it where something exists, never invented): the text style "Aa"
(headings and paragraph styles are off in `StarterKit`), the font family
"Sans Serif" (`TextStyleKit` is configured without `fontFamily`), the
highlight colour (no `Highlight` extension), the second alignment box (the
design repeats the alignment icon; here the lists and quote are grouped). The
toolbar keeps undo, redo and clear formatting, which the design omits, so no
behaviour is lost. The toolbar is 48 px high (32 px boxes with 8 px of padding
above and below), not the 40 px of the spec, which cannot hold a 32 px box
with that padding.

## RichTextEditor `selectionAction`

- Component: `RichTextEditor` (`common/src/ds/RichTextEditor/SelectionAction.tsx`).
- Variant: a button following the end of the selected text (the sparkle of tmail-flutter's `AiSelectionOverlay`), in the tab order after the text.
- Usage: the AI assistant of the composer opens its menu on it.
- twake-ui change: upstream with RichTextEditor, which twake-mui lacks.
## Mail list and toolbar (batch P4)

The list follows the Figma "Email message list" (rows 44 px, toolbar with a half
opacity divider, 16 px on each side). No global theme override: what twake-mui
lacks lives in `@/ds/`.

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `IconButton` | A 32 px round button holding a 20 px icon, with its tooltip as accessible name, and a yellow tone for a filled star (`warning.light`) | Row actions, refresh | `ds/IconAction` | `IconButton size="small"` at 32 px with a `label`, 20 px icons |
| `Button` | Text button "button medium": Inter Medium 14 / 20, letter spacing 0.1, 32 px high, padding 6 px, gap 8, 16 px icon, chevron when it opens a menu, text colour | Select all, Filter | `ds/ToolbarButton` | `Button variant="text" size="medium"` (twake-mui forces 16 px) |
| `@linagora/twake-icons` | No `filter_list` (three decreasing lines) nor an empty checkbox; the nearest (`Filter`, sliders; `Checkbox`, checked) are not the design | Filter and Select all of the toolbar | `ds/ListIcons` (Material Icons paths, Apache-2.0) | Add `FilterList` and `CheckboxBlank` |
| `@linagora/twake-icons` | `refresh-restore` is `Restore`; open in new window is `Openwith`; the quick reply arrow is `Answer`; mark unread is `EmailNotification`; move is `FolderMoveto`; recovery of deleted messages is `RestoreStraight`: the nearest of the set, drawn differently from Material | Rows and toolbar | `features/thread` | Match the Figma icon set |
| Toolbar | 16 px above and below, 16 px between controls, divider below at 50 % opacity | List toolbar | `ds/ListToolbar` | Part of a `Toolbar` with a divider opacity |
| Row layout | Padding 6 8 and 8 px between cells (`rowLayout`), a sender block of 198 px after a 20 px marker frame, 12 px date (600 / 18.4 unread, 400 / 12 read), subject at most 268 px and Semi Bold (600) when unread (twake-css has `u-fw-bold` only) | Mail rows | `ds/VirtualizedListTable` (`rowLayout`), `ds/RowSender`, `ds/RowDate`, `ds/RowLine` (`isStrong`), `ds/StatusDot` (`framed`) | `VirtualizedTable` row padding / gap options; theme semi-bold utility |
| Tag | `size="small"`: 11 / 14 text, 4 px padding | Labels in a row | `ds/ColorTag` | `Chip size="small"` with a free colour |
| Column | 16 px on each side of the toolbar and the list | List pane | `ds/ListPane` | none (layout) |

Differences kept from the Figma list: the text of a label tag is black or white
by contrast (the design has white only, unreadable on a light label); the row
has no 8 px radius (a table row cannot be rounded and it is invisible without a
background, the hover and selection have none in the design); the open-in-new
button opens the email route in a tab, which signs in again (tokens live in
memory, silent with the SSO).


## Attachment preview (batch P2)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| File viewer | Full-screen dark dialog with a top bar (close, truncated title, download) and a focusable scroll region | Preview of an attachment (image, text, PDF, HTML, .eml) | `ds/FilePreviewDialog` (with `FilePreviewSurface`) | A `Dialog` variant `fileViewer`, shared by Mail, Drive and Chat |
## Collapsible sidebar section header

`ds/NavSectionHeader` (`toggle` prop) makes the title of the "Folders",
"Team-mailboxes" and "Labels" sections a button, inside the level 2 heading,
with `aria-expanded`, `aria-controls` and the 16 px chevron 8 px after the
text (Figma). twake-mui's `NavDesktopDropdown` is a collapsible section header
but pushes its chevron to the far end, shows it only past `limit` (5)
children, has no slot for actions (search, +) and renders nothing below `lg`:
twake-ui would need a `Nav` `subheader` with a toggle next to the title, an
`actions` slot, and a collapse independent of `limit`.

## Composer formatting toolbar and emoji picker (batch E1)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| Toolbar menu button | Bordered 32 px box showing its value ("Aa", size, font), with a menu (`menuitemradio`) | Text style, size, font, alignment, lists and indentation of the composer | `ds/RichTextEditor/RichTextToolbar` | A `Toolbar` pattern with menu buttons, with the APG roving tabindex |
| Colour popover | Swatches (two rows of 10), reset, free colour (native input), current colour as a 10 x 2 bar under the button | Text colour and highlight | `ds/RichTextEditor/ColorMenu` (composes `ds/ColorSwatchPicker`) | A `ColorPicker` popover |
| Emoji picker | Popover with category tabs, search field, grid, recent; data given by the caller | Emoji button of the composer footer (not on phones: the native keyboard has one) | `ds/EmojiPicker` | An `EmojiPicker` fed by an optional lazy dataset |
| Icon-only primary button | `PillButton` as a 44 px circle, the label stays the accessible name | Send on phones, where the footer has no room for the label | `ds/PillButton` (`isIconOnly`) | A `size="icon"` of the contained `Button` |
| Icons | `twake-icons` has no highlighter, indent, outdent, emoji nor text style icon; Material Icons paths are used (as for bold, italic…) | Toolbar and footer | `ds/RichTextEditor/editorIcons` | Add them to `twake-icons` |
| Category pictograms | The tabs of the emoji picker are emojis (greyed unless selected), not the outlined icons of the design | Emoji picker tabs | `ds/EmojiPicker` | Outlined category icons in `twake-icons` |

Differences kept from the design and from tmail-flutter:

- The size shown when nothing is chosen is 14 (the editor's text size in the design), not 16 (the number of the mock and
  tmail-flutter's default); the sizes are tmail-flutter's list.
- tmail-flutter opens a free colour picker dialog; Twake Mail offers the Twake palette and a free colour input in a popover.
- tmail-flutter has no emoji picker (only the NotoEmoji fallback font): the categories are those of the Figma design.


## Message alerts (X-TWP-Message warnings, issue #142)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `Alert` / `AlertTitle` | Levels (info, warn, error), icon, title and `onClose` exist. Missing: a message that is part of the page is not an event, yet `Alert` is `role="alert"` (a live region); the level is carried by colour and an `aria-hidden` icon only; `action` replaces the close button, so an action and a labelled dismiss cannot sit together | Banner between the header and the body of an email, one per backend warning | `ds/MessageAlert` (composes `Alert`, `AlertTitle`, `Button`, `IconButton`): `role="group"` named by its title, level in words (visually hidden), action pill plus dismiss | `Alert` `role` and `levelLabel` props; `action` next to `onClose` |
| `Alert` | One-line warning above a section (the attachments), without title nor action; static, level in words | Inline warning above the attachments. Built, not mounted: the header contract does not say when attachments are blocked (issue #142, open questions) | `ds/InlineAlert` | Same as above |
| `Avatar` | A state instead of initials or a picture: red round badge with a warning sign, named for assistive technology | Replaces the sender avatar of a message with an error-level warning | `ds/WarningAvatarBadge` (composes `Avatar`) | `Avatar` `color="error"` with an `icon` and a `label` |
| Upload list: chip, fold and popup | Attached files as 280 px chips (type icon or thumbnail, name cut in the middle, size, check, 2 px progress bar, retry, 20 px remove), a "Show less / more" link, and a popup listing the uploads when there are more than nine | `ul` of `li` chips (hex tokens of the Figma file: border #e5ecf3, bar #e3f1ff / #007aff, size #8c9caf, link #1990ff), a named `progressbar` on the 2 px track, buttons 20 px that keep 44 px targets on touch screens with a negative margin, a link `Button` (`aria-expanded`); `UploadPopup` is a non modal `region` fixed at the bottom start | `ds/UploadList` (`UploadList`, `UploadChip`, `UploadPopup`), filled by `features/composer/ComposerAttachmentsList.tsx` | A file chip with progress, a middle ellipsis `Typography`, and a non modal upload panel (Drive uploads need the same) |
| Upload list: chip, fold and popup | Attached files as 280 px chips (type icon or thumbnail, name cut in the middle, size, check, 2 px progress bar, retry, 20 px remove), a "Show less / more" link, and a popup listing the uploads when there are more than nine | `ul` of `li` chips (hex tokens of the Figma file: border #e5ecf3, bar #e3f1ff / #007aff, size #8c9caf, link #1990ff, and #e9eef3 for the grey disc of the remove button, a bit darker than the Figma #f3f6f9 to be seen on white), a named `progressbar` on the 2 px track, buttons 20 px that keep 44 px targets on touch screens with a negative margin, a link `Button` (`aria-expanded`); `UploadPopup` is a non modal `region` fixed at the bottom start | `ds/UploadList` (`UploadList`, `UploadChip`, `UploadPopup`), filled by `features/composer/ComposerAttachmentsList.tsx` | A file chip with progress, a middle ellipsis `Typography`, and a non modal upload panel (Drive uploads need the same) |
| Recipient chip with avatar, folded recipients | Chips 32 px high with a round letter avatar, and the fields folded into chips with a "+N" counter | The avatar letter is drawn by `::before` so it is not part of the text nor of the name of the chip; `RecipientSummary` measures a hidden copy of the chips (`ResizeObserver`) to know how many fit, one `ButtonBase` named after every recipient | `ds/RecipientField` (`RecipientAvatar`, `RecipientSummary`) | A chip `avatar` that is not text, and a "+N" overflow chip list |
| Foldable inline block | The signature as a card under a "Signature" pill | `HtmlBlock` option `toggleLabel`: an outlined pill `Button` (`aria-expanded`) above a bordered card, folding the view only | `ds/RichTextEditor/HtmlBlockView.tsx` | A disclosure pill (outlined, rounded 100) |
| `Dialog` | Actions: a `Button` without variant in `DialogActions` renders as a filled primary pill (same look as the confirmation), so Cancel next to a contained action has no hierarchy; the app uses `variant="outlined" color="inherit"` for Cancel everywhere (`ConfirmProvider`, scribe, link dialog) | Cancel of the link dialog, Cancel / Replace of the scribe result | Done at the call sites (no wrapper) | `DialogActions` default: secondary actions outlined, `inherit` colour |

## Reading view and conversation (batch D1)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `Typography` | Sizes with no variant: Bold 17/24 (sender name), Medium 15/20 (sender in a conversation), Medium 14/18.4 (date, recipients), Regular 14/20 (time and preview of a compact message); the secondary ones in an AA grey | Header of an open email and rows of a conversation | `ds/MessageText` (composes `Typography`) | Typography variants (`subtitle`, `bodyCompact`…) or a `MessageHeader` set of them |
| `Button` | Text button underlined, Medium 14/18.4, `padding 4 8`, 100 px radius, secondary colour | "Unsubscribe" after the sender | `ds/InlineTextButton` (composes `ButtonBase`) | `Button variant="text" size="small"` with an `underline` option |
| `Button` | "Mail action bar": a divider and buttons sharing the width (`flex 1`, min-height 48, 100 px radius, 20 px icon, Medium 14/20), kept at the bottom of the scrolling area | Reply all / Reply / Forward under an email or a conversation | `ds/ActionBar` (`ActionBar`, `ActionBarButton`) | An `ActionBar` component |
| Icons | `@linagora/twake-icons` has `Reply` only: no "Reply all" nor "Forward" (the mock draws them) | Buttons of the action bar | `ds/ReplyIcons`: two `Reply` arrows overlapped, and one turned around (`scaleX(-1)`) | `ReplyAll` and `Forward` icons (and a chevron: `Dropdown` stands in for the mock's) |
| `Avatar` | 40 px and 32 px sizes are numbers (`size={40}`), fine; the mock's initials are Semi Bold 20/26.7 on a gradient | Header (40) and conversation rows (32) | `Avatar size={40}` / `size={32}` as is | Named sizes for 32 and 40 |
| Layout | A flex row with a gap that wraps, a start margin in px, a column at least as tall as its scroller (`flex-shrink: 0`, so that its sticky bars hold) | Subject and labels, sender line, recipients, indented meta lines of a message, bars of an open email | `ds/InlineGroup`, `ds/Indent`, `ds/ReadingPane` | `Stack useFlexGap` is the equivalent of the first; none for the others |
| `MessageThreadItem` | Actions beside the toggle (a button cannot hold buttons): reply, archive, star, delete, "More" on every row, collapsed or not | Compact conversation of the mock | `ds/MessageThread/MessageThreadItem` (`actions` slot) | Same slot on a twake-ui message list |
| `IconButton` | Dense actions of a sidebar (section titles, refresh of the footer): 24 px box (44 px on touch screens) around a 14 px glyph; `xsmall` is 26 px with a 20 px icon | Search, add and show-hidden of "Folders", add of "Labels", refresh of the storage | `ds/NavSectionAction` | A smaller `IconButton` size for dense toolbars |
| `Button` | Text button of a row, 11/16 in the secondary text colour ("Clean" on the Spam row); `size="small"` is 13 px | Hover action of a sidebar row, with the full action as the accessible description | `ds/RowTextAction` | A `size` for row buttons |
| `twake-icons` `Label` | The glyph is an outline; the design draws the labels of the sidebar as solid tags, in the colour of the label | `LabelIcon` | `features/labels/LabelIcon` (same path, filled) | A filled `Label` next to `LabelOutlined` |
| `twake-icons` Inbox, Archives, Draft, Outbox, Bin, Spam, Templates, Action required | The sidebar of the design uses other glyphs than the ones of `twake-icons` (tray for Inbox, box with arrow for Archives, clock for Action required, mail with a dot for Spam, clipboard for Templates, vertical dots) | Rows of the system folders | not done: the current icons stay | The sidebar glyphs of Teammail 1.1 in `twake-icons` |
| Search filter chip (flat, icon, applied) | Filters under the search and above the results: #f3f6f9 chips, no border, 32 px, 16 px icon, chevron for menus; applied = pale primary background, primary text and a cross | `Chip variant="filled"` with an `sx` for the background, radius and colours; the cross is a decorative `endIcon` (the whole chip is the one control, `aria-pressed`) | `ds/FilterChip`, filled by `features/search/QuickSearchFilters.tsx` and `SearchFiltersBar.tsx` | A `Chip` variant "soft" (neutral and primary), with `onDelete` that does not add a second control |
| Search open panel | The search turns into a white card with a soft shadow holding the field, a divider, the quick filters and the suggestions (Recent with a clock and a date, contacts with an avatar, messages with a date and a clip) | `ds/SearchCombobox` keeps `SearchBar elevation={0} disabledFocus`: the popup starts behind the field (negative `Popper` offset, same width through a modifier) and its `Paper` is the card, the field stays above it with a transparent background; groups can hide their heading (`isLabelHidden`) and options take an `end` slot (`aria-hidden`) | `ds/SearchCombobox` | `SearchBar` open variant (no focus border) and a suggestions panel slot; `SearchRow` is 700 px wide (the earlier row said 820 px at most, a misreading of the 2000 px mock) |
| Anchored dialog | The advanced search opens as a white card over the search field, same corner and width, no dimmed backdrop | `Popover` (modal, focus trap, Escape, focus return) with `role="dialog"`, a hidden `h2` naming it, a fade and 560 px at least; a full screen `Dialog` on phones | `ds/AnchoredDialog`, filled by `features/search/AdvancedSearchDialog.tsx` | A `Dialog` placement `anchorEl`, or a named `Popover` |
| Form row with the label on the left | Advanced search rows: label column, icon, flat control with a line under it | `Typography component="label"` + icon + `TextField variant="standard"` (native `select`) in a grid that stacks on phones; the icons are chosen here (the Figma frame repeats one placeholder icon on every row) | `ds/FormRow` | A `TextField` layout "label start" with an icon slot |
| Search results header | The design has no "Search results" title row: the filters sit right under the search | A visually hidden `h1` keeps the title and the focus target; the back button stays at the start of the filters row (no equivalent in the design); the list toolbar keeps refresh and select all and has no "Filter" while a search runs (the design shows it) | `features/search/SearchResults.tsx` | none |
| One line row of chips that scrolls | The search filters stay on one line (Figma), at every width | `Box role="toolbar"` with `flex nowrap`, `overflow-x: auto`, `overflow-y: hidden` (no second bar), `scrollbar-width: thin`, a little padding so the focus ring is not cut | `ds/ScrollRow`, filled by `features/search/SearchFiltersBar.tsx`; the order of the results is a `ToolbarButton` with a menu at the end of the list toolbar (`features/search/SearchSortButton.tsx`) | A `Chip` list / toolbar container with horizontal scrolling |

## Composer pixel pass (batch E4)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `IconButton` | A 40 px round button around a 24 px icon frame whatever the icon (twake-mui sizes it from the icon and its 12 px padding: 40, 44 or 48 px); `twake-icons` glyphs are drawn at 20 px to match the weight of the Material icons of the design | Title bar (minimize, expand, close) and footer (formatting, attach, image, link, emoji, Drive, assistant, delete, More) of the composer | `ds/ActionIconButton` (the 40 px counterpart of `IconAction`, which keeps its closed 32 px API; the tooltip and accessible name come from `label`) | `IconButton size="large"` with a `label`, and `twake-icons` glyphs drawn on the Material grid |

## Composer on phones and tablets (batch E5)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| Top bar of a full-screen form | A 56 px bar: the way out at the start, the actions (44 px targets) at the end, on the page background (tmail-flutter `MobileAppBarComposerWidget`, Figma phone composer) | The composer on a phone: close, Aa, attach, image, Drive, Send, More | `ds/TopActionBar` | An `AppBar`-like `variant="form"` (start slot, end actions) |
| `Button` | A round icon-only primary button: a 32 px disc inside a 44 px touch target (a transparent border and `background-clip: padding-box`) | Send on a phone | `ds/PillButton` (`isIconOnly`) | `IconButton color="primary" variant="contained"` with a target larger than its disc |
| `IconButton` | A pressed toggle (`aria-pressed="true"`) shown light blue with a dark blue icon | Aa when the formatting toolbar is shown | `ds/ActionIconButton` | `IconButton` `selected` style bound to `aria-pressed` |
| Window title bar | The title centred between an empty start and the three window buttons (tablet frames); the title bar left out on a phone (the content has its own bar), the title staying the accessible name | A tablet window (772 x 710), a phone composer | `ds/DockedWindow` (`isTitleCentered`, `isTitleBarHidden`, `isTall`), `ds/DockedWindow/fitWindows` (`dockedWindowWidth`) | `Window` / `Dialog` title alignment and a headerless variant |
| Visual viewport | A full-screen window that stays above the virtual keyboard where the layout viewport does not shrink (Safari; Chrome follows `interactive-widget=resizes-content`, set in `public/index.html`) | The phone composer | `ds/useVisualViewport`, used by `ds/DockedWindow` | A `useVisualViewport` hook |
| Recipient field | The label beside the chips (not in their wrapping row) and an input of at least 56 px that stays on the row of the last chip while room is left | A "To" with long addresses, at every width | `ds/RecipientField` | The same in the upstream chips field |
| `Dialog` loading state | The logo of the framed application in the middle and its name at the bottom instead of a progress indicator (Figma Twake Drive loading) | The Drive picker while it loads | `ds/FramedDialog` (`loadingBrand`), filled by `features/composer/DriveAttachButton.tsx` with the `Drive` and `DriveText` icons of `twake-icons` | A `loadingBrand` slot on a framed dialog |

## Insert template picker (batch E6, issue #54)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `Dialog` / `Drawer` | A picker modal: a centred dialog on desktops and tablets, a sheet rising from the bottom edge on phones (rounded top, 85 % of the screen at most, safe area padding), titled, with a close button in both; `Drawer` sits under a full-screen window (the composer on a phone) unless it takes the modal z-index | The "Insert template" picker | `ds/PickerSheet` | A `Dialog` `variant="sheet"` below the phone breakpoint, with a title slot |
| Filter field and list | The always shown filtered list says how many options match: a live region (`role="status"`) always in the page, filled when the filter changes (no second announcement from the empty message) | The result count of the template picker | `ds/FilterableListbox` (`resultsLabel`) | A result count slot on a filtered listbox |
## Contact card (batch D5)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `Dialog` + `Drawer` | The card of a contact (avatar, name, address with a copy button, full width action buttons): a centred 383 px dialog on tablets and desktops, a bottom sheet with 16 px top corners on phones, one component for both (tmail-flutter `EmailAddressDialogBuilder` and `EmailAddressBottomSheetBuilder`); named by the name of the person, focus trapped, Escape and close button, focus given back | The address of the sender and of the recipients of an email, in the reading view | `ds/ContactCard` (filled by `features/email/EmailAddressCard.tsx`: avatar, actions and their links) | A `ContactCard`, or a `Dialog` variant that turns into a bottom sheet on phones |

## Tree view keyboard (batch D6, issue #102)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `Nav` + `NavItem` (`role="tree"` / `role="treeitem"`) | The WAI-ARIA APG tree view keyboard pattern over a flat list of rows with `aria-level`: one tab stop (roving `tabindex`, on the row last focused, else the selected one, else the first; the links and buttons of the other rows out of the tab sequence), Down / Up / Home / End, Right (expand, or first child) and Left (collapse, or parent), Enter (follow the link of the row), typeahead, and the focus handed to the neighbouring row when the focused one goes away. The row, not its link, holds the focus (ring on the row) and is named by its link | The folder trees of the sidebar (system folders, folders of the user, team mailboxes, search results of folders) | `ds/NavTree` (keys in `ds/NavTree/navTreeKeys.ts`, the DOM kept in step by a `MutationObserver`), `ds/NavTreeItem` (`data-nav-toggle` on the arrow, `aria-labelledby`, focus ring); used by `features/mailbox/MailboxTree.tsx` and `MailboxSearch.tsx` | A tree keyboard behaviour on `Nav` with `role="tree"` (keys, roving `tabindex`, focus kept on removal), and a focus ring on a focused `NavItem` |

## Composer RGAA fixes (batch E8, issues #159 to #163)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `TextField` in a `Popper` toolbar | The alternative text of the selected image: a labelled field, with a hidden help (`aria-describedby`), written by Enter, cancelled by Escape, and a place in the tab path of the image toolbar (Tab from the buttons, Shift+Tab back, Tab out to the text) | The image of the body of a message (RGAA 1.1) | `ds/RichTextEditor/ImageToolbar` (`AltTextField`) | An image toolbar with an alternative text field, in the rich text editor |
| `Autocomplete` with chips | A field of chips capped at 3 rows with its own scroll (the focused chip and the input kept in view), announcing in its live region the chips added (one by name, several by count) as well as the one removed, and Escape giving back the chip being edited before it reaches the page | To, Cc and Bcc of the composer with hundreds of recipients (RGAA 10.11, 7.5, 7.3) | `ds/RecipientField` (`MAX_CHIP_ROWS`, `labels.added`, `onCancelEdit`) | The same on a chips `Autocomplete` (`maxRows`, an `added` announcement, a cancel of the edition) |
| `Typography` | `component="span"` on the title of the minimized window: a heading inside a button is lost to screen readers | The title of a window folded to a button | `ds/DockedWindow` | None, the variant keeps the look of a `h5` |
| Colour swatches | A custom colour next to the swatches: a last radio "Custom color" (named with its value, a rainbow until it holds one), a hexadecimal text field (`#RRGGBB`, `#RGB` or no `#` read, written in capitals, `aria-invalid` and a `role="alert"` message, help read through `aria-describedby`) as the accessible path, and the native `input type="color"` (the system picker, handy on a phone), a polite live region saying the value picked | The colour of a label out of the palette | `ds/ColorSwatchPicker` (`custom`, `hexColor.ts`), used by `features/labels/LabelDialog.tsx` | A `ColorPicker` with a custom colour and a hexadecimal field |
| `ListItemSkeleton` / `ListSkeleton` | A table-row variant (the 44 px row and the narrow multi-line row of the email list, with a bar per column), a `reducedMotion` that stops the pulse, and `aria-hidden` on the shapes with `aria-busy` on the container: the story is a 56 px list item, its shapes are read as empty elements and it pulses whatever `prefers-reduced-motion` | Loading of the email list and of the search results (RGAA 13.8, 4.13) | `ds/ListTableSkeleton` (+ `ButtonSkeleton`), `ds/SkeletonRegion` (busy, hidden, no pulse under `prefers-reduced-motion`), `ds/NavTreeSkeleton` (the 36 px rows of the sidebar), `ds/ReadingSkeleton` (subject, header and body of an open email) | A `variant="table"` of `ListItemSkeleton` taking the columns, and the three accessibility behaviours by default; the skeleton colour of the theme is #eaeaea, the mock's is #e3e3e3 (not changed) |
| `Alert` (offline) | Not a live region of its own (`role="none"`) when a page-level live region says the state, and a fixed position with an offset above a floating button | The offline banner | `ds/OfflineBanner` (`bottomOffset`, no role), mounted by `features/network/OfflineNotice.tsx` | `Snackbar` `persistent` with an `anchor` offset, and a polite `role` for a state that is not an alert |
| Skip link | A link to the main content, first Tab stop of the page and visible only while focused, that focuses its target instead of changing the URL hash (a navigation for the router) | Signed-in pages, to jump over the bars and the sidebar (RGAA 12.7, WCAG 2.4.1) | `ds/SkipLink`, mounted by `layout/AppLayout.tsx` on `main-content` | A `SkipLink` component (label, target id) |

## Navigation landmarks (issue #276)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `Nav` | A `Nav` without its `<nav>`: it wraps its list in a `<nav>` that takes none of its props, so it cannot be named, and inside a named section it is a second, nested, unnamed navigation landmark (RGAA 12.6, axe `landmark-unique`) | The trees of the sidebar (each section, "Mailboxes", "Team-mailboxes", "Labels", is one named `nav`), the settings sections (desktop sidebar and phone list, in the "Settings" `nav`) | `ds/NavList` (the list of `Nav`, same styles), used by `ds/NavTree`, `features/settings/SettingsNav.tsx` and `SettingsSectionList.tsx` | Pass `aria-label` / `aria-labelledby` to the `<nav>`, or a `component` (or `landmark={false}`) to render the list alone |
| `Content` inside `Main` | `Content` sets `role="main"` and `Main` renders a `<main>`: used together, as `Layout` expects, every page has two nested `main` landmarks (axe `landmark-no-duplicate-main` and `landmark-main-is-top-level`, best-practice rules that the WCAG-tagged e2e check does not run; issue #226) | The main pane of the mail and settings screens, and of the team mailbox embed | `ds/FlatPanes` (`FlatContent` drops the role: the `<main>` of `FlatMain` is the only landmark) | `Content` without `role="main"`, `Main` being the landmark |
| `Alert` / `ListItem` (focus fallback) | The focus given to the nearest control (the next one, else the previous one) when the element goes away while holding it, instead of the page body (RGAA 12.8, issue #215) | Spam report "Dismiss", vacation "End now", "Empty trash now", Settings > Forwarding "Remove" | `ds/useFocusFallback` | A focus fallback on dismissible `Alert`s and removable list items |

## Empty email list

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `Empty` | The empty list of tmail-flutter (`EmptyEmailsWidget`): its empty folder drawing (160 px, not a twake-icons glyph), a 352 px column, a 24 px semi-bold title that keeps the line breaks of its translations, a 16 px grey hint, at the top of the pane on a phone. `Empty` takes only a glyph icon, an h3 title and the theme sizes | Every empty email list: a folder, a filter that leaves nothing, Starred, Action required, a label, a search, offline | `ds/EmptyListView` (+ `EmptyFolderIllustration`), used by `features/thread/EmailList.tsx`, `features/mailbox/StarredList.tsx`, `ActionRequiredList.tsx`, `features/labels/LabelList.tsx`, `features/search/SearchResults.tsx` | An illustration slot and a "list" size on `Empty`, if the other Twake apps want the same look |
| Platform bar metrics | tmail-flutter's 80 px bar: the logotype alone where the sidebar is, the search (half the room, at least 576 px) above the list, then help, settings, apps and account. `@linagora/twake-bar` is 48 px high with a home button and a search slot that grows to the menus | The desktop top bar | `ds/AppBarFrame` (`AppBarFrame`, `AppBarLeft`, `AppBarSearch`), used by `layout/AppHeader.tsx` | A height option and a sized search slot on `TwakeBar` |
| `Avatar` | tmail-flutter's gradient avatar: one of ten gradients picked from the address, the first letter in white | The sender of a list row | `ds/GradientAvatar` | None if the Twake apps keep twake-mui's flat avatar; a `gradient` variant otherwise |
| `Checkbox` | tmail-flutter's row checkbox: 20 px, light steel grey, blue under the pointer of the row, in a 40 px target | The selection of a list row | `ds/RowCheckbox`, used by `features/thread/EmailCell.tsx` | None (a look of tmail-flutter) |
| Row state slot | tmail-flutter's 28 px slots for the answered or forwarded icon and the unread dot, kept empty when the state is off | The lead of a list row | `ds/RowStateSlot`, used by `features/thread/EmailCell.tsx` | With `VirtualizedTable` row layouts |
| `LinearProgress` | Not exported by twake-mui. tmail-flutter shows the progress of a long folder action as a 3 px bar, primary on a light grey track (`colorBgMailboxSelected`) with rounded ends, sliding while the total is unknown | Above the list while every email of a folder is marked read or the Trash / Spam is emptied (#319) | `ds/ThinProgressBar`, used by `features/mailboxActions/FolderActionProgressBanner.tsx` | Export `LinearProgress` (with a thin variant) |
| Folder visibility tree | tmail-flutter's Settings > Folder visibility: 40 px rows without divider (52 px with the address of a team mailbox on a second line), a 20 px folder icon greyed when hidden, the expand button right after the name, a small primary "Hide" / "Show" text button with its icon after the text, collapsible 40 px categories ("Folders", "Personal folders", "Team-mailboxes"), in a 315 px column | Settings > Folder visibility | `ds/FolderVisibilityRow`, `ds/CollapsibleCategory`, `ds/VisibilityToggleButton`, `ds/PlainList`, `ds/NarrowColumn`, used by `features/mailbox/FolderVisibilitySettings.tsx` | None (a look of tmail-flutter); a `list-style` utility and a max-width scale in twake-css would spare `PlainList` and `NarrowColumn` |
| twake-icons folder icons | tmail-flutter's folder icons (inbox tray, outbox, spam envelope, templates clipboard, archive box…): twake-icons has none of the first four | The sidebar, the folder pickers and searches (`getMailboxIcon`), Starred and Action required | `ds/FolderIcons` | Add the folder icons of tmail-flutter to twake-icons |
| Sidebar category | tmail-flutter's "Personal folders" and "Team-mailboxes" rows under "Folders": a 36 px folder-like row with the chevron after the name, folding the tree under it | The sidebar | `ds/NavCategory`, used by `features/mailbox/MailboxTree.tsx` | With the nested `NavItem` ("Mailbox tree") |
| Typography (reading view) | tmail-flutter's subject (Medium 24, black, -0.24) and back button (a 20 px chevron, Regular 15 steel grey): the theme's `h4` is bold and grey, its small text button 13 px | The reading view and the conversation | `ds/EmailSubject`, `ds/BackButton` | None (the look of tmail-flutter) |
| Composer look | tmail-flutter's composer: a 790 × (screen − 138) px window, 28 px radius, elevation 16, 20 px from the screen edges, a 52 px title bar (Medium 17); 48 px field lines 24 px in with a light divider, "To:" and the placeholders in steel grey 15; the editor 25 px in; a bottom bar of 34 px steel grey icon buttons (Aa, attach, image, link, …), then Delete, Save as draft and a 46 px blue Send pill with its icon after the label | The composer | `ds/DockedWindow`, `ds/FieldLine`, `ds/RecipientField`, `ds/RichTextEditor`, `ds/ActionIconButton`, `ds/PillButton`, `ds/ComposerIcons` | None (the look of tmail-flutter) |
| Search results (tmail-flutter) | The filters of the results on the grey above the white card of the list (`FlatMain` `header`); the folder of a result in a light purple pill (`ds/MailboxTag`); the matches on amber (`ds/Highlight`); the filter chips #ECEEF1, a 10 px radius, Regular 13 dark grey (`ds/FilterChip`) | The search results, the suggestions of the search field | `ds/FlatPanes`, `ds/MailboxTag`, `ds/Highlight`, `ds/FilterChip`, `features/search/SearchFiltersRow.tsx` | A header slot on the `Layout` card; the rest is the look of tmail-flutter |
| Advanced search (tmail-flutter) | A panel 2 px under the search field (16 px radius, soft shadow, 24/32 px padding), a 112 px label column, 40 px outlined fields (1 px #E6E1E5, 10 px radius), blue checkboxes with their label (`CustomIconLabeledCheckbox`), 48 px buttons | The advanced search | `ds/AnchoredDialog`, `ds/FormRow`, `ds/LabeledCheckbox` | An outlined `TextField` size matching tmail-flutter's, a primary-coloured unchecked `Checkbox` variant |
| Sign-in page | tmail-flutter's web sign-in page: the pitch of the product (title, four points with their icons, a drawing) beside a 458 x 684 card (20 px radius, light shadow), filled grey fields with the name inside, a 48 px blue button with a 10 px radius, the version, "powered by LINAGORA" under the card; the card content alone below the desktop size | The basic authentication form | `ds/LoginLayout`, `ds/LoginFormFrame`, `ds/LoginTextField`, `ds/LoginButton`, used by `features/auth/BasicLoginPage.tsx`; the pictures in `public/assets/images/login/` (from tmail-flutter) | None (the look of tmail-flutter) |
| Settings menu | tmail-flutter's settings column (256 px): a grey "Back" chip (#EAEDF2, blue Medium 12), "Manage account" in Bold 17, 36 px entries with a 20 px blue icon and Regular 15 black names (Semi Bold on #EAEDF2 once selected), a divider and "Sign out". twake-mui's `NavItem` is a 14 px grey row | Settings, desktop | `ds/ChipBackButton`, `ds/SettingsMenu`, `ds/SettingsIcons` (tmail-flutter's icons), used by `features/settings/SettingsSidebar.tsx` and `SettingsNav.tsx` | None (the look of tmail-flutter); its icons in twake-icons |
| Settings header | tmail-flutter's `SettingHeaderWidget`: the title in Semi Bold 24 black at 90 %, what the section is for in Regular 16/21 grey 13 px under it, the main button on the right; 30 px margins, 22 px above | Every settings section | `ds/SettingsHeading` (`SettingsPane`, `SettingsTitle`, `SettingsDescription`, `SettingsSubheading`), used by `features/settings/SettingsSectionLayout.tsx` | None (the look of tmail-flutter) |
| Settings controls | tmail-flutter's settings controls: a 48 px blue pill for the main action and a blue text button for the secondary one, blue icon-and-text row actions ("Edit", "Delete"), rows split by a light divider with a 280 px content column, options with a Semi Bold 14 title, a grey text and a 44 × 28 blue switch, outlined fields with a radius of 10 and a label column on the left, a label with a grey pill ("Forward to [2 recipients]"), an empty list with a light blue circle and an outlined pill, key caps in light blue, the storage with a cloud in a circle and a thin gauge | Profiles, Email rules, Preferences, Forwarding, Vacation, Language, Keyboard shortcuts, Storage (also the `?` dialog of the shortcuts) | `ds/SettingsButtons`, `ds/SettingsList`, `ds/SettingsOption`, `ds/SettingsFields`, `ds/SettingsEmptyState`, `ds/ShortcutList`, `ds/StorageUsage` | None (the look of tmail-flutter) |
| `Menu` look | tmail-flutter's popup menus: 6 px radius, elevation 8, 178 to 300 px wide, 48 px items, a 20 px steel grey icon 16 px before a Regular 14 black label | Every menu of the app, from the theme as the focus indicator | `ds/MenuLook`, merged in `app/AppProviders.tsx` | Menu tokens in the Twake theme, if the other apps want them |
| twake-icons glyphs | tmail-flutter's icons everywhere the app draws one (trash, send, reply, reply all, forward, move, close, chevrons, star, attachment, eye…), generated from its SVG files under the names of the twake-icons they replace | Every screen | `ds/FlutterIcons` (generated), `ds/ReplyIcons` | Add tmail-flutter's icon set to twake-icons |
| Sending dialog | tmail-flutter's `SendingMessageDialogView`: a 400 px modal, 12 px radius, the title in Bold 17 on a light grey band, "Status: <step>..." and "Progress:" with an indeterminate bar, white at 60 % on the primary blue; it cannot be dismissed | The composer while a message is built and sent (the Send button stays as it is) | `ds/SendingDialog`, used by `features/composer/ComposerForm.tsx` | None (the look of tmail-flutter) |
| `Tab` | tmail-flutter's category tabs: a 52 px bar at most 618 px wide, tabs of their own width, Regular 14, a 1 px blue line under the selected one; twake-mui exports `Tabs` but not `Tab` | Keyboard shortcuts (Settings, `?`) | `ds/CategoryTabs` | Export `Tab` |
| `Tooltip` anchored in a frame | tmail-flutter's tooltip of the links of an email: the address under the link, black, 6 px radius, white 13 px on one line, at most 400 px; MUI's `Tooltip` cannot anchor to an element of the iframe of the body | The reading view | `ds/LinkTooltip`, filled by `features/email/EmailBodyFrame.tsx` | None |
| Compact mail rows | tmail-flutter's tiles of phones and tablets (`EmailTileBuilder`): a 48 px gradient avatar that selects the row (a blue disc with a check once selected, a `role="checkbox"` here where tmail-flutter needs a long press), then the sender, its marks, the date and a chevron, the subject, one line of preview; 72 px rows, 12 px in on a phone, 24 px on a tablet, the divider within the margins | The email list below the desktop size | `ds/SelectableAvatar`, `ds/CompactRowLines`, `compactRowLayout` of `ds/VirtualizedListTable` | None (the look of tmail-flutter) |
| Mobile app bar | tmail-flutter's bar of phones and tablets: 52 px, the menu button, the folder in Bold 21, the filter; the search under it (44 px, 10 px radius, light grey, 17 px text); the "Compose" button a 60 px blue pill with a white pen | Below the desktop size | `ds/AppTopBar`, `size="compact"` of `ds/SearchCombobox`, `ds/FloatingActionButton`, `ComposeIcon` of `ds/ComposerIcons` | A mobile top bar in twake-mui |
| Empty detail pane | tmail-flutter's detail pane with no email open (landscape tablets): "No email selected" alone, Bold 20 black, centred; `Empty` adds a large icon | Mailbox, label, Starred, Action required and search pages beside the list | `ds/DetailPlaceholder` | None (the look of tmail-flutter) |
| AI assistant | tmail-flutter's scribe: a 191 px menu card of categories (20 px grey icons, 40 px rows, a chevron for several actions opening a second card beside), the "Help me write" bar (405 px, a 2 px blue-pink-orange gradient frame, a round send button), both above the button that opened them; the answer in a 482 px card (title in Bold 14, a pulsing sparkle and "Generating response…", the text in Regular 14 / 22, copy and retry icons, "Improve ⌄", "Replace" and "Insert" pills) | The composer (`features/composer/ScribeMenu.tsx`) | `ds/AiScribePopover`, `ds/AiScribeMenu`, `ds/AiScribeBar`, `ds/AiScribeSuggestion`, the AI icons of `ds/FlutterIcons` | An AI assistant kit in twake-ui if the other Twake apps get one |
| Recipient suggestions and tags | tmail-flutter's recipients: suggestions under the chips and the input, white, rounded by 20 px, elevation 20, 60 px items (a 40 px initials avatar, the name in 16 px, the address in 13 px grey, what is typed in bold), the first one highlighted, the ones already entered ticked in a grey box; tags 32 px, light grey, a 20 px gradient avatar, Regular 17 black, a thin grey cross, white with a red border when invalid | The recipient fields of the composer | `ds/RecipientField` (`SuggestionOption`, `RecipientAvatar`, `initials`), `ds/RecipientIcons` | With the chip field asked for above |
| Recipient card | tmail-flutter's card of a recipient tag of the composer: 361 px, rounded by 16 px, a 42 px gradient avatar, the name in Medium 16, the address in grey 15 with a copy button, "Edit email" (filled) and "Create a rule" (outlined) pills, a close button in the corner, under the tag | The recipient tags of the composer | `ds/RecipientCard`, opened by `ds/RecipientField` (`card`) | None (the look of tmail-flutter) |
| Address card look | tmail-flutter's email address dialog (`EmailAddressDetailWidget`): a 67 px gradient avatar, the name in Semi Bold 24, the address in grey 14 with a copy button, then full-width 48 px pills on one line each, without icons: "Create a rule with this email" (outlined) above "Compose email" (filled) | The addresses of the reading view | `ds/ContactCard`, filled by `features/email/EmailAddressCard.tsx` | None (the look of tmail-flutter) |
| Scroll bars | tmail-flutter's scroll bars: a 6 px grey (#C1C1C1) thumb rounded by 10 px, no track, shown while the pointer is over the area that scrolls | Every scrolling area, global CSS of the theme | `ds/ScrollbarLook`, through `focusIndicatorThemeOptions` in `app/AppProviders.tsx` | A scroll bar look in the Twake theme |
| `Dialog` (confirmation) | tmail-flutter's confirmation dialog: 421 px, a 16 px radius, a close cross at the top end, the title centred in Semi Bold 24, the message in Regular 16 / 24, text buttons and a 48 px blue confirming pill at the end | Every confirmation (`ConfirmProvider`) | `ds/ConfirmDialogFrame` | None |
| `Menu` (bottom sheet) | tmail-flutter's menus on phones and tablets (`openBottomSheetContextMenuAction`): a white sheet rising from the bottom edge, a drag handle, 48 px rows (a 20 px grey icon 24 px in, a 16 px label), dividers between the groups | The "More" of the selection bar below the desktop size | `ds/ActionSheet` (a `Drawer` holding a `MenuList`) | A sheet variant of `Menu` |
| `List` (settings entries) | tmail-flutter's first level of the settings on phones and tablets (`SettingFirstLevelTileBuilder`): who is signed in (51 px avatar, the address in 17 px), then per section a 24 px blue icon, the name in 16 px, its explanation in grey 13 px, a chevron, 24 px above and below, inset dividers | `/settings` below the desktop size | `ds/SettingsTiles`, filled by `features/settings/SettingsSectionList.tsx` | None (the look of tmail-flutter) |
| Account menu | tmail-flutter's account button without the platform (`ProfileSettingIcon`): a 48 px white disc with the initial, opening a 260 px card rounded by 14 px (the address and a copy button, a close cross, "Manage account" and "Sign out") | The end of the bar of a desktop without the platform | `ds/ProfileMenu`, filled by `layout/AccountMenu.tsx` | None (the look of tmail-flutter) |
| `Select` (settings picker) | tmail-flutter's language picker (`ChangeLanguageButtonWidget`, `LanguageRegionOverlay`): the field shows the short value ("English"), its menu a card rounded by 16 px with 51 px entries ("English - English") and a blue check after the one picked | Settings > Language | `ds/SettingsFields` (`SettingsMenuSelect`) | A menu variant of `Select` with a trailing check |
| `Tabs` (compact) | tmail-flutter's shortcut categories below the desktop size: the tabs share the width of the screen, 82 px high, a 20 px grey icon over a shorter label | Settings > Keyboard shortcuts on phones and tablets | `ds/CategoryTabs` | A full-width icon-over-label `Tabs` variant |
| `Dialog` (form) | tmail-flutter's form dialog (`IdentityCreatorFormDesktopBuilder`): at most 784 px, rounded by 16 px, over the page dimmed at 20 %, the title in the middle in Semi Bold 24, a grey close cross at the top end, a 112 px column of labels before 40 px fields rounded by 10 px, an option at the start of the bottom and the buttons at the end; the whole screen of a phone with the arrow back | The identity dialog of Settings > Profiles | `ds/FormDialogFrame` (`FormDialogFrame`, `FormFieldRow`) | A form dialog variant of `Dialog` |
| Rich text editor (boxed) | tmail-flutter's editor of a signature (`ToolbarRichTextWidget` in `IdentitySignatureInputFieldWidget`): its buttons and order (insert image first, text style, size in a grey label, font, colour, highlight, bold to strike, alignment, lists; no history, link nor clearing), 40 px boxes rounded by 8 px outlined in #E6E1E5 with its own 28 px grey icons and a small arrow on the menus, 8 px after each box, then a 189 px text in 16 px, all in one frame rounded by 10 px | The signature of the identity dialog | `ds/RichTextEditor` (`look="boxed"`, `ds/RichTextEditor/boxedToolbar.tsx`) | None (the look of tmail-flutter) |
| `List` (settings cards) | tmail-flutter's list of rules (`EmailRulesItemWidget`): light grey cards 72 px high rounded by 10 px, 8 px apart, the name in Regular 14, what the rule does in a grey pill, the actions at the end | Settings > Email rules | `ds/SettingsCards` | None (the look of tmail-flutter) |
| `Dialog` (settings form) | tmail-flutter's rule creator (`RuleFilterCreatorView`): 612 x 674 px rounded by 16 px, the title centred in Semi Bold 24, a close cross at the top end, labels in Semi Bold 14, light grey boxes per condition or action, 40 px fields rounded by 10 px with a thin chevron, outlined blue pills adding a row, a "Preview" toggle and its blue and green banners, "Cancel" and a 48 px blue pill at the end; the whole screen of a phone with an arrow back | The rule dialog | `ds/SettingsFormDialog` | A form dialog variant of `Dialog`, and these fields in the theme |
| Rich text editor (settings look) | tmail-flutter's editors of the settings (the message of the vacation): one box rounded by 10 px holding the text and at its bottom one line of buttons (text style, size, font, colour, highlight, bold to strike), white and faded while disabled | Settings > Vacation | `ds/RichTextEditor` (`look="settings"`, `RichTextToolbar` `only` and `isOneLine`) | A compact variant of the editor of twake-ui |
| `Dialog` (folder picker) | tmail-flutter's destination picker (`DestinationPickerView`): 556 px, rounded by 16 px (the whole screen of a phone), the close cross at the start of a 52 px bar and the title in its middle in Bold 20, a filled grey search field, the folders by folding blocks in 36 px rows with a 20 px blue icon, subfolders folded behind a chevron after the name, the current folder bold with a check | Move To (emails, folder content, folder), the parent of a new folder, the folder of a rule | `ds/FolderPicker`, filled by `features/mailbox/MailboxPickerProvider.tsx` | A tree picker dialog in twake-mui |
| `Menu` (submenu) | tmail-flutter's submenu of a menu entry (`PopupSubmenuController`): a 249 px panel, elevation 8, rounded by 6 px, at most 400 px high, beside the entry (on its left without room), which shows a small triangle while it is open; hover, ArrowRight / ArrowLeft, Escape | "Label as" in the menus of an email | `ds/MenuSubmenu` | A nested menu in twake-mui |
| `Dialog` (modal) | tmail-flutter's modals (`MailboxCreatorView`, `CreateNewLabelModal`, `EditTextDialogBuilder`): 554 px (383 px for the small one), a 16 px radius, the close cross at the top end, the title centred (24 / 32), a grey subtitle, Semi Bold 14 labels above 40 px fields rounded by 10 px (#E6E1E5, blue when focused), a text button and a 48 px blue pill (153 px, 119 px small) | Folder creation and renaming, label creation and edition | `ds/ModalDialog` | A modal variant of `Dialog` and a field look in the Twake theme |
| Calendar event mark | tmail-flutter's mark of the rows carrying a calendar event (`buildCalendarEventIcon`): a 20 px calendar before the subject, light steel grey once read, black while unread, 12 / 8 / 4 px after it on a desktop, a tablet, a phone | The rows of the lists and the search results | `ds/CalendarEventMark` | None (the look of tmail-flutter) |

## Dark mode

twake-mui 12 builds both colour schemes (`colorSchemes.light` / `.dark`, CSS
variables, `data-theme` on `<html>`) and the app switches them with MUI's
`useColorScheme()` (the `appearance.theme` setting of the account, no choice
in the app). What is missing around it:

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `TwakeMuiThemeProvider` | The scheme before the first paint: the page starts light (`defaultMode="light"`) until React mounts, and its `mode` prop cannot say `system` | A dark page that never flashes white | An inline script of `public/index.html` (hashed in the CSP) sets `data-theme` and `color-scheme` from the copy of the account setting kept in this browser; `ColorSchemeSync` then calls `setMode()` from a layout effect | An `InitColorSchemeScript` of twake-mui (the MUI one is for SSR) and `mode="system"` |
| Theme | The dark values of the tokens the palette does not carry: the Figma greys of the event card (#F3F6F9, #424244), the attachment chip (#e5ecf3, #8c9caf, #e3f1ff, #e9eef3), the drop zone (#f5faff, #d4e8ff), the empty list (#424244 at 90 % and 64 %), the version line (#818C99) | Those components in the dark scheme | `theme.applyStyles('dark', …)` in `ds/EventCard`, `ds/UploadList`, `ds/FileDropZone`, `ds/EmptyListView`, `ds/SidebarFooter`, `ds/ToastRegion`, `ds/MessageAlert`, `ds/DockedWindow/WindowOverflowMenu` | Those tokens in the palette of twake-css, with a dark value |
| `@linagora/twake-embed` | The `twake-space:theme` message of TwakeSpace is received but not exposed by `connectToTwakeSpace` | A framed facade coloured as the page framing it | Not followed: the facade follows the setting of the account | A `onTheme` handler (or the theme in `HelloMessage`) of the connection |
| Recipient field (drag and drop) | tmail-flutter's tags dragged between the recipient fields (`RecipientTagItemWidget`, `DraggableRecipientTagWidget`, `DefaultAutocompleteTagItemWidget`): a `grab` cursor, the dragged tag blue with a white name, the field it may land in outlined in blue (1 px, rounded by 10 px); also Alt + ArrowUp / ArrowDown on a tag, and other things dropped (emails); an `outlined` look for a form (40 px, #E6E1E5, rounded by 10 px) | To, Cc, Bcc and Reply to of the composer; From and To of the advanced search | `ds/RecipientField` (`dnd`, `look="outlined"`, `recipientDrag.ts`) | Drag and drop in a field of chips of twake-ui |
| `Menu` (one choice) | tmail-flutter's menus of one choice (`PopupMenuItemActionRequiredSelectedIcon`): the chosen entry followed by icFilterSelected, a 16 px blue disc holding a white tick, 16 px after it, no background; 400 px high at most | The date, the order and the label of a search | `ds/ChoiceMenu` | A "checked" mark variant of `MenuItem` |
| `Dialog` (contact picker) | tmail-flutter's contact view (`ContactView`): 558 x 624 px at most (the whole screen of a phone), a 16 px radius, a 56 px bar with the title centred in Bold 20 and the close cross on a pale grey disc at the end, a filled grey search field rounded by 12 px, the contacts as 40 px gradient avatars, Semi Bold 15 names and grey addresses, a 20 px checkbox at the end, divided by 1 px lines, and "Clear Filter" / "Done" (44 px, rounded by 10 px) at the end | The "From" and "To" filters of the search results | `ds/ContactPickerDialog` | A multiple contact picker in twake-mui |
| `IconButton` (search bar) | the button at the end of tmail-flutter's search bar (`IconOpenAdvancedSearchWidget`): a 22 px icon, 4 px around it and 12 px on its sides, steel grey, primary blue while it applies, no background | The advanced search button of the search field | `ds/SearchBarAction` | A "plain" icon button size and an active colour in twake-mui |
| Sidebar look | tmail-flutter's sidebar (linagora_design_flutter's `LinagoraSidebar*`): 36 px rows rounded by 8 px, a 16 px icon 8 px before a Medium 14 / 18.4 name, Material's disclosure arrows (16 px in a 24 px box) right after the name, subfolders moved 8 px in per level background included, a second line (the address of a team mailbox) under the name without pushing the arrow, the selected and hovered rows tinted with #1D192B at 8 % and 4 %, the same tint under the counter; section titles 24 px high, 24 px under what precedes them, their 16.67 px actions 8 px apart; a 339 px drawer (375 px on a large tablet) under a 50 px bar | The folder and label trees of the sidebar and of the drawer | `ds/NavTreeItem`, `ds/NavCategory`, `ds/NavSectionHeader`, `ds/NavSectionAction`, `ds/CountBadge`, `ds/NavigationDrawer`, `ds/NavIcons` | A sidebar kit in twake-ui matching the Linagora design system |
| Sidebar storage | tmail-flutter's `LinagoraSidebarStorage`: a 24 px cloud, "Storage" 8 px after it in Medium 12 grey, a 24 px refresh at the end; 12 px under them a 3 px gauge rounded by 1.5 px (#0A84FF, #FFB300 past the warning limit, #FF3347 when full) on the selected tint of the sidebar, 12 px under it what is left, or in red that the storage is full and how much is used; the version 12 px under it in Regular 11 / 14 | The foot of the sidebar | `ds/SidebarStorage`, `ds/StorageGauge`, `ds/SidebarFooter`, filled by `features/quota/QuotaIndicator.tsx` | A storage block for the footer of a `Nav` |
| Composer title bar | tmail-flutter's `DesktopAppBarComposerWidget`: 52 px on `#F3F6F9` with no rule under it, 24 px in, the title Medium 17 / 22 black without tracking, 26 px buttons (20 px black `ic_minimize`, `ic_fullscreen` / `ic_fullscreen_exit`, `ic_cancel`) 8 px apart; minimized (`MinimizeComposerWidget`): a white 400 x 52 bar rounded by 24, close, full screen and show first, then the title | The composer window | `ds/DockedWindow`, `ds/ActionIconButton` (`size`), `ds/FlutterIcons` (`Fullscreen`, `FullscreenExit`) | Add the icons to `@linagora/twake-icons`; a `size` on the icon buttons |
| Composer formatting toolbar | tmail-flutter's `ToolbarRichTextWidget` of the composer: a white bar with a soft shadow, 24 px in and 8 px above and below; 40 px boxes 8 px apart, outlined in #E6E1E5 and rounded by 8, its own 28 px icons in grey #99A2AD (black when on) and a 12 px arrow on each menu; the size as a grey label in a #F4F4F4 box, the font name in a 122 px box; bold to strike in one box; no undo nor redo button; the menus: text styles written as they look (Normal, Quote, Code, Header 1…), sizes centred with a blue check, fonts with a round blue check | The composer | `ds/RichTextEditor` (`look="composer"` of `RichTextToolbar`, `composerToolbarLook`, `toolbarIcons`) | A rich text toolbar and its icons in twake-mui / `@linagora/twake-icons` |
| `Typography` / `Box` (subject frame) | the frame of tmail-flutter's subject (`EmailSubjectWidget`): 16 px around the subject (12 on a phone), its labels after it, 10 px apart, wrapping | The subject of an open email and of a conversation | `ds/EmailSubject/EmailSubjectBar` | None (the look of tmail-flutter) |
| Global text rendering | tmail-flutter draws its text on a canvas, unhinted, with a static Inter; Chromium on Linux hints the variable Inter (glyphs unevenly spaced, heavier) and narrows it above 14 px (optical size): `text-rendering: geometricPrecision` and `font-optical-sizing: none` on the page and the form controls | The whole app | `ds/TextLook` (global CSS of the theme, merged in `AppProviders`) | The same rule in the twake-mui theme, or a static Inter |
| `VirtualizedTable` (row reflow on hover) | tmail-flutter's desktop row is a flex line: the preview runs up to the date of each row, and up to the actions (26 px, 11 px apart, 16 px before the end) when they replace it on hover; a table sizes a column for every row, so the cell of the date keeps only the end of the row and its content runs out of it, over a hidden copy of the date (then the room of the actions) at the end of the subject | The desktop email list | `ds/RowHoverActions` (`RowHoverSpace`, `endGap`), `features/thread/emailListGeometry` | A per-row trailing slot in `VirtualizedTable`, or rows laid out as flex lines |
