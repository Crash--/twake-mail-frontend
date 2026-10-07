Closes #212

## What was wrong

After the open email was trashed, deleted forever, archived or moved, the view went back to the list and the focus landed on `<body>`:

- The conversation view (thread setting on) goes back with `focusEmailId` set to the email that just left. That row cannot be found, so nothing gets the focus.
- In the email view, when no neighbour is known, it went back with no state, so again nothing gets the focus.
- `useFocusRowOnMount` only gave the focus back after a row was **unmounted**. When a menu ("More") or a confirmation dialog ("Delete permanently") closes while the list shows, MUI drops the focus on the body, because the opener is gone. The row stays mounted, so its focus was never given back.

## Fix

- `EmailList`: when the email to focus is no longer in the list, the focus goes to its first row.
- `useEmailViewShortcuts`: always goes back with a focus target. Without a known neighbour, it uses the email itself, which falls back to the first row.
- `VirtualizedListTable` (`useFocusRowOnMount`): while the frames last (now 60, about 1 s), any focus that ends up on `<body>` goes back to the row. The row is looked up at its latest index, because rows above it may have left in the meantime.

Not covered: if the folder ends up empty, there is no row to focus.

## Checks

**Not run.** Node 24 was not available in the session that made this change, and I could not install dependencies. So lint, prettier, typecheck, jest and build were **not run**. Please rely on CI.

Added two specs in `EmailList.spec.tsx`:

- the first row gets the focus when the email to focus left the list;
- the row gets the focus back after it was dropped on the body.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---
*Generated automatically*
