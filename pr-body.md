Closes #227

**Cause**: `sortIdentities` orders identities by `sortOrder`, then `mayDelete`, then name. A team mailbox identity is also made by the server (`sortOrder: 100`, `mayDelete: false`), so the name decided the order: `bob-guests@example.com` sorts before `bob@example.com`. The composer takes `identities[0]`, so new messages, and their drafts, used the team mailbox identity.

**Fix**: when `sortOrder` and `mayDelete` are equal, the identity whose email matches the session username (case-insensitive) now comes first. Name is only the last tie-breaker. `useIdentities` passes `session.username` to `identitiesQueryOptions`. An explicit lower `sortOrder` still wins. Settings > Profiles and the composer default both follow this order.

**Tests**: added two cases to `common/src/features/identities/queries.spec.ts`:
- the user's own identity comes before a team mailbox identity with the same sortOrder and mayDelete
- a lower `sortOrder` still wins over the user's own address

**Checks not run**: I couldn't run any project checks (lint, format:check, typecheck, jest). The sandbox only has Node 12, and installing dependencies (`npm ci`) fails on the `jmap-client-ts` git dependency's `prepare` step. I also wasn't allowed to load Node 24 through nvm. CI needs to confirm the change.

---
*Generated automatically*
