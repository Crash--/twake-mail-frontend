# twake-mui gaps

Components, variants and fixes that `@linagora/twake-mui` (18.5) does not
provide yet, what Twake Mail uses instead, where, and what twake-ui would
need. Outside the local design system, raw MUI is never used: the UI twake-mui
lacks is built in `common/src/ds/` (imported as `@/ds/...`, rules in its
[README](../common/src/ds/README.md)), from the MUI components twake-mui
re-exports, its own components and `@linagora/twake-css` utility classes.
Each `ds/` component says in its header whether it should go upstream.

## Components

| Component / variant | Intended usage | Used meanwhile | Where | Needed upstream |
|---|---|---|---|---|
| `AppTitle` (logotype) | Top bar, login card | twake-mui's `AppTitle` (`Mail`, `TwakeText`, `MailText`) in one `img` named by a `label` prop | `ds/AppTitle`, wrapped by the injectable `layout/AppTitle.tsx` | A `label` (accessible name) on `AppTitle` |
| Top bar / app header | Below the desktop size, under the platform bar (`@linagora/twake-bar`, which holds the logo, the apps and the account): a menu button, the folder name, the search (folded on phones), help and settings | `AppBar position="static" color="inherit" elevation={0}` + `Toolbar` with title, search and actions slots, `IconButton`s for the menu and the search | `ds/AppTopBar`, filled by `layout/TopBar.tsx` | A top bar matching `Layout`/`Main` (`withTopBar`, 48 px reserved below `lg`), with title, centre and actions slots and its responsive behaviour (see "Responsive"). The Layout story fakes one with `Box` + `sx` |
| `SearchBar` labels | Top bar search | `SearchBar` with `disabledClear` and a translated clear button passed as the input `endAdornment` | `ds/SearchCombobox` | Fixed in 9.17 (so in 18.3): the clear button label is translated (en, fr, ru, vi). Remains: the default input label (`Search`) is hard-coded in English (accept a label), and a slot for buttons after the input (advanced search); `ds/SearchCombobox` keeps its own clear button |
| Search with suggestions | Search field of the top bar: suggestions while typing, quick filters above them | ARIA 1.2 combobox around `SearchBar`: `role="combobox"` input, grouped `listbox` with `aria-activedescendant`, a free header (filters) in a `Popper` under the small `SearchBar` as twake-mui draws it (40 px pill) kept next to the field in the DOM (tab order), Escape closing the list before reaching the page, right click focusing the field | `ds/SearchCombobox`, filled by `features/search/SearchField.tsx` | A search field with suggestions (MUI `Autocomplete` cannot host `SearchBar` nor a header of filters); every Twake app with a search needs one |
| Event card ("Orange Bar") | The calendar event of an invitation, above the body of the email: date icon, state badge, title, labelled details (when, where, video, who), answers, "Mail to attendees", "See in your Calendar" | The design of linagora-design-flutter `LinagoraEventCard` (#119, #122) rebuilt with `Box` + `sx` on theme tokens: a `section` region named by its label, a `dl` of details (label column of 67 px, labels above values on phones), `Button` as `aria-pressed` toggles (contained, ghost once chosen with a check), text actions as text `Button` | `ds/EventCard` (`EventCard`, `EventAnswerButton`, `EventTextAction`), filled by `features/calendar/CalendarEventCard.tsx` | An event card in twake-ui, which Twake Calendar (event preview) and Chat could share. Contrast follows the theme (`warning.main` date bar, `text.secondary` labels, `primary.main` pills), which is below AA in places |
| Dialog framing an app | The Twake Drive picker of the composer | MUI `Dialog` (named by a visually hidden title: the framed page has its header; full screen on phones, elsewhere centred at the size the framed page asks for through the cozy intent `resize`, 900 × 800 by default, capped by the screen, its transition off under `prefers-reduced-motion`) holding an `iframe` with a `title`, a `role="status"` progress until the framed page is ready, then the focus in the frame; a close button over the frame while it loads, which the framed page takes over once ready (`showCloseButton`, the intent `showCross` / `hideCross`); an error in a `role="alert"` with its actions | `ds/FramedDialog`, used by `features/composer/DriveAttachButton.tsx` | A dialog variant hosting another app (Drive picker, Calendar and Chat intents), with its loading state |
| Colour swatches | The colour of a label | A native radio group of round swatches, a "no colour" choice, visible focus and selection rings | `ds/ColorSwatchPicker`, used by `features/labels/LabelDialog.tsx` | A colour picker (swatches, custom colour) |
| Coloured tag | The labels of an email (list rows, reading view) | A `span` in the colour, black or white text for contrast, an optional × `ButtonBase` | `ds/ColorTag`, used by `features/labels/LabelChips.tsx` | A `Chip` taking any colour, with a readable text colour |
| Full-page loader | Waiting for the SSO, the session | `CircularProgress` centered with twake-css classes, `aria-busy` | `ds/FullPageLoader` | A full-page spinner |
| Full-page error | Session, crash, configuration errors | `Empty` + `Button` in a `role="alert"` box | `ds/ErrorScreen` | An error variant of `Empty` with a recovery action |
| Mailbox tree | Sidebar folders (and the "Team-mailboxes" tree, its own heading and `role="tree"`), and the labels | `NavTree` (`Nav` without its fixed `margin: 24px 0`, `role="tree"`) of `NavTreeItem`s: a `NavItem` (`role="treeitem"`, `aria-level`) whose row carries the hover and selected backgrounds (full 36 px, radius 8), the `NavLink` stretched over it, then the expand arrow as an `IconButton` of its own after the label (44 px on touch screens), a `CountBadge` and the actions that replace it on hover or keyboard focus; indentation by padding (8, 44, 52, +8) without a cap; the name in a tooltip when truncated. The "Folders" title is a heading outside the tree (`NavSectionHeader`; a `ListSubheader` inside it breaks the tree role) | `ds/NavTreeItem`, `ds/NavTree`, `ds/NavSectionHeader`, `ds/CountBadge`; used by `features/mailbox/MailboxTreeItem.tsx`, `StarredTreeItem.tsx` and `features/labels/LabelsSection.tsx` | Nested, collapsible `NavItem`s (more than the one level of `NavDesktopDropdown`) with the expand arrow after the label, an uncapped indentation, a counter, hover actions and drop target support; the selected background on the `NavItem`, not on a `NavLink` that is `height: 100%` of a parent with no height (it measured 124 x 19 px inside the drop target); a `Nav` without margin or with a `subheader` that does not end up inside a `role="tree"` list
| Message list | The email list: thousands of rows loaded page by page, one line per email | `VirtualizedTable` of twake-mui, as in Twake Contacts, through `VirtualizedListTable` with a `RowLink` per row and `RowHoverActions` (also used by the folders of the tree, `in="listItem"`) | `ds/VirtualizedListTable`, `ds/RowLink`, `ds/RowHoverActions`; used by `features/thread/EmailList.tsx` and `EmailCell.tsx` | See "VirtualizedTable" below |
| Unread dot | Unread marker of a list row | `CircleFilled` icon (8 px) in a `Typography color="primary"`, named by a `label` | `ds/StatusDot` | A status dot / badge without a number |
| Compose button | The main action of the sidebar | `Button variant="contained"` of the theme (primary colour, 14 px label, 40 px high, pill) with a 12 px icon; 34 px high in a toolbar | `ds/ComposeButton`, used by `layout/MailSidebar.tsx` | A 34 px `Button` size |
| Navigation counter | Unread count of a folder | A pill (`span`) on `action.selected`, `overline` text, min-width 16, padding-x 4.5, "999+" past 999; `Badge` is a dot over an avatar and a small `Chip` is 24 px high | `ds/CountBadge` | A navigation badge in `NavItem` |
| Navigation section header | "Folders", "Labels" and their action buttons | A level 2 `Typography caption` (12/500) in `text.secondary`, above the list it titles (the collapsible title is "Collapsible sidebar section header" below) | `ds/NavSectionHeader` | A `Nav` `subheader` that keeps the tree role, with an actions slot |
| Icons of the system folders | Inbox, Outbox, Spam, Templates, Archives, Action required and a vertical "more" (⋮) | The closest existing icons: `Email`, `Send`, `Warning`, `Note`, `Archive`, horizontal `Dots`; the folders use `FolderOutlined`, drafts `FileOutline`, starred `StarOutline` | `features/mailbox/mailboxDisplay.ts`, `MailboxTreeItem.tsx` | `Inbox`, `Outbox`, `Spam`, `Template`, a clock for Action required and `DotsVertical` in twake-icons (the Figma file has them) |
| Sidebar width | The folder column | `SIDEBAR_WIDTH` (236, twake-mui's own) in `ds/ResponsiveSidebar`, passed as `sx` | `ds/ResponsiveSidebar` | A `width` prop on `Sidebar`. At 236 px "Boîte de réception" is cut by 2, 8, 15 and 28 px with 1, 2, 3 digits and "999+" (name and tooltip stay complete) |
| Email header | Subject, sender with avatar, To/Cc/Bcc lines, date of the reading view | `Typography`, `Avatar` in a CSS grid whose date goes under the recipients on phones, long addresses wrapping | `ds/MessageHeader`, filled by `features/email/EmailView.tsx` | A message header component (identity, recipients, date, actions) that reflows on narrow screens |
| Attachment chip | Attachments of an email: 260 x 36 px chips (file icon, name keeping its extension, size, download button), the ones fitting on one row then "Show +N more" (three in a column on a phone), a header with "Download all" | `ButtonBase`, `IconButton`, `Tooltip`, a `ResizeObserver` measuring the row | `ds/AttachmentCard` (`AttachmentCard`, `AttachmentCardRow`, `AttachmentHeader`, `AttachmentDownloadAll`, `AttachmentTextButton`, `AttachmentListFrame`, `visibleAttachmentCount`) | An attachment chip (file type icon, name, size, download and preview actions) |
| Rich text editor | Composer body: formatting toolbar, link dialog, inline images with their size toolbar, quoted email and signature kept as HTML blocks, a line above them on demand | TipTap 3 (MIT) with `RichTextToolbar` (APG toolbar, roving tabindex), `LinkDialog`, `ImageToolbar` (sizes in % of the image, smaller, larger, remove: the keyboard alternative to the resize handles), `HtmlBlock` (atom node, sandboxed iframe), `InlineImage`, `SmartTrailingBlock` (from Messages, MIT), `cleanPastedHtml`; a `disabled` prop (TipTap `editable: false`, `aria-disabled` on the editing area and on every toolbar button, which stays in the tab order, greyed like a disabled field); every `data-testid` comes from the caller (`testIds`) | `ds/RichTextEditor`, used by the composer (`features/composer/ComposerForm.tsx`), the vacation message (`features/vacation/VacationSettings.tsx`, disabled while the response is off) and the DEBUG route `/spike/composer` | A `RichTextEditor` in twake-ui (Twake Chat and Docs need one too), or at least a `Toolbar` with roving focus and toggle/menu buttons |
| Field of chips with suggestions | Recipients of the composer (To, Cc, Bcc, Reply-To), later attendees and sharing | ARIA 1.2 combobox (`InputBase` with `role="combobox"`, `aria-activedescendant`, listbox in a `Popper` kept next to the field) after MUI `Chip`s out of the tab order, reached with ArrowLeft or Backspace, removed with Delete (announced in a live region), edited with Enter, F2 or a double click; invalid chips say so in their name and with an icon. MUI's `Chip`, not twake-mui's (its `React.FC` dropped the `ref` under React 18; since React 19 the `ref` is a plain prop and twake-mui 10's `Chip` forwards it, checked: the ds could use it, not done in the React 19 upgrade) | `ds/RecipientField`, filled by `features/composer/` | A chips field with suggestions (MUI `Autocomplete` `multiple` has no chip editing, no paste of lists and puts every chip in the tab order) |
| Docked window | The composer: windows at the bottom end of the screen, several side by side, minimized to their title bar or full screen, the page still usable around them; full screen on small screens | `Paper role="dialog"` named by its title, `FocusTrap` and `Backdrop` once full screen (`aria-modal`), the content kept mounted in every mode, Escape handed to the owner, focus moved to the title bar on minimize and back on restore; `WindowDock` lines them up, `fitWindows` minimizes what does not fit and puts the rest in `WindowOverflowMenu` (a named menu button at the start of the dock, or in the title bar of the full screen window through `titleBarActions`), so no window is ever out of reach | `ds/DockedWindow`, used by `features/composer/` | A window dock (Gmail's composer, chat windows); `Dialog` has no non modal nor minimized variant |
| Overlay of the host page | Framed by TwakeSpace, the docked windows and the dialogs sit on the page of TwakeSpace, not inside the frame: the composer at the bottom end of the window, a dialog centred on it and dimming all of it | `OverlayPortal` renders into the body of an overlay frame TwakeSpace puts over its whole page, on the app's origin (`public/embed/overlay.html`); `overlayThemeOptions` gives `MuiDialog` and `MuiDrawer` its body as `container` (menus and tooltips follow their anchor's document); the app's CSS rules are copied into it, and the region it draws in is sent to TwakeSpace, which clips the overlay to it | `SpaceOverlay` of `@linagora/twake-mui`, used by `ds/DockedWindow/WindowDock` and `app/AppProviders` | A host overlay for framed apps (twake-space-architecture `specs/twake-surface.md`) |
| Upload list | The attachments of the composer: name, size, progress, cancel or remove | A named `ul` of bordered items with an icon, `LinearProgress` (named `progressbar`) while uploading, a warning icon and words when it failed, an `IconButton` removing it; a live region announcing what changed | `ds/UploadList`, used by `features/composer/` | A file upload list (Mail attachments, Chat files, Drive uploads) |
| File drop zone | Dropping files on the composer to attach them | A `Box` handling the drag events (capture phase) of files only, with the Figma panel over it while files are dragged (dashed light blue frame, file icon, "Drop file here to attach them"); the keyboard way is the button picking files | `ds/FileDropZone`, used by `features/composer/` | A drop zone (Mail, Chat, Drive) |
| Sandboxed HTML viewer | Body of an email | A plain `iframe` (`sandbox`, `srcdoc`, `title`, height from its content) styled by a stylesheet inside the email document | `features/email/emailBody.ts` | Nothing expected from twake-mui, but the theme (fonts, colours) does not reach inside the iframe: the email document repeats a minimal style |
| Conversation (thread detail) | The messages of a conversation, each collapsed (sender, date, preview) or expanded (the message) | `ol` of `li`, each with a full-width `ButtonBase` toggle (`aria-expanded`, `aria-controls`) and a `region` named by it; ArrowUp / ArrowDown / Home / End between the toggles; `MessageHeader` rendered as `span`s inside the toggle | `ds/MessageThread` (`MessageThread`, `MessageThreadItem`), filled by `features/thread/ConversationView.tsx` | A message thread component; MUI's `Accordion` (card look, side expand icon, no keyboard moves between items) does not fit a message list |
| Breakpoints | Phone, tablet and desktop layouts | `useMediaQuery` on 600, 900 and 1200 px, named `mobile`, `tablet`, `tabletLarge`, `desktop` | `ds/useScreenSize` | See "Responsive": twake-mui's `useBreakpoints` and theme keys (md 769, lg 1024) are made for the Cozy bottom bar |
| Navigation drawer | Folders below the desktop size | Temporary `Drawer` from the start edge, its paper a named `role="dialog"` with `aria-modal`, a header slot and a close button; twake-mui's desktop `Nav*` styles inside | `ds/NavigationDrawer`, `ds/ResponsiveSidebar` (twake-mui `Sidebar` on a desktop, the drawer below) | A `variant="drawer"` of `Sidebar`, and `Nav*` that stay vertical in it (see "Responsive") |
| Touch targets | Icon buttons, list actions, tree toggles on touch screens and phones | `GlobalStyles` giving `IconButton`, `Button`, clickable `Chip`, `MenuItem` a 44 px minimum under `(pointer: coarse), (max-width: 599.95px)`; a 2rem / 44 px slot for the tree expand arrow | `ds/TouchTargets` (in `layout/AppLayout.tsx`), `ds/IconSlot` | The same rule in the theme overrides, and an icon slot in a nested `NavItem` |
| Floating action button | "New message" on phones and tablets | `ExtendableFab` fixed at the bottom end (safe area included), in the theme's primary look | `ds/FloatingActionButton` | A placement prop on `ExtendableFab`, an AA label colour, and a scroll container to follow (it listens to `window`) |
| Toast (snackbar) | Outcome of an action ("Moved to Trash" with Undo, errors with Retry), one at a time at the bottom of the screen | Two live regions always in the page (`role="status"` polite, `role="alert"` for errors) holding the message, and a filled `Alert` without a role with the message (hidden from screen readers, read by the regions), an action `Button` and a close `IconButton`; a countdown paused on hover, focus and hidden page; Escape closes it; no animation with reduced motion | `ds/ToastRegion`, filled by `features/notifications/NotificationsProvider.tsx` | MUI's `Snackbar` mounts its `role="alert"` content with the text (often not read), knows no polite message, and closes on its timer while the focus is in it: a notification region with persistent live regions, pause on hover and focus, an action and a severity |
| Filterable list (picker) | The folder picker of "Move message": a filter field and the folders, always shown | `TextField` as an ARIA 1.2 combobox (`aria-activedescendant`) driving a `List` `role="listbox"` of `ListItemButton` options (`aria-selected`, `aria-disabled`), indented by level, the path shown while filtering | `ds/FilterableListbox`, filled by `features/mailbox/MailboxPickerProvider.tsx` | A picker list (`Autocomplete` only knows a popup list): Drive and Calendar pick folders and calendars the same way |
| Drop target | Folders of the tree receiving emails dragged from the list | A `Box` with the drag events, outlined (dashed primary) while an accepted drag is over it; `setDragLabel` shows "Move 2 messages" under the pointer | `ds/DropTarget`, used by `features/mailbox/MailboxTreeItem.tsx` | Drop target support on `NavItem` (see "Mailbox tree"), and a drag preview helper |
| List and detail | The email list and the open email: one at a time, or side by side from 900 to 1199 px | Two `Box` panes (list 375 px), only the shown ones rendered, focus given back to the list when the detail closes beside it | `ds/ListDetailLayout`, used by `apps/private/src/features/mailbox/MailboxPage.tsx` | A master-detail layout |
| Sticky bar | The actions of a conversation (back, read, star, move) staying in view over a long thread, on phones above all | A `Box` `position: sticky; top: 0` over the paper background; the messages scrolled to leave `scroll-margin-top` for it | `ds/StickyBar`, used by `features/thread/ConversationView.tsx` (`MessageThreadItem` for the margin) | A sticky variant of the toolbar / app bar |
| View transitions (list ↔ item) | Opening and closing an email: a swipe-like slide below 900 px, a fade through above, nothing with reduced motion or without the API | `prepareViewTransition(direction)` (API and `prefers-reduced-motion` check, direction on `<html>`) passed as the `viewTransition` option of the router `navigate`; `view-transition-name` on the panes and `::view-transition-*` rules in `GlobalStyles` | `ds/ViewTransition`, styles in `ds/ListDetailLayout`; called from `features/thread/EmailCell.tsx`, `features/email/EmailView.tsx`, `features/email/useEmailViewShortcuts.ts`, `features/search/SearchField.tsx` | Transitions between views in the theme (durations, easings, a reduced-motion switch), or the master-detail layout with them |
| Search row (desktop) | The search pill (700 px at most) at the top of the page, under the app bar, with the settings icon button at the far end of the row | `Box` flex row: `SearchCombobox` (around `SearchBar`) then the actions | `ds/SearchRow`, filled by `layout/MailSearchRow.tsx` | A page header / toolbar row with a start slot growing to a max width and an end slot |
| List filter ("Filter ˅") | Dropdown of the list toolbar: attachments, unread, starred, one at a time, a toast, a clear button; the icon alone on phones | twake-mui `DropdownButton` + `Menu` of `menuitemradio`. The filtered folder is a query list (`Email/query` filter ANDed to `inMailbox`) that push keeps in sync; no `ds/` component needed | `features/thread/EmailListFilterMenu.tsx`, `listFilter.ts`, `ListFilterProvider.tsx` | A list toolbar / filter button pattern in twake-mui |
| Flat body (`Layout` variant) | The body plain white, one card for the whole main pane on a desktop (16 px from the platform bar and the window, 16 px radius, the grey of the `Layout` around it), flush below the desktop size; no card inside it | `Main` and `Content` with `sx` (`bgcolor`, margins and radius of `Main` with `inset`, `m: 0`, `borderRadius: 0` on `Content`) | `ds/FlatPanes` (`FlatMain inset`, `FlatContent`) | A flat variant of `Layout` / `Main` / `Content` (still missing in 18.3) |

## VirtualizedTable

The email list uses `VirtualizedTable` like Twake Contacts (`ContactsTable.tsx`,
`ContactCell.tsx`, `AddressBookPage.tsx`): one cell component switching on
`column.id`, rows given as data objects with a stable `computeItemKey`,
`endReached` loading the next page, no column sort (the server sorts), hover
actions revealed by a `.MuiTableRow-root:hover` rule. Twake Mail needs more
than 18.5 offers; `ds/VirtualizedListTable` composes `VirtualizedTable`
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
17. **The scroller is a tab stop.** Virtuoso gives its scroller
    `tabIndex={0}`, with no role nor name: Tab stops on an empty box between
    the toolbar and the first row, where the arrows only scroll (#501).
    Wrapper: `tabIndex={-1}` on the `Scroller`; the row controls scroll the
    list as they take the focus.

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
(`DEFERRED_RULES`). The `color-contrast` rows below are inputs for that
theme: the colours that had been darkened by hand (`ds/EventCard`,
`ds/FloatingActionButton`) now follow the palette.

| Component | Rule (axe) | Measured | Fix upstream |
|---|---|---|---|
| Theme `text.secondary` (Grey 900 at 64 %), used by `Typography color="textSecondary"`, `TableCell` body, `ListSubheader` | `color-contrast` | 3.6:1 on white, 3.5:1 on Grey 100 (4.5:1 needed) | Grey 900 at 80 % or more (5.4:1). Worked around only in the list table (cells in `text.primary`) |
| `TextField` / `InputLabel` (login form) | `color-contrast` | #868687 on white, 3.63:1 | Same theme fix |
| `Empty` `text` and `title` | `color-contrast` | #868687 on white, 3.63:1 ("No Rules Configured", "No Labels yet" in a dialog) | Same theme fix. Worked around: `Typography color="textPrimary"` as the title (`features/labels/ChooseLabelsDialog.tsx`) |
| `TextField` helper text (`FormHelperText`, identity form) | `color-contrast` | #868687 on white, 3.63:1; in error, `error.main` #ff3347, 3.61:1 | The theme fixes of `text.secondary` and `error.main` |
| `NavLink` with a `ListItemText` (list of the settings sections on phones) | `color-contrast` | The nav text colour #868687 on white, 3.63:1 | Same theme fix |
| `Button variant="contained"` primary (sign in, new message) | `color-contrast` | White on #0a84ff, 3.64:1 at 15 to 16 px normal weight | A darker `primary.main` for filled buttons (4.5:1 with white needs about #0067d6) |
| `Button variant="text"` primary ("Clear filter" of the search) | `color-contrast` | #0a84ff on white, 3.64:1 at 13-14 px | The same darker `primary.main` (or `primary.dark` for text buttons) |
| Selected `NavLink` (current folder) | `color-contrast` | #0a84ff on `action.selected` #e5e8eb, 2.96:1 | Darker selected text (`primary.dark`) |
| `Nav` `subheader` | `aria-required-children`, `listitem` | A `ListSubheader` `li` inside a `role="tree"` list | Render the subheader outside the list. Worked around: heading outside the `Nav` |
| Focused `TextField` label (composer spike link dialog) | `color-contrast` | #2684e3 on white, 3.82:1 | Same theme fix |
| `ExtendableFab` `color="primary"` | `color-contrast` | `primary.dark` #006bd8 on `primary.light` #d2e9ff, 4.11:1 at 16 px | Not worked around any more in `ds/FloatingActionButton`: reported, to fix in the theme |
| `IconButton size="small"`, `NavItem`, `Chip` | (review, WCAG 2.5.5) | 32, 36 and 32 px high on touch screens | 44 px on coarse pointers. Worked around with `ds/TouchTargets` |
| `DialogContentText` | `color-contrast` | text.secondary #868687 on white, 3.63:1 (confirmation dialogs) | Same theme fix |
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
(remove image). twake-icons should get the missing ones, and an "open in full" glyph (the
docked window takes it from `ds/FlutterIcons`; its minimize, restore and
exit full screen buttons use `Dash`, `Top` and `Narrow`).

The other glyphs twake-icons lacks are drawn locally (`ds/FlutterIcons`,
`ds/ReplyIcons`, `ds/ListIcons`, `ds/SettingsIcons`, `ds/ComposerIcons`): the
last row of "Other components" lists them. Everything else, the system
folders included, is a twake-icons glyph, with no dedicated inbox, spam nor
template icon (`Email`, `Warning` and `Note` stand in).

The answers of an email have one icon in twake-icons, `Reply`: "reply all"
and "forward" come from `ds/FlutterIcons` (through `ds/ReplyIcons`) in the
buttons under an email, and the menus use `Reply` for the three replies and
`Share` for Forward. twake-icons should get `ReplyAll` and `Forward`.

There is no "important" icon: the list, the reader and the conversation use
`WarningCircle`, always with the word "Important" for screen readers
(`features/email/ImportantMark`). twake-icons should get `Important`, and a
read receipt icon, absent too: the "More" menu of the composer shows a
`Check` beside the options turned on (`menuitemcheckbox`).

twake-css:

- `u-fw-bold` has no `!important`, unlike most utilities: it loses against
  the font weight of a `Typography`. Bold text goes in an inner `<span>`.
- There is no `min-width: 0` class (`u-miw-0`) to let a flex item shrink
  below its content: `u-ov-hidden` (or `u-ellipsis`) does it as a side
  effect.

## Responsive

twake-mui's responsive behaviour is the one of Cozy apps: a few destinations
in a bottom tab bar and a top bar fixed over the page below `lg` (1024 px).
A mail client needs its own limits: folders in a
drawer below 1200 px, list and email side by side from 900 to 1199 px, one
view at a time below 900 px. What Twake Mail does, and what twake-ui would
need:

1. **Breakpoints.** The theme keys are sm 544, md 769, lg 1024, xl 1201, and
   `useBreakpoints` (exported) reads them. Twake Calendar's
   `useScreenSizeDetection` uses lg as the desktop limit; Twake Mail uses
   600 / 900 / 1200. `ds/useScreenSize` reads explicit media queries on
   those values, and treats a browser without `matchMedia` (jsdom) as
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
| `Banner` | Persistent inline banner (offline) with a dismiss button, pinned at the bottom of its parent | "No internet connection" | `ds/OfflineBanner` (composes a filled `Alert`), mounted by `features/network/OfflineNotice.tsx` | `Banner` / `PointerAlert` with a dismiss action, or a `Snackbar` `persistent` / `anchor` parent option |
| `ListSkeleton` | One-line rows with several segments (checkbox, avatar, sender, subject, preview, date) as in the Figma loading state | Loading of the email list | none: `ListSkeleton` `count` + `divider` is used | `ListSkeleton` `variant="table"` with segments |
| `VirtualizedTable` rows | Selected row at primary 8 % (`ROW_SELECTED_COLOR`) instead of `selectedOpacity` 18 %; cells in `text.secondary`; a column header the mock does not have | Email list | `ds/VirtualizedListTable` (`ROW_SX`, selected colour and cell colour only) | Theme `MuiTableRow` selected opacity |
| `Checkbox` | The empty box is `text.secondary`, the Figma draws it in `border.main`; checked and under the pointer it is primary | The selection of a list row, the labelled checkboxes of the advanced search | twake-mui `Checkbox size="small"` in `ds/RowCheckbox` (primary under the pointer of the row, used by `features/thread/EmailCell.tsx`) and `ds/LabeledCheckbox` | A `Checkbox` whose empty box is `border.main` |
| Theme palette | `divider`, `action.hover`, `action.selected` are tinted `#424244`, Figma uses `#1d192b` at the same opacity | everywhere | not overridden (no global theme override) | `makePalette` |
| `NavItem` | A second line under the name (path of a search result) | Folder search results | `ds/NavTreeItem` (`secondary` prop) | Optional `secondary` on `NavItem` |

## Composer design (batch composer)

The composer follows the Figma "Composer" frames (window 790 px, flat 37 px
field lines, boxed formatting toolbar, footer). No global theme override: what
twake-mui lacks lives in `@/ds/`.

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| Field line | A flat line: label on the left, value inline, full width divider, 37 px; no outlined or filled look, no floating label | From, Subject, and the line of `RecipientField` (To, Cc, Bcc, Reply to) | `ds/FieldLine` (`FIELD_LINE_SX` shared with `ds/RecipientField`) | `TextField variant="line"` (or a `FormRow`) |
| `Button` | Underlined text button: `body2`, secondary colour, padding 2 4, pill radius (twake-mui text buttons are 16 px, primary, not underlined) | "From", "Cc", "Bcc", "Reply to" at the end of the To line | `ds/FieldTextButton` | `Button variant="link"` |
| Toolbar | Bordered boxes (1 px divider, radius 4, 32 px high) for the controls, one box for a group (bold, italic, underline, strikethrough: 24 px buttons, 114 px wide), a value shown in the box (size), a 10 x 2 colour bar under the "A" | Formatting toolbar | `ds/RichTextEditor/RichTextToolbar` (APG toolbar kept: roving tabindex, `aria-pressed`, Alt+F10) | A `Toolbar` with `ToolbarGroup` and `ToolbarSelect` in twake-ui |
| Window | 790 x 634, radius 8 all around (`radius.md`), Material 3 elevation 3 in the Figma (`0 1px 3px rgba(0,0,0,.3), 0 4px 8px 3px rgba(0,0,0,.15)`; drawn with `theme.shadows[4]`), title bar 44 px on `background.default`, title `h5`, minimized bar 400 px, 24 px from the edges | Composer | `ds/DockedWindow`, `ds/DockedWindow/WindowDock` | `Paper elevation` M3 levels (twake-mui has MUI shadows only) |
| `@linagora/twake-icons` | No "open in full" (`Fullscreen` of `ds/FlutterIcons` in `ds/DockedWindow`), no "format size" (Material path `fontSize` of `editorIcons`, used for the footer toggle), no highlighter | Title bar, footer, toolbar | `ds/DockedWindow`, `ds/RichTextEditor/editorIcons` | Add `OpenInFull`, `FormatSize`, `Highlighter` |
| `LinearProgress` | The sidebar storage gauge: 3 px high, square ends, track on `action.selected`, bar in the primary (warning, error) colour; twake-mui's bar is thicker and rounded | Sidebar footer | `ds/StorageGauge` | `LinearProgress size="thin"` (square) |
| Nav footer | The foot of the sidebar: 24 px padding sides and bottom, the storage block, the version centred in an `overline` in `text.secondary` (the Figma colour is Steel gray 400 #818C99) | Sidebar footer | `ds/SidebarFooter` | `Nav` `footer` slot, with a `version` line |

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
- Variant: a button following the end of the selected text (a sparkle), in the tab order after the text.
- Usage: the AI assistant of the composer opens its menu on it.
- twake-ui change: upstream with RichTextEditor, which twake-mui lacks.

## Mail list and toolbar (batch P4)

The list follows the Figma "Email message list", on twake-mui's tokens. No
global theme override: what twake-mui lacks lives in `@/ds/`.

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `IconButton` | A 32 px round button holding a 20 px icon, with its tooltip as accessible name | Row actions, refresh | `ds/IconAction` | `IconButton size="small"` at 32 px with a `label`, 20 px icons |
| Theme palette (star) | A yellow for a filled star: the palette has no yellow role, so the star takes `warning.main` (orange-yellow), and `warning.light` marks a search match | Starred rows, star toggles, search matches | `ds/IconAction` (`starred` tone), `ds/Highlight` | A yellow role (or a `star` colour) in the palette |
| `@linagora/twake-icons` | No empty checkbox (`Checkbox` is checked) nor vertical dots (`Dots` is horizontal) | Select all of the toolbar and the "More" of a row | `ds/ListIcons` (Material Icons paths, Apache-2.0) | Add `CheckboxBlank` and `DotsVertical` |
| Row layout | Padding 6 8 and 8 px between cells (`rowLayout`), a sender block of 198 px after a 20 px marker frame, subject at most 268 px, subject and date Semi Bold (600) when unread (twake-css has `u-fw-bold` only) | Mail rows | `ds/VirtualizedListTable` (`rowLayout`), `ds/RowSender`, `ds/RowDate`, `ds/RowLine` (`isStrong`), `ds/StatusDot` (`framed`) | `VirtualizedTable` row padding / gap options; theme semi-bold utility |
| Tag | `size="small"`: 11 / 14 text, 4 px padding | Labels in a row | `ds/ColorTag` | `Chip size="small"` with a free colour |

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
| `Alert` / `AlertTitle` | Levels (info, warn, error), icon, title and `onClose` exist. Missing: a message that is part of the page is not an event, yet `Alert` is `role="alert"` (a live region); the level is carried by colour and an `aria-hidden` icon only; `action` replaces the close button, so an action and a labelled dismiss cannot sit together | Banner between the header and the body of an email, one per backend warning | `ds/MessageAlert` (composes `Alert`, `AlertTitle`, `Button`, `IconButton`): `role="group"` named by its title, level in words (visually hidden), ghost action button plus dismiss | `Alert` `role` and `levelLabel` props; `action` next to `onClose` |
| `Alert` | One-line warning above a section (the attachments), without title nor action; static, level in words | Inline warning above the attachments. Built, not mounted: the header contract does not say when attachments are blocked (issue #142, open questions) | `ds/InlineAlert` | Same as above |
| `Avatar` | A state instead of initials or a picture: red round badge with a warning sign, named for assistive technology | Replaces the sender avatar of a message with an error-level warning | `ds/WarningAvatarBadge` (composes `Avatar`) | `Avatar` `color="error"` with an `icon` and a `label` |
| Upload list: chip, fold and popup | Attached files as 280 px chips (type icon or thumbnail, name cut in the middle, size, check, 2 px progress bar, retry, 20 px remove), a "Show less / more" link, and a popup listing the uploads when there are more than nine | `ul` of `li` chips on palette roles (`divider` border, `text.secondary` overline size, `action.selected` remove disc, a `LinearProgress` named `progressbar` on the 2 px track, the small text `Button` for the fold link), buttons 20 px that keep 44 px targets on touch screens with a negative margin, a link `Button` (`aria-expanded`); `UploadPopup` is a non modal `region` fixed at the bottom start; a live region announces what changed | `ds/UploadList` (`UploadList`, `UploadChip`, `UploadPopup`), filled by `features/composer/ComposerAttachmentsList.tsx` | A file chip with progress, a middle ellipsis `Typography`, and a non modal upload panel (Drive uploads need the same). The Figma draws the border #e5ecf3, the track #e3f1ff and a 13 px link #1990ff, which the theme does not have |
| Recipient chip with avatar, folded recipients | Chips 32 px high with a round letter avatar, and the fields folded into chips with a "+N" counter | The avatar letter is drawn by `::before` so it is not part of the text nor of the name of the chip; `RecipientSummary` measures a hidden copy of the chips (`ResizeObserver`) to know how many fit, one `ButtonBase` named after every recipient | `ds/RecipientField` (`RecipientAvatar`, `RecipientSummary`) | A chip `avatar` that is not text, and a "+N" overflow chip list |
| Foldable inline block | The signature as a card under a "Signature" pill | `HtmlBlock` option `toggleLabel`: an outlined pill `Button` (`aria-expanded`) above a bordered card, folding the view only | `ds/RichTextEditor/HtmlBlockView.tsx` | A disclosure pill (outlined, rounded 100) |

## Reading view and conversation (batch D1)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `Typography` | Bold 17/24 (sender name in the Figma) has no variant: `h5` (16/600) is used | Header of an open email and rows of a conversation | `ds/MessageText` (composes `Typography`) | A 17/700 variant, or accept `h5` |
| `Button` | Text button underlined, Medium 14/18.4, `padding 4 8`, 100 px radius, secondary colour | "Unsubscribe" after the sender | `ds/InlineTextButton` (composes `ButtonBase`) | `Button variant="text" size="small"` with an `underline` option |
| `Button` | "Mail action bar": a divider and buttons sharing the width (`flex 1`, min-height 48, 100 px radius, 20 px icon, Medium 14/20), kept at the bottom of the scrolling area | Reply all / Reply / Forward under an email or a conversation | `ds/ActionBar` (`ActionBar`, `ActionBarButton`) | An `ActionBar` component |
| `MessageThreadItem` | Actions beside the toggle (a button cannot hold buttons): reply, archive, star, delete, "More" on every row, collapsed or not | Compact conversation of the mock | `ds/MessageThread/MessageThreadItem` (`actions` slot) | Same slot on a twake-ui message list |
| `IconButton` | Dense actions of a sidebar (section titles, refresh of the footer): 24 px box (44 px on touch screens) around a 14 px glyph; `xsmall` is 26 px with a 20 px icon | Search, add and show-hidden of "Folders", add of "Labels", refresh of the storage | `ds/NavSectionAction` | A smaller `IconButton` size for dense toolbars |
| `Button` | Text button of a row, `size="xsmall"` (11 px) in the secondary text colour ("Clean" on the Spam row) | Hover action of a sidebar row, with the full action as the accessible description | `ds/RowTextAction` | None since 18.5 (`xsmall`) |
| `twake-icons` `Label` | The glyph is an outline; the design draws the labels of the sidebar as solid tags, in the colour of the label | `LabelIcon` | `features/labels/LabelIcon` (same path, filled) | A filled `Label` next to `LabelOutlined` |
| Search filter chip (flat, icon, applied) | Filters under the search and above the results: twake-mui's filled chip (32 px, `action.selected`; the Figma draws `background.default`), 16 px icon, chevron for menus; applied = pale primary background, primary text and a cross | `Chip variant="filled"` with an `sx` for the applied tint only; the cross is a decorative `endIcon` (the whole chip is the one control, `aria-pressed`) | `ds/FilterChip`, filled by `features/search/QuickSearchFilters.tsx` and `SearchFiltersBar.tsx` | A `Chip` variant "soft" (neutral and primary), with `onDelete` that does not add a second control |
| Search open panel | The search turns into a white card with a soft shadow holding the field, a divider, the quick filters and the suggestions (Recent with a clock and a date, contacts with an avatar, messages with a date and a clip) | `ds/SearchCombobox` keeps `SearchBar elevation={0} disabledFocus`: the popup starts behind the field (negative `Popper` offset, same width through a modifier) and its `Paper` is the card, the field stays above it with a transparent background; groups can hide their heading (`isLabelHidden`) and options take an `end` slot (`aria-hidden`) | `ds/SearchCombobox` | `SearchBar` open variant (no focus border) and a suggestions panel slot; `SearchRow` is 700 px wide |
| Anchored dialog | The advanced search opens as a card over the search field, same corner and width, no dimmed backdrop | `Popover` (modal, focus trap, Escape, focus return) with `role="dialog"`, a hidden `h2` naming it, a fade and 560 px at least, the Paper elevation and `radius.lg` of the theme; a full screen `Dialog` on phones. `StandardDialog` and `FixedDialog` are centred with a backdrop | `ds/AnchoredDialog`, filled by `features/search/AdvancedSearchDialog.tsx` | A `Dialog` placement `anchorEl`, or a named `Popover` |
| Form row with the label on the left | Advanced search rows: label column, icon, flat control with a line under it | `Typography component="label"` + `TextField variant="standard"` in a grid that stacks on phones (the field is twake-mui's, untouched) | `ds/FormRow` (without `htmlFor`, a plain text with an `id` naming a listbox) | A `TextField` layout "label start" with an icon slot |
| One line row of chips that scrolls | The search filters stay on one line (Figma), at every width | `Box role="toolbar"` with `flex nowrap`, `overflow-x: auto`, `overflow-y: hidden` (no second bar), `scrollbar-width: thin`, a little padding so the focus ring is not cut | `ds/ScrollRow`, filled by `features/search/SearchFiltersBar.tsx`; the order of the results is a `ToolbarButton` with a menu at the end of the list toolbar (`features/search/SearchSortButton.tsx`) | A `Chip` list / toolbar container with horizontal scrolling |

## Composer pixel pass (batch E4)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `IconButton` | A `label` giving the tooltip and the accessible name, and a pressed look (light blue, dark blue icon) bound to `aria-pressed`; the size is twake-mui's `size="small"` (40 px around a 24 px icon) | Title bar (minimize, expand, close) and footer (formatting, attach, image, link, emoji, Drive, assistant, delete, More) of the composer | `ds/ActionIconButton` | `IconButton` with a `label`, and a `selected` style bound to `aria-pressed` |

## Composer on phones and tablets (batch E5)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| Top bar of a full-screen form | A 56 px bar: the way out at the start, the actions (44 px targets) at the end, on the page background (Figma phone composer) | The composer on a phone: close, Aa, attach, image, Drive, Send, More | `ds/TopActionBar` | An `AppBar`-like `variant="form"` (start slot, end actions) |
| `Button` | A round icon-only primary button: a 32 px disc inside a 44 px touch target (a transparent border and `background-clip: padding-box`) | Send on a phone | `ds/PillButton` (`isIconOnly`) | `IconButton color="primary" variant="contained"` with a target larger than its disc |
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
| `Dialog` + `Drawer` | The card of a contact (avatar, name, address with a copy button, full width action buttons): a centred 383 px dialog on tablets and desktops, a bottom sheet with 12 px top corners on phones, one component for both (`ContactPopover` of twake-mui opens on hover, has fixed actions and no bottom sheet); named by the name of the person, focus trapped, Escape and close button, focus given back | The address of the sender and of the recipients of an email, in the reading view | `ds/ContactCard` (filled by `features/email/EmailAddressCard.tsx`: avatar, actions and their links) | A `ContactCard`, or a `Dialog` variant that turns into a bottom sheet on phones |

## Tree view keyboard (batch D6, issue #102)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `Nav` + `NavItem` (`role="tree"` / `role="treeitem"`) | The WAI-ARIA APG tree view keyboard pattern over a flat list of rows with `aria-level`: one tab stop (roving `tabindex`, on the row last focused, else the selected one, else the first; the links and buttons of the other rows out of the tab sequence), Down / Up / Home / End, Right (expand, or first child) and Left (collapse, or parent), Enter (follow the link of the row), typeahead, and the focus handed to the neighbouring row when the focused one goes away. The row, not its link, holds the focus (ring on the row) and is named by its link | The folder trees of the sidebar (system folders, folders of the user, team mailboxes, search results of folders) | `ds/NavTree` (keys in `ds/NavTree/navTreeKeys.ts`, the DOM kept in step by a `MutationObserver`), `ds/NavTreeItem` (`data-nav-toggle` on the arrow, `aria-labelledby`, focus ring); used by `features/mailbox/MailboxTree.tsx` and `MailboxSearch.tsx` | A tree keyboard behaviour on `Nav` with `role="tree"` (keys, roving `tabindex`, focus kept on removal), and a focus ring on a focused `NavItem` |

## Composer RGAA fixes (batch E8, issues #159 to #163)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `TextField` in a `Popper` toolbar | The alternative text of the selected image: a labelled field, with a hidden help (`aria-describedby`), written by Enter, cancelled by Escape, and a place in the tab path of the image toolbar (Tab from the buttons, Shift+Tab back, Tab out to the text) | The image of the body of a message (RGAA 1.1) | `ds/RichTextEditor/ImageToolbar` (`AltTextField`) | An image toolbar with an alternative text field, in the rich text editor |
| `Autocomplete` with chips | A field of chips capped at 3 rows with its own scroll (the focused chip and the input kept in view), announcing in its live region the chips added (one by name, several by count) as well as the one removed, and Escape giving back the chip being edited before it reaches the page | To, Cc and Bcc of the composer with hundreds of recipients (RGAA 10.11, 7.5, 7.3) | `ds/RecipientField` (`MAX_CHIP_ROWS`, `labels.added`, `onCancelEdit`) | The same on a chips `Autocomplete` (`maxRows`, an `added` announcement, a cancel of the edition) |
| Colour swatches | A custom colour next to the swatches: a last radio "Custom color" (named with its value, a rainbow until it holds one), a hexadecimal text field (`#RRGGBB`, `#RGB` or no `#` read, written in capitals, `aria-invalid` and a `role="alert"` message, help read through `aria-describedby`) as the accessible path, and the native `input type="color"` (the system picker, handy on a phone), a polite live region saying the value picked | The colour of a label out of the palette | `ds/ColorSwatchPicker` (`custom`, `hexColor.ts`), used by `features/labels/LabelDialog.tsx` | A `ColorPicker` with a custom colour and a hexadecimal field |
| `ListItemSkeleton` / `ListSkeleton` | A table-row variant (the 44 px row and the narrow multi-line row of the email list, with a bar per column), a `reducedMotion` that stops the pulse, and `aria-hidden` on the shapes with `aria-busy` on the container: the story is a 56 px list item, its shapes are read as empty elements and it pulses whatever `prefers-reduced-motion` | Loading of the email list and of the search results (RGAA 13.8, 4.13) | `ds/ListTableSkeleton` (+ `ButtonSkeleton`), `ds/SkeletonRegion` (busy, hidden, no pulse under `prefers-reduced-motion`), `ds/NavTreeSkeleton` (the 36 px rows of the sidebar), `ds/ReadingSkeleton` (subject, header and body of an open email) | A `variant="table"` of `ListItemSkeleton` taking the columns, and the three accessibility behaviours by default; the skeleton colour of the theme is #eaeaea, the mock's is #e3e3e3 (not changed) |
| `Alert` (offline) | Not a live region of its own (`role="none"`) when a page-level live region says the state, and a fixed position with an offset above a floating button | The offline banner | `ds/OfflineBanner` (`bottomOffset`, no role), mounted by `features/network/OfflineNotice.tsx` | `Snackbar` `persistent` with an `anchor` offset, and a polite `role` for a state that is not an alert |
| Skip link | A link to the main content, first Tab stop of the page and visible only while focused, that focuses its target instead of changing the URL hash (a navigation for the router) | Signed-in pages, to jump over the bars and the sidebar (RGAA 12.7, WCAG 2.4.1) | `ds/SkipLink`, mounted by `layout/AppLayout.tsx` on `main-content` | A `SkipLink` component (label, target id) |

## Navigation landmarks (issue #276)

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `Nav` | A `Nav` without its `<nav>`: it wraps its list in a `<nav>` that takes none of its props, so it cannot be named, and inside a named section it is a second, nested, unnamed navigation landmark (RGAA 12.6, axe `landmark-unique`) | The trees of the sidebar (each section, "Mailboxes", "Team-mailboxes", "Labels", is one named `nav`), the settings sections (desktop sidebar and phone list, in the "Settings" `nav`) | `ds/NavList` (the list of `Nav`, same styles), used by `ds/NavTree`, `features/settings/SettingsNav.tsx` and `SettingsSectionList.tsx` | Pass `aria-label` / `aria-labelledby` to the `<nav>`, or a `component` (or `landmark={false}`) to render the list alone |
| `Content` inside `Main` | `Content` sets `role="main"` and `Main` renders a `<main>`: used together, as `Layout` expects, every page has two nested `main` landmarks (axe `landmark-no-duplicate-main` and `landmark-main-is-top-level`, best-practice rules that the WCAG-tagged e2e check does not run; issue #226) | The main pane of the mail and settings screens, and of the team mailbox embed | `ds/FlatPanes` (`FlatContent` drops the role: the `<main>` of `FlatMain` is the only landmark) | `Content` without `role="main"`, `Main` being the landmark |
| `Alert` / `ListItem` (focus fallback) | The focus given to the nearest control (the next one, else the previous one) when the element goes away while holding it, instead of the page body (RGAA 12.8, issue #215), or to a given target when what replaces it is known (issue #666) | Spam report "Dismiss", vacation "End now", "Empty trash now", Settings > Forwarding "Remove", "Retry" of a message body (to the subject or the message header) | `ds/useFocusFallback` | A focus fallback on dismissible `Alert`s and removable list items |

## Other components

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `Empty` | The empty email list: an empty folder drawing (160 px, not a twake-icons glyph), a 352 px column, an h3 title that keeps the line breaks of its translations, a body1 hint, at the top of the pane on a phone. `Empty` takes only a glyph icon, an h3 title and the theme sizes | Every empty email list: a folder, a filter that leaves nothing, Starred, Action required, a label, a search, offline | `ds/EmptyListView` (+ `EmptyFolderIllustration`), used by `features/thread/EmailList.tsx`, `features/mailbox/StarredList.tsx`, `ActionRequiredList.tsx`, `features/labels/LabelList.tsx`, `features/search/SearchResults.tsx` | An illustration slot and a "list" size on `Empty`, if the other Twake apps want the same look |
| Platform bar metrics | The 48 px bar of `@linagora/twake-bar`: the logotype alone where the sidebar is, the search (half the room, at least 576 px) above the list, then help, settings, apps and account. `TwakeBar` has a home button and a search slot that grows to the menus | The desktop top bar | `ds/AppBarFrame` (`AppBarFrame`, `AppBarLeft`, `AppBarSearch`), used by `layout/AppHeader.tsx` | A sized search slot on `TwakeBar` |
| `Avatar` | twake-mui's `Avatar` in the colour `nameToColor` picks from the address, decorative (`aria-hidden`) by default; the recipient chips draw its letter by CSS so that it stays out of their name | Every avatar of the app | `ds/GradientAvatar`, `ds/RecipientField/RecipientAvatar` | `aria-hidden` by default, and a letter kept out of the accessible text |
| Row state slot | 28 px slots for the answered or forwarded icon and the unread dot, kept empty when the state is off | The lead of a list row | `ds/RowStateSlot`, used by `features/thread/EmailCell.tsx` | With `VirtualizedTable` row layouts |
| Folder visibility tree | Settings > Folder visibility: 40 px rows without divider (52 px with the address of a team mailbox on a second line), a 20 px folder icon greyed when hidden, the expand button right after the name, a small primary "Hide" / "Show" text button with its icon after the text, collapsible 40 px categories ("Folders", "Personal folders", "Team-mailboxes"), in a 315 px column | Settings > Folder visibility | `ds/FolderVisibilityRow`, `ds/CollapsibleCategory`, `ds/VisibilityToggleButton`, `ds/PlainList`, `ds/NarrowColumn`, used by `features/mailbox/FolderVisibilitySettings.tsx` | twake-mui's `ListItem` has neither these metrics nor the nested expand button (the nested row of "Mailbox tree"); a `list-style` utility and a max-width scale in twake-css would spare `PlainList` and `NarrowColumn` |
| Sidebar category | "Personal folders" and "Team-mailboxes" rows under "Folders": a 36 px folder-like row with the chevron after the name, folding the tree under it | The sidebar | `ds/NavCategory`, used by `features/mailbox/MailboxTree.tsx` | With the nested `NavItem` ("Mailbox tree") |
| Sign-in page | The pitch of the product (title, four points with their icons, a drawing) beside a 458 x 684 card, fields with the name inside (`PasswordField` draws its own label and button), the version, "powered by LINAGORA" under the card; the card content alone below the desktop size | The basic authentication form | `ds/LoginLayout`, `ds/LoginFormFrame`, `ds/LoginTextField`, `ds/LoginButton`, used by `features/auth/BasicLoginPage.tsx`; the pictures in `public/assets/images/login/` | A sign-in page layout, a `PasswordField` that keeps its name out of sight |
| Settings menu | The settings column (256 px): a "Back" chip, a title, 36 px link entries with a primary icon (`aria-current` once selected), a divider and "Sign out". twake-mui's `NavItem` and `NavigationList` rows are not links with `aria-current` | Settings, desktop | `ds/ChipBackButton`, `ds/SettingsMenu`, `ds/SettingsIcons`, used by `features/settings/SettingsSidebar.tsx` and `SettingsNav.tsx` | A navigation row that is a link with `aria-current` |
| Settings controls | Rows split by a divider with a 280 px content column, a form row with a label column on the left, a label with a pill ("Forward to [2 recipients]"), key caps, the storage with a cloud in a circle and a thin gauge | Profiles, Email rules, Preferences, Forwarding, Vacation, Language, Keyboard shortcuts, Storage (also the `?` dialog of the shortcuts) | `ds/SettingsList`, `ds/SettingsFields`, `ds/ShortcutList`, `ds/StorageUsage` | A settings list row, a labelled form row, a key cap |
| twake-icons glyphs | The glyphs twake-icons has no glyph for, kept as local SVG components: reply all, forward, spam and not spam (thumbs), the empty checkbox and the checkbox pair of the lists, vertical dots, the full screen arrows, the sort lines, the rules funnel, the sub-addressing envelopes, the keyboard of the settings menu, the text styles and alignments of the editor, the AI scribe actions | The composer, the lists, the settings | `ds/FlutterIcons` (generated), `ds/ReplyIcons`, `ds/ListIcons`, `ds/SettingsIcons`, `ds/ComposerIcons`, `ds/RichTextEditor/editorIcons` | Add these glyphs to twake-icons |
| `Tooltip` anchored in a frame | The tooltip of the links of an email: the address under the link, drawn like the theme's tooltip, on one line, at most 400 px; MUI's `Tooltip` cannot anchor to an element of the iframe of the body | The reading view | `ds/LinkTooltip`, filled by `features/email/EmailBodyFrame.tsx` | A tooltip anchored to an element of another document |
| Compact mail rows | The tiles of phones and tablets: a 48 px avatar that selects the row (a disc with a check once selected, a `role="checkbox"`), then the sender, its marks, the date and a chevron, the subject, one line of preview; 72 px rows, 12 px in on a phone, 24 px on a tablet, the divider within the margins | The email list below the desktop size | `ds/SelectableAvatar`, `ds/CompactRowLines`, `compactRowLayout` of `ds/VirtualizedListTable` | A selectable `Avatar` |
| Empty detail pane | The detail pane with no email open (landscape tablets): "No email selected" alone, an `h4`, centred; `Empty` adds a large icon | Mailbox, label, Starred, Action required and search pages beside the list | `ds/DetailPlaceholder` | An `Empty` variant without icon |
| AI assistant | A menu card of categories (20 px icons, 40 px rows, a chevron for several actions opening a second card beside), the "Help me write" bar (405 px, a 2 px blue-pink-orange gradient frame, a round send button), both above the button that opened them; the answer in a 482 px card (a pulsing sparkle and "Generating response…", copy and retry icons, "Improve", "Replace" and "Insert" buttons). Colours, radius and shadow are the theme's; the gradient frame is the brand look, with no token; rows keep 14 px text (no 14/400 variant) | The composer (`features/composer/ScribeMenu.tsx`) | `ds/AiScribePopover`, `ds/AiScribeMenu`, `ds/AiScribeBar`, `ds/AiScribeSuggestion`, the AI icons of `ds/FlutterIcons` | An AI assistant kit in twake-ui if the other Twake apps get one |
| Theme palette (AI) | No role for the AI nor a purple: the "Action required" tag of the AI takes `info.main` (text `info.contrastText`) | The "Action required" tag of the lists | `features/ai/ActionRequiredTag.tsx` | An AI colour role in the palette |
| Recipient suggestions and tags | Suggestions under the chips and the input (60 px items: a 40 px initials avatar, the name, the address, what is typed in bold), the first one highlighted, the ones already entered ticked; chips 32 px high with the square radius of twake-mui's `Chip` (`radius.md`), a 20 px avatar, a cross, a red border when invalid | The recipient fields of the composer | `ds/RecipientField` (`SuggestionOption`, `RecipientAvatar`, `initials`) | With the chip field asked for above |
| Recipient card | The card of a recipient tag of the composer: 361 px, an avatar, the name in `h5`, the address in `body2` with a copy button, "Edit email" (filled) and "Create a rule" (outlined) buttons, a close button in the corner, under the tag | The recipient tags of the composer | `ds/RecipientCard`, opened by `ds/RecipientField` (`card`) | None |
| Address card look | A 67 px avatar, the name in `h3`, the address in `body2` with a copy button, then full-width 48 px pills on one line each, without icons: "Create a rule with this email" (outlined) above "Compose email" (filled) | The addresses of the reading view | `ds/ContactCard`, filled by `features/email/EmailAddressCard.tsx` | None |
| Scroll bars | A 6 px thumb in `border.main` rounded by 10 px, no track, shown while the pointer is over the area that scrolls (twake-mui draws none) | Every scrolling area, global CSS of the theme | `ds/ScrollbarLook`, through `focusIndicatorThemeOptions` in `app/AppProviders.tsx` | A scroll bar look in the Twake theme |
| `Menu` (bottom sheet) | A menu on phones and tablets: a sheet rising from the bottom edge, a drag handle, the rows of a `Menu`, dividers between the groups, `role="menu"` and arrow keys (twake-mui's `BottomSheet` has neither) | The "More" of the selection bar below the desktop size | `ds/ActionSheet` (a `Drawer` holding a `MenuList`) | A sheet variant of `Menu` |
| `List` (settings entries) | The first level of the settings on phones and tablets: who is signed in (avatar and address), then per section a primary icon, the name, its explanation, a chevron, inset dividers | `/settings` below the desktop size | `ds/SettingsTiles`, filled by `features/settings/SettingsSectionList.tsx` | A list row with a title, an explanation and a chevron |
| `Select` (settings picker) | The language picker: the field shows the short value ("English"), its menu lists "English - English" entries with a primary check after the one picked | Settings > Language | `ds/SettingsFields` (`SettingsMenuSelect`) | A menu variant of `Select` with a trailing check |
| `Dialog` (confirmation) | A confirmation on twake-mui's small `Dialog` with a close cross at the top end: twake-mui's `ConfirmDialog` names and tags its close button itself, so the app cannot give it its own label or `data-testid` | Every confirmation (`ConfirmProvider`) | `ds/ConfirmDialogFrame` | A `ConfirmDialog` whose close button label and test id come from props |
| Account menu | The account button without the platform: a twake-mui `Avatar` (32 px) with the initial, opening a 260 px card (the address and a copy button, a close cross, "Manage account" and "Sign out") | The end of the bar of a desktop without the platform | `ds/ProfileMenu`, filled by `layout/AccountMenu.tsx` | An account menu in twake-mui |
| `Dialog` (form) | A form dialog: the title and a close cross at the top end, a 112 px column of labels before the fields, an option at the start of the bottom and the buttons at the end; the whole screen of a phone with the arrow back | The identity dialog of Settings > Profiles | `ds/FormDialogFrame` (`FormDialogFrame`, `FormFieldRow`) | A form dialog variant of `Dialog` |
| Rich text editor (boxed) | The editor of a signature: a toolbar of 40 px boxes (insert image first, text style, size, font, colour, highlight, bold to strike, alignment, lists; no history, link nor clearing), then a 189 px text, all in one frame rounded by 10 px | The signature of the identity dialog | `ds/RichTextEditor` (`look="boxed"`, `ds/RichTextEditor/boxedToolbar.tsx`) | A compact variant of the editor of twake-ui |
| `Dialog` (settings form) | A rule creator: at most 674 px high, a close cross at the top end, boxes per condition or action, 40 px fields with a thin chevron, outlined buttons adding a row, a "Preview" toggle and its info and success banners (no soft `Alert` without a live region, built from `info.light` and `success.light`), "Cancel" and a confirming button at the end; the whole screen of a phone with an arrow back | The rule dialog | `ds/SettingsFormDialog` | A form dialog variant of `Dialog`, and these fields in the theme |
| Rich text editor (settings look) | The editors of the settings (the message of the vacation): one box rounded by 10 px holding the text and at its bottom one line of buttons (text style, size, font, colour, highlight, bold to strike), white and faded while disabled | Settings > Vacation | `ds/RichTextEditor` (`look="settings"`, `RichTextToolbar` `only` and `isOneLine`) | A compact variant of the editor of twake-ui |
| `Dialog` (folder picker) | A destination picker: 556 px (the whole screen of a phone), the close cross at the start of a 52 px bar and the title in its middle, a filled search field, the folders by folding blocks in 36 px rows with a 20 px blue icon, subfolders folded behind a chevron after the name, the current folder bold with a check | Move To (emails, folder content, folder), the parent of a new folder, the folder of a rule | `ds/FolderPicker`, filled by `features/mailbox/MailboxPickerProvider.tsx` | A tree picker dialog in twake-mui |
| `Menu` (submenu) | A submenu of a menu entry: a 249 px panel with the paper of a `Menu`, at most 400 px high, beside the entry (on its left without room), which shows a small triangle while it is open; hover, ArrowRight / ArrowLeft, Escape | "Label as" in the menus of an email | `ds/MenuSubmenu` | A nested menu in twake-mui |
| `ListItemText` cut with a tooltip | Menu entries that never overflow: a label too long for the menu (at most 300 px) ends with an ellipsis, its full text in a tooltip on hover | The email actions menus | `ds/MenuItemLabel` | An option of `ListItemText` (or `MenuItem`) to cut a label and show it whole on hover |
| `Dialog` (modal) | Modals of a short task (folder and label creation, renaming): a subtitle under the title, labels above (or at the start of) 40 px outlined fields with the `border.main` outline, primary when focused, error on `error.main` without a pale fill, a 14 px regular label (no `body3`) | Folder creation and renaming, label creation and edition | `ds/ModalDialog` | A modal variant of `Dialog` and a field look in the Twake theme |
| `Typography` (14/400) | No 14 px regular variant: `body2` is 14/500 and `body1` 16/400, so the rows that need 14 px regular keep a local size | The rows of the AI assistant menu, the labels of the modal dialogs | `ds/AiScribeMenu`, `ds/ModalDialog` | A 14/400 body variant (`body3`) |
| Recipient field (drag and drop) | Tags dragged between the recipient fields: a `grab` cursor, the dragged tag in primary with a contrast name, the field it may land in outlined in primary (1 px, drawn inside); also Alt + ArrowUp / ArrowDown on a tag, and other things dropped (emails); an `outlined` look for a form | To, Cc, Bcc and Reply to of the composer; From and To of the advanced search | `ds/RecipientField` (`dnd`, `look="outlined"`, `recipientDrag.ts`) | Drag and drop in a field of chips of twake-ui |
| `Menu` (one choice) | A menu of one choice: the chosen entry followed by a primary tick, 400 px high at most | The date, the order and the label of a search | `ds/ChoiceMenu` | A "checked" mark variant of `MenuItem` |
| `Dialog` (contact picker) | The contact view of the "From" and "To" filters: a Dialog (the whole screen of a phone), a title bar with a close button, a pill search field, the contacts as `Avatar`, name and address with a checkbox icon at the end, divided by lines, and "Clear filter" / "Done" | The "From" and "To" filters of the search results | `ds/ContactPickerDialog` | A multiple contact picker in twake-mui |
| Search results | The filters of the results on the grey above the white card of the list (`FlatMain` `header`); the folder of a result in a pill (`ds/MailboxTag`, `action.selected`); the matches on `warning.light` (`ds/Highlight`); the filter chips (`ds/FilterChip`) | The search results, the suggestions of the search field | `ds/FlatPanes`, `ds/MailboxTag`, `ds/Highlight`, `ds/FilterChip`, `features/search/SearchFiltersRow.tsx` | A header slot on the `Layout` card |
| Sidebar look | 36 px rows rounded by 8 px, a 16 px icon 8 px before a Medium 14 / 18.4 name, disclosure arrows (16 px in a 24 px box) right after the name, subfolders moved 8 px in per level background included, a second line (the address of a team mailbox) under the name without pushing the arrow, the selected and hovered rows tinted with `action.selected` and `action.hover` (the Figma tint is #1D192B at 8 % and 4 %), the same tint under the counter; section titles 24 px high, 24 px under what precedes them, their 16.67 px actions 8 px apart; a 339 px drawer (375 px on a large tablet) under a 50 px bar | The folder and label trees of the sidebar and of the drawer | `ds/NavTreeItem`, `ds/NavCategory`, `ds/NavSectionHeader`, `ds/NavSectionAction`, `ds/CountBadge`, `ds/NavigationDrawer` | A sidebar kit in twake-ui matching the Linagora design system |
| Sidebar storage | A 24 px cloud, "Storage" 8 px after it in `caption`, a 24 px refresh at the end; 12 px under them a 3 px gauge rounded by 1.5 px (primary, warning past the warning limit, error when full) on the selected tint of the sidebar, 12 px under it what is left, or in `error.main` that the storage is full and how much is used; the version 12 px under it in `overline` | The foot of the sidebar | `ds/SidebarStorage`, `ds/StorageGauge`, `ds/SidebarFooter`, filled by `features/quota/QuotaIndicator.tsx` | A storage block for the footer of a `Nav` |
| `VirtualizedTable` (row reflow on hover) | The desktop row is a flex line: the preview runs up to the date of each row, and up to the actions (26 px, 11 px apart, 16 px before the end) when they replace it on hover; a table sizes a column for every row, so the cell of the date keeps only the end of the row and its content runs out of it, over a hidden copy of the date (then the room of the actions) at the end of the subject | The desktop email list | `ds/RowHoverActions` (`RowHoverSpace`, `endGap`), `features/thread/emailListGeometry` | A per-row trailing slot in `VirtualizedTable`, or rows laid out as flex lines |
| `@linagora/twake-feedback` `FeedbackButton` (layer) | the "Something wrong?" button sits at `zIndex.modal + 1` (1.1.1) with no way to choose: it covers the Send button of the docked composer, the full screen composer, the folder drawer and the dialogs (#430); drawn here just below the drawers (1199), above the app bar and the floating buttons | The feedback button of the webmail shell | `ds/BelowDrawers` (a theme lowering `zIndex.modal`), `features/sentry/FeedbackWidget` | A `zIndex` (or layer) prop on `FeedbackButton` in twake-libs |
| `ButtonBase` (pointer only) | A click target for the mouse and touch only, out of the tab order and hidden from assistive technologies, duplicating a control the keyboard reaches nearby (the avatar of the sender opening its card) | The avatar of the sender of an open email | `ds/PointerShortcut` | A pointer-only option of `ButtonBase` (or an `Avatar` `onClick` that adds no tab stop) |
| PDF page layers | the text layer and the links of a PDF page: the `.textLayer` CSS of pdf.js `web/pdf_viewer.css` (transparent runs placed by its custom properties), and a transparent link over a rectangle of the page, in fractions of it (issue #583) | The PDF attachment preview (selectable text, links) | `ds/PdfPageLayers` (`PdfPageFrame`, `PdfTextLayer`, `PdfLinkArea`), `features/email/PdfPage` | A PDF viewer in twake-ui (shared by Mail, Drive and Chat) |
| `Main` (one landmark) | A component that is sometimes the whole page and sometimes inside a layout (an error screen) needs to know whether a `main` landmark is already around it: `Main` does not tell its content, so the full-page errors had no landmark, or would have two nested inside the layout (issue #652) | The full-page errors (SSO unreachable, crash, configuration, session, sign-in, intents) and the facade of a team mailbox | `ds/MainLandmark` (`MainLandmark`, `InsideMainLandmark`, `useIsInMainLandmark`), provided by `ds/FlatPanes` `FlatMain` and `ds/LoginLayout`, used by `ds/ErrorScreen` under an `h1` | A context exposed by `Main` (or a `landmark` prop on `Empty`'s error variant) |
| `Empty` (icon) | The icon of the empty state is decoration (the title says it all), but `Empty` leaves it exposed: an unnamed `img` in the accessibility tree (issue #652). Worked around with `componentsProps.icon` (`aria-hidden`) | Every full-page or in-view error | `ds/ErrorScreen` | `aria-hidden` on the icon of `Empty` by default |
| `Select` (in a modal field) | The period fields of the recovery form: a 40 px field showing the choice (or a custom range's dates) and a chevron, its menu dropping under it as a card of 44 px entries with a primary check after the choice; a pick of the current choice is reported too (to reopen a custom range); a 40 px framed calendar button beside it (issue #60) | "Recover deleted messages" (deletion and reception dates); the advanced search (label, date and order, #661), its folder a `ModalSelectButton` opening the folder picker | `ds/ModalDialog` (`ModalSelect`, `ModalSelectButton`, `ModalFieldIconButton`) | A field look of `Select` and its menu in the Twake theme |
| Date range picker (none in twake-mui) | Quick ranges as square `Chip`s, two months side by side (one month sheet per field on a phone), `dd/mm/yyyy` `TextField`s joined by an arrow, "Cancel" / "Set date"; the days a grid as the APG date picker dialog (arrows, Home / End, Page Up / Down, Enter) | The custom range of "Recover deleted messages" (issue #60) and of the advanced search (#661), through `features/dateRange/DayRangeDialog` | `ds/DateRangePicker` (`DateRangePickerDialog`, `MonthsCalendar`) | A calendar and a date range picker in twake-mui (MUI X date pickers are not part of it) |
| Mailbox switcher (none in twake-mui) | The "Viewing <name>" pill of the Figma "Teammail 1.1" Delegation page: a 32 px grey pill (avatar, label, chevron) opening a card of the mailboxes by group ("Your mailbox", "Delegated to you", "Team mailboxes"), 56 px entries (avatar, name, address) as `menuitemradio`, the one shown on a blue tint with a tick; a cross beside the pill back to the user's mailbox (tmail-flutter#4977) | The search row of a desktop, the top of the folder drawer below the desktop size | `ds/MailboxSwitcher` | An account switcher in twake-mui (Workplace apps with delegated or shared accounts) |
| People list (none in twake-mui) | A bordered card of people (12 px radius, 56 px rows: a 32 px avatar, the name, the address under it, an action at the end, 1 px dividers), one person alone in such a card (a dialog about them), and the card of such a list still empty (title, text, action) (tmail-flutter#4977) | Settings > Delegation (both tabs, the confirmation of "Delegate access", "Remove delegate access?" and "Remove your access?") | `ds/PeopleList` (`PeopleList`, `PersonCard`, `PeopleEmptyCard`) | A people list in twake-mui |
| `Main` and `Content` forward `sx` | Their `styled` root lets every prop but `monoColumn` / `withTopBar` through, `sx` included: it is applied but also written to the DOM as `sx="[object Object]"` (issue #515) | The panes of every screen | `ds/FlatPanes` wraps them in `styled(Main)` / `styled(Content)`, which applies the `sx` and stops it | A `shouldForwardProp` that also drops `sx` (MUI's `rootShouldForwardProp`) |

## Dark mode

twake-mui 18 builds both colour schemes (`colorSchemes.light` / `.dark`, CSS
variables, `data-theme` on `<html>`) and the app switches them with MUI's
`useColorScheme()` (the `appearance.theme` setting of the account, no choice
in the app). What is missing around it:

| Component | Variant / need | Intended usage | Where | twake-ui change |
|---|---|---|---|---|
| `TwakeMuiThemeProvider` | The scheme before the first paint: the page starts light (`defaultMode="light"`) until React mounts, and its `mode` prop cannot say `system` | A dark page that never flashes white | An inline script of `public/index.html` (hashed in the CSP) sets `data-theme` and `color-scheme` from the copy of the account setting kept in this browser; `ColorSchemeSync` then calls `setMode()` from a layout effect | An `InitColorSchemeScript` of twake-mui (the MUI one is for SSR) and `mode="system"` |
| Theme | Two values the palette does not carry in the dark scheme: a raised bar (`grey.100`, `grey.800`) and the text of a search match, which stays dark on `warning.light` | The overflow menu of the docked windows, the matches of a search | `theme.applyStyles('dark', …)` in `ds/DockedWindow/WindowOverflowMenu` and `ds/Highlight` | A background role for a raised surface, and a `warning.light` with its contrast text in both schemes |
| `@linagora/twake-embed` | The `twake-space:theme` message of TwakeSpace is received but not exposed by `connectToTwakeSpace` | A framed facade coloured as the page framing it | Not followed: the facade follows the setting of the account | A `onTheme` handler (or the theme in `HelloMessage`) of the connection |
