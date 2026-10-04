# twake-mui gaps

Components, variants and fixes that `@linagora/twake-mui` (9.16) does not
provide yet, what Twake Mail uses instead, where, and what twake-ui would
need. Outside the local design system, raw MUI is never used: the UI twake-mui
lacks is built in `common/src/ds/` (imported as `@/ds/...`, rules in its
[README](../common/src/ds/README.md)), from the MUI components twake-mui
re-exports, its own components and `@linagora/twake-css` utility classes.
Each `ds/` component says in its header whether it should go upstream.

## Components

| Component / variant | Intended usage | Used meanwhile | Where | Needed upstream |
|---|---|---|---|---|
| `AppTitle` (logotype) | Top bar, login card | Rebuilt from twake-icons (`Mail`, `TwakeText`, `MailText`), one `img` named by a `label` prop | `ds/AppTitle`, wrapped by the injectable `layout/AppTitle.tsx` | Export `Apptitle`: it exists in `dist/components/Apptitle` but not from the package entry point |
| Top bar / app header | Logo, search, app grid, user menu above the `Layout`; a menu button below the desktop size, the folder name and a folded search on phones | `AppBar position="static" color="inherit" elevation={0}` + `Toolbar` with title, search and actions slots, `IconButton`s for the menu and the search | `ds/AppTopBar`, filled by `layout/TopBar.tsx` | A top bar matching `Layout`/`Main` (`withTopBar`, 48 px reserved below `lg`), with title, centre and actions slots and its responsive behaviour (see "Responsive"). The Layout story fakes one with `Box` + `sx` |
| App grid (app switcher) | Links to the other Twake apps from `appList.js` | `IconButton` + `Menu` of `MenuItem` links with the app icon | `ds/AppGridMenu` | An app grid popover (icons in a grid, like the Twake Workplace bar) |
| Account menu | Avatar, identity, keyboard shortcuts, settings switched from the menu (the "Thread" setting until the settings screens exist), sign out | `IconButton` + `Avatar` + `Menu` with a `ListItem` header, extra `items` and `menuitemcheckbox` `toggles` | `ds/AccountMenu` | An account menu with an identity header, items and checkable items |
| `SearchBar` labels | Top bar search | `SearchBar` with `disabledClear` and a translated clear button passed as the input `endAdornment` | `ds/SearchCombobox` | The clear button label (`Clear search`) and the default input label (`Search`) are hard-coded in English: accept translated labels; a slot for buttons after the input (advanced search) |
| Search with suggestions | Search field of the top bar: suggestions while typing, quick filters above them | ARIA 1.2 combobox around `SearchBar`: `role="combobox"` input, grouped `listbox` with `aria-activedescendant`, a free header (filters) in a `Popper` kept next to the field in the DOM (tab order), Escape closing the list before reaching the page, right click focusing the field | `ds/SearchCombobox`, filled by `features/search/SearchField.tsx` | A search field with suggestions (MUI `Autocomplete` cannot host `SearchBar` nor a header of filters); every Twake app with a search needs one |
| Centered auth card | Basic login form | `Box component="main"` with twake-css centering + `Paper variant="outlined"` | `ds/CenteredCard` | A centered card layout for sign-in and error pages |
| Full-page loader | Waiting for the SSO, the session | `CircularProgress` centered with twake-css classes, `aria-busy` | `ds/FullPageLoader` | A full-page spinner |
| Full-page error | Session, crash, configuration errors | `Empty` + `Button` in a `role="alert"` box | `ds/ErrorScreen` | An error variant of `Empty` with a recovery action |
| Mailbox tree | Sidebar folders (and the "Team-mailboxes" tree, its own heading and `role="tree"`) | `Nav` (`role="tree"`) of flat `NavItem`s (`role="treeitem"`, `aria-level`), each with an `IconButton` expand arrow outside a `NavLink` holding `NavIcon`, `NavText` and a `Typography` counter; levels indented with twake-css `u-pl-1` to `u-pl-3`, deeper levels share the last one. The "Folders" title is a heading outside the tree (a `ListSubheader` inside it breaks the tree role) | `features/mailbox/MailboxTreeItem.tsx` (not in `ds/` yet: tied to the router `Link`; to move once `NavLink` takes a level) | Nested, collapsible `NavItem`s (more than the one level of `NavDesktopDropdown`) indented by level without a cap, with an expand toggle slot, an unread counter slot and drop target support; a `Nav` `subheader` that does not end up inside a `role="tree"` list |
| Message list | The email list: thousands of rows loaded page by page, one line per email | `VirtualizedTable` of twake-mui, as in Twake Contacts, through `VirtualizedListTable` with a `RowLink` per row and `RowHoverActions` (also used by the folders of the tree, `in="listItem"`) | `ds/VirtualizedListTable`, `ds/RowLink`, `ds/RowHoverActions`; used by `features/thread/EmailList.tsx` and `EmailCell.tsx` | See "VirtualizedTable" below |
| Unread dot | Unread marker of a list row | `CircleFilled` icon (8 px) in a `Typography color="primary"`, named by a `label` | `ds/StatusDot` | A status dot / badge without a number |
| Readable secondary text | Preview, dates, address lines, hints | `Typography` coloured Grey 900 at 80 % (5.4:1 on white) | `ds/SecondaryText` | Fix `text.secondary` in the theme (see "Accessibility") |
| Email header | Subject, sender with avatar, To/Cc/Bcc lines, date of the reading view | `Typography`, `Avatar` in a CSS grid whose date goes under the recipients on phones, long addresses wrapping | `ds/MessageHeader`, filled by `features/email/EmailView.tsx` | A message header component (identity, recipients, date, actions) that reflows on narrow screens |
| Attachment chip | Attachments of an email: name, size, download | `Chip variant="outlined"` with `icon` and `endIcon`, named "Download <name> (<size>)" | `ds/AttachmentChip` | An attachment tile (file type icon, name, size, download and preview actions) |
| Rich text editor (composer spike) | Composer body: formatting toolbar, link dialog, inline images, quoted email and signature kept as HTML blocks | TipTap 3 (MIT) with `RichTextToolbar` (APG toolbar, roving tabindex), `LinkDialog`, `HtmlBlock` (atom node, sandboxed iframe), `InlineImage`, `cleanPastedHtml` | `ds/RichTextEditor`, used by the DEBUG route `/spike/composer` | A `RichTextEditor` in twake-ui (Twake Chat and Docs need one too), or at least a `Toolbar` with roving focus and toggle/menu buttons; the editor ids (`rich-text-*-button`, `link-dialog-*`, `html-block-edit-*`) are still hard coded in the ds and must become props |
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

