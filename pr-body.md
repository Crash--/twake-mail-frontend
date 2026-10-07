Closes #236

## What changes
- `endLocalSession()` (`common/src/features/auth/localSession.ts`) now broadcasts `{ type: 'session-ended', email }` on the `twake-mail-session` channel, with the email of the account that signs out. Before, the message was the bare string `'session-ended'`.
- `onSessionEndedElsewhere()` takes the auth service. It ends the session of its tab only when the message is about the same account. The emails are compared after trimming and ignoring case.
- If either email is unknown (for example an SSO without an `email` claim), the tab still signs out, as before. Signing out one tab too many is safer than leaving one signed in by mistake.
- `AGENTS.md` now describes this behaviour.

## Tests
- `localSession.spec.ts`: covers the same account, a different case, each side unknown, and another account (that tab stays signed in).
- `basicAuth.spec.ts` and `oidcAuth.spec.ts` now expect the new message shape.

## Not run
This sandbox only had Node 12 and no installed dependencies, so I could not run lint, typecheck, Jest, Prettier or the build. I formatted the code by hand to match the Prettier settings. Please rely on CI.

## Known limitation, not fixed here
Signing out still calls `clearComposerStorage()`, which deletes the composers saved in this browser for **every** account. So bob stays signed in, but if alice signs out, the composers saved in IndexedDB for bob are deleted too. Clearing only alice's composers would mean linking the auth email to the JMAP `accountId` that `composerStorage` uses as its key. That is a separate change.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---
*Generated automatically*
