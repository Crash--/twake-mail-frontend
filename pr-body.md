Closes #378

> **Duplicate of #379.** An earlier automated session already opened #379 with the same component change (`placement="top"` + `disableInteractive`). The only difference is the test: #379 asserts `getComputedStyle(tooltip).pointerEvents === "none"`, which depends on jsdom resolving the emotion style. This PR asserts that MUI did not add the `MuiTooltip-popperInteractive` class, which is set from the props and does not depend on that. Keep whichever has green CI and close the other.

## Change
`common/src/ds/RecipientCard/RecipientCard.tsx`: the "Copy the email address" tooltip now opens **above** the copy button (`placement="top"`), so it no longer covers "Edit email" / "Create a rule". It is also **non-interactive** (`disableInteractive`): it closes when the pointer leaves the button, and it lets clicks through even when the keyboard focus keeps it open (variant 4 of the issue).

## Test
`RecipientCard.spec.tsx`: hovering the copy button shows the tooltip, and the tooltip is not interactive.

## Checks
**Not run locally.** This sandbox only had Node 12, and the Node 24 toolchain (nvm) was not reachable, so `npm ci`, lint, the format check, typecheck and Jest could not run. I checked the formatting by hand against Prettier's style. CI is the first real check.

---
*Generated automatically*
