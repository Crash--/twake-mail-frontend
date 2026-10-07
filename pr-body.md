Closes #218

## Cause

Deleting a label, an email rule, an identity or a folder, or hiding a folder, removes the row that holds the button the menu or confirm dialog gives focus back to. Whether focus is lost depends on which finishes first: the JMAP request (and refetch) or the closing transition (MUI restores focus to an opener that is gone, or the portaled menu item unmounts while it has focus). Either way, focus ends up on `<body>`.

## Fix

- New `common/src/utils/keepFocusInPage.ts`:
  - `focusTargetsAround(element)` records, before the row goes, where focus can move: the next row, then the previous row, then the first control of the list, then of the surrounding `nav` or `section` (the section toggle in the sidebar, the heading in Settings).
  - `keepFocusInPage(targets)` watches focus for one second after the action succeeds. Each time focus falls on the body, it gives focus to the first target still in the page. It never takes focus from a real element.
- Labels: `LabelActions.remove` now resolves to whether the label was deleted. The sidebar row uses it.
- Email rules and identities: the delete button passes itself as the `opener`.
- Folders: `FolderActions.run` accepts an optional `opener`. The menu passes its anchor element; a right-click anchor now carries the row too. `remove` and `hide` use it.

"Clear the filter" and the spam banner "Dismiss" are tracked separately in the issue and are not changed here.

## Checks

Not run locally: this environment had no `node_modules` and could not install them with Node 24. `npm run lint`, `format:check`, `typecheck`, `npm test` (including the new `keepFocusInPage.spec.tsx`) and `build` are left to CI.

---
*Generated automatically*

🤖 Generated with [Claude Code](https://claude.com/claude-code)
