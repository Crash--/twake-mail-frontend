Closes #238

## What
The star toggles exposed both a state-dependent name ("Mark as starred" / "Unstar") and `aria-pressed`, so screen readers announced "Unstar, toggle button, pressed". Following the WAI-ARIA APG button pattern (and AGENTS.md: "starred is announced through `aria-pressed`"), the toggles keep `aria-pressed` and now have a constant name, **"Starred"** (`email.starred`, already translated in en/fr/ru/vi):

- `common/src/features/email/EmailViewActions.tsx` (reading view header, `email-view-star-button`)
- `common/src/features/thread/EmailCell.tsx` (list rows, `email-list-item-star`)
- `common/src/features/thread/CollapsedMessageActions.tsx` (collapsed conversation messages)

The "Star" / "Unstar" item of the conversation menu (`ConversationView`) is unchanged: it is a plain action with no `aria-pressed`, so its changing name is correct. No `data-testid` changed; the e2e specs only check `aria-pressed` on these buttons.

Unit specs (`EmailList`, `ConversationView`, `EmailViewActions`) updated to the constant name.

## Checks not run
`node_modules` is not installed in this worktree and only Node 12 was available, so I could not run lint, prettier, typecheck, Jest or the build. CI has to confirm them.

---
*Generated automatically*
