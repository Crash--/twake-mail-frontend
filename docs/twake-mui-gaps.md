# twake-mui gaps

Components or variants that `@linagora/twake-mui` (9.16) does not provide yet,
what Twake Mail uses instead, and what it would need. Raw MUI is never used:
the workarounds rely on the MUI components twake-mui re-exports, its own
components, and `@linagora/twake-css` utility classes.

| Component / variant | Intended usage | Used meanwhile | Needed upstream |
|---|---|---|---|
| `AppTitle` (logotype) | Top bar, login card | Rebuilt from twake-icons (`Mail`, `TwakeText`, `MailText`) in `common/src/layout/AppTitle.tsx` | Export `Apptitle`: it exists in `dist/components/Apptitle` but not from the package entry point |
| Top bar / app header | Logo, search, app grid, user menu above the `Layout` | `AppBar position="static" color="inherit" elevation={0}` + `Toolbar` | A top bar matching `Layout`/`Main` (`withTopBar`, 48 px reserved below `lg`), with title, centre and actions slots and its responsive behaviour. The Layout story fakes one with `Box` + `sx` |
| App grid (app switcher) | Links to the other Twake apps from `appList.js` | `IconButton` + `Menu` of `MenuItem` links with the app icon | An app grid popover (icons in a grid, like the Twake Workplace bar) |
| Account menu | Avatar, identity, sign out | `IconButton` + `Avatar` + `Menu` with a `ListItem` header | An account menu with an identity header |
| `SearchBar` labels | Top bar search | `SearchBar` | The clear button label (`Clear search`) and the default input label (`Search`) are hard-coded in English: accept translated labels |
| Centered auth card | Basic login form | `Box` with `u-flex u-flex-items-center u-flex-justify-center u-h-100` + `Paper variant="outlined"` | A centered card layout for sign-in and error pages |
| Full-page loader | Waiting for the SSO, the callback | `CircularProgress` centered with twake-css classes | A full-page spinner |
| Mailbox tree | Sidebar folders | `Nav` (`role="tree"`) of flat `NavItem`s (`role="treeitem"`, `aria-level`), each with an `IconButton` expand arrow outside a `NavLink` holding `NavIcon`, `NavText` and a `Typography` counter; levels indented with twake-css `u-pl-1` to `u-pl-3`, deeper levels share the last one (`common/src/features/mailbox/MailboxTreeItem.tsx`) | Nested, collapsible `NavItem`s (more than the one level of `NavDesktopDropdown`) indented by level without a cap, with an expand toggle slot, an unread counter slot and drop target support |
| Email list row | Rows of the email list: unread marker, sender, subject and preview, date, attachment and star | `Box` (`role="listitem"`) holding a twake `ListItemButton` that navigates on click, and the star `IconButton` next to it (`common/src/features/thread/EmailListItem.tsx`) | A message row (dense, one line on desktop, two on mobile) with selection, unread and starred states. twake's `ListItemButton` has no generic `component` prop, unlike MUI's: a row cannot be a router `Link`, so middle-click and "open in a new tab" do not work |
| Virtualized list | The email list (thousands of rows, loaded page by page) | `Virtuoso` from react-virtuoso, the library twake-mui uses (same version), directly: it is a virtualization engine, not a UI component | A virtualized list (twake-mui only has `VirtualizedTable`, a sortable table with column headers, which does not fit a message list) |
| Unread dot | Unread marker of a list row | `CircleFilled` icon (8 px) in a `Typography color="primary"` | A status dot / badge without a number |
| Email header | Subject, sender with avatar, To/Cc/Bcc lines, date of the reading view | `Typography`, `Avatar`, twake-css flex classes (`common/src/features/email/EmailView.tsx`) | A message header component (identity, recipients, date, actions) |
| Attachment chip | Attachments of an email: name, size, download | `Chip variant="outlined"` with `icon` and `endIcon` | An attachment tile (file type icon, name, size, download and preview actions) |
| Sandboxed HTML viewer | Body of an email | A plain `iframe` (`sandbox`, `srcdoc`, height from its content) styled by a stylesheet inside the email document (`common/src/features/email/emailBody.ts`) | Nothing expected from twake-mui, but the theme (fonts, colours) does not reach inside the iframe: the email document repeats a minimal style |

Icons: every icon needed so far exists in `@linagora/twake-icons` (`Mail`,
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
