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
| Mailbox tree | Sidebar folders (next phase) | Empty `Nav` with a `ListSubheader` | Nested, collapsible `NavItem`s (more than the one level of `NavDesktopDropdown`), with an unread counter and drop target support |

Icons: every icon needed so far exists in `@linagora/twake-icons` (`Mail`,
`MailText`, `TwakeText`, `Pen`, `Apps`, `Logout`, `Email`, `EmailOpen`,
`Warning`).

Note for the responsive phase: below `lg`, `Main` reserves a 48 px block for
a top bar it expects to be fixed over the layout; the static `AppBar` used
here would then be counted twice.
