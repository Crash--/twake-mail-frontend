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
| Top bar / app header | Logo, search, app grid, user menu above the `Layout` | `AppBar position="static" color="inherit" elevation={0}` + `Toolbar` | `layout/TopBar.tsx` | A top bar matching `Layout`/`Main` (`withTopBar`, 48 px reserved below `lg`), with title, centre and actions slots and its responsive behaviour. The Layout story fakes one with `Box` + `sx` |
| App grid (app switcher) | Links to the other Twake apps from `appList.js` | `IconButton` + `Menu` of `MenuItem` links with the app icon | `ds/AppGridMenu` | An app grid popover (icons in a grid, like the Twake Workplace bar) |
| Account menu | Avatar, identity, sign out | `IconButton` + `Avatar` + `Menu` with a `ListItem` header | `ds/AccountMenu` | An account menu with an identity header |
| `SearchBar` labels | Top bar search | `SearchBar` | `layout/MailSearchBar.tsx` | The clear button label (`Clear search`) and the default input label (`Search`) are hard-coded in English: accept translated labels |
| Centered auth card | Basic login form | `Box component="main"` with twake-css centering + `Paper variant="outlined"` | `ds/CenteredCard` | A centered card layout for sign-in and error pages |
| Full-page loader | Waiting for the SSO, the session | `CircularProgress` centered with twake-css classes, `aria-busy` | `ds/FullPageLoader` | A full-page spinner |
| Full-page error | Session, crash, configuration errors | `Empty` + `Button` in a `role="alert"` box | `ds/ErrorScreen` | An error variant of `Empty` with a recovery action |
| Mailbox tree | Sidebar folders | `Nav` (`role="tree"`) of flat `NavItem`s (`role="treeitem"`, `aria-level`), each with an `IconButton` expand arrow outside a `NavLink` holding `NavIcon`, `NavText` and a `Typography` counter; levels indented with twake-css `u-pl-1` to `u-pl-3`, deeper levels share the last one. The "Folders" title is a heading outside the tree (a `ListSubheader` inside it breaks the tree role) | `features/mailbox/MailboxTreeItem.tsx` (not in `ds/` yet: tied to the router `Link`; to move once `NavLink` takes a level) | Nested, collapsible `NavItem`s (more than the one level of `NavDesktopDropdown`) indented by level without a cap, with an expand toggle slot, an unread counter slot and drop target support; a `Nav` `subheader` that does not end up inside a `role="tree"` list |
| Message list | The email list: thousands of rows loaded page by page, one line per email | `VirtualizedTable` of twake-mui, as in Twake Contacts, through `VirtualizedListTable` with a `RowLink` per row and `RowHoverActions` | `ds/VirtualizedListTable`, `ds/RowLink`, `ds/RowHoverActions`; used by `features/thread/EmailList.tsx` and `EmailCell.tsx` | See "VirtualizedTable" below |
| Unread dot | Unread marker of a list row | `CircleFilled` icon (8 px) in a `Typography color="primary"`, named by a `label` | `ds/StatusDot` | A status dot / badge without a number |
| Readable secondary text | Preview, dates, address lines, hints | `Typography` coloured Grey 900 at 80 % (5.4:1 on white) | `ds/SecondaryText` | Fix `text.secondary` in the theme (see "Accessibility") |
| Email header | Subject, sender with avatar, To/Cc/Bcc lines, date of the reading view | `Typography`, `Avatar`, twake-css flex classes | `features/email/EmailView.tsx` | A message header component (identity, recipients, date, actions) |
| Attachment chip | Attachments of an email: name, size, download | `Chip variant="outlined"` with `icon` and `endIcon`, named "Download <name> (<size>)" | `ds/AttachmentChip` | An attachment tile (file type icon, name, size, download and preview actions) |
| Rich text editor (composer spike) | Composer body: formatting toolbar, link dialog, inline images, quoted email and signature kept as HTML blocks | TipTap 3 (MIT) with `RichTextToolbar` (APG toolbar, roving tabindex), `LinkDialog`, `HtmlBlock` (atom node, sandboxed iframe), `InlineImage`, `cleanPastedHtml` | `ds/RichTextEditor`, used by the DEBUG route `/spike/composer` | A `RichTextEditor` in twake-ui (Twake Chat and Docs need one too), or at least a `Toolbar` with roving focus and toggle/menu buttons; the editor ids (`rich-text-*-button`, `link-dialog-*`, `html-block-edit-*`) are still hard coded in the ds and must become props |
| Sandboxed HTML viewer | Body of an email | A plain `iframe` (`sandbox`, `srcdoc`, `title`, height from its content) styled by a stylesheet inside the email document | `features/email/emailBody.ts` | Nothing expected from twake-mui, but the theme (fonts, colours) does not reach inside the iframe: the email document repeats a minimal style |

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
  labels as props), and body cells in `text.primary`.

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
| Selected `NavLink` (current folder) | `color-contrast` | #0a84ff on `action.selected` #e5e8eb, 2.96:1 | Darker selected text (`primary.dark`) |
| `Nav` `subheader` | `aria-required-children`, `listitem` | A `ListSubheader` `li` inside a `role="tree"` list | Render the subheader outside the list. Worked around: heading outside the `Nav` |
| Focused `TextField` label (composer spike link dialog) | `color-contrast` | #2684e3 on white, 3.82:1 | Same theme fix |
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

Note for the responsive phase: below `lg`, `Main` reserves a 48 px block for
a top bar it expects to be fixed over the layout; the static `AppBar` used
here would then be counted twice.
