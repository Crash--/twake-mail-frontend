Closes #374

## Cause
The root of a team mailbox (e.g. `bob-guests`, namespace `TeamMailbox[…]`) holds no email; its folders (INBOX, Sent…) do. Picking the root in the search folder picker produced `{"inMailbox": "<root id>"}`, so the search found nothing.

## Fix
- `mailboxTree.ts`: `findTeamFolderIds(mailboxes)` maps each team root id to the ids of its folders (any depth), with its Trash/Spam left out like the default "All email" search.
- `useSearchContext.ts`: the `SearchContext` now carries `teamFolderIds`.
- `searchFilter.ts`: when the scope is a team root with folders, `toJmapFilter` ANDs an `OR` of `inMailbox` conditions (one per folder) instead of `inMailbox: <root>`. Other folders still use a single `inMailbox`, so nothing changes for them.

The picker already lists the team sub-folders: they are folded under the root (chevron, or ArrowRight with the keyboard), so picking one of them already worked. This PR fixes the root choice.

## Tests
- `mailboxTree.spec.ts`: `findTeamFolderIds` lists nested folders and leaves the team Trash out.
- `searchFilter.spec.ts`: a team root scope becomes an `OR` of `inMailbox`; a root without folders keeps `inMailbox`.

## Checks
**Not run.** Only Node 12 is on the PATH in this environment, and switching to Node 24 with nvm needed an approval I did not have, so `npm ci` failed. I did not run lint, prettier, typecheck or Jest locally. I checked types and formatting by hand (`noUncheckedIndexedAccess`, the tuple type for `Object.fromEntries`, Prettier line widths). CI needs to confirm.

---
*Generated automatically*
