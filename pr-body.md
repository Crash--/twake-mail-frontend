Closes #375

## Cause
`AnchoredDialog` (`@/ds/`) renders MUI `Popover`, whose invisible backdrop covers the whole page. A row of the list never got the mouse down, so no drag started and the `DRAGGED_EMAILS_TYPE` drop support of From / To in `AdvancedSearchDialog` could not be used on desktop.

## Fix
- The Popover root, backdrop included, is set to `pointer-events: none`. The paper is set back to `auto`, so the page around the panel takes the pointer and a row can be dragged onto From / To.
- A `ClickAwayListener` now closes the panel on a click outside, which the backdrop used to do. A drag fires no click, so the panel stays open while you drop. Escape, the focus trap, focus return and `aria-hidden` on the rest of the page do not change.
- New spec in `AnchoredDialog.spec.tsx`: the root lets the pointer through, a click inside keeps the panel open, a click outside closes it.

Side effect for review: a click on an email of the list while the panel is open now opens that email as well as closing the panel. Before, the backdrop swallowed that click.

## Checks
I could **not** run any checks in this session. The only Node available was v12, and switching to Node 24 through nvm needed an approval I did not have, so `npm ci` never ran. Lint, format, typecheck, Jest, build and e2e were not run: CI has to validate this PR, and the new spec has not been run yet.

---
*Generated automatically*