## VirtualizedTable

The email list uses `VirtualizedTable` like Twake Contacts (`ContactsTable.tsx`,
`ContactCell.tsx`, `AddressBookPage.tsx`): one cell component switching on
`column.id`, rows given as data objects with a stable `computeItemKey`,
`endReached` loading the next page, no column sort (the server sorts), hover
actions revealed by a `.MuiTableRow-root:hover` rule. Twake Mail needs more
than 9.16 offers; `ds/VirtualizedListTable` composes `VirtualizedTable`
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

| Component | Rule (axe) | Measured | Fix upstream |
|---|---|---|---|
| Theme `text.secondary` (Grey 900 at 64 %), used by `Typography color="textSecondary"`, `TableCell` body, `ListSubheader` | `color-contrast` | 3.6:1 on white, 3.5:1 on Grey 100 (4.5:1 needed) | Grey 900 at 80 % or more (5.4:1). Worked around with `ds/SecondaryText` and the list table |
| `TextField` / `InputLabel` (login form) | `color-contrast` | #868687 on white, 3.63:1 | Same theme fix |
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
| `VirtualizedTable` | (review) | No table name, header neither hideable nor hidden for screen readers only, rows not focusable, no row count | See "VirtualizedTable" above |

## Icons and twake-css

`@linagora/twake-icons` has no text formatting icon (bold, italic,
underline, strike, lists, quote, colour, alignment, size, clear formatting,
undo, redo, insert image): the composer spike draws Material Icons paths
(Apache-2.0, via `@mui/icons-material` MIT) with `SvgIcon` in
`common/src/ds/RichTextEditor/editorIcons.tsx`. twake-icons should get them.

Before the composer, every icon needed existed in `@linagora/twake-icons` (`Mail`,
`MailText`, `TwakeText`, `Pen`, `Apps`, `Logout`, `Email`, `EmailOpen`,
`Warning`, `File`, `Send`, `Paperplane`, `Trash`, `Note`, `Archive`, `Folder`,
`Bottom`, `Right`, `Left`, `Star`, `StarOutline`, `CircleFilled`,
`Attachment`, `Download`). There is no dedicated inbox, spam nor template
icon: `Email`, `Warning` and `Note` stand in.

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
