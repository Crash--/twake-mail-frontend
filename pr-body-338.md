Closes #338

**Cause.** The "Show" choice of the remote content banner was kept in `useState` in `EmailMessageBody`. Resizing the window switches the layout (phone, tablet, desktop), which mounts the reading view again: the state was lost and the banner came back.

**Fix.**
- New `useRemoteContentConsent(emailId)` (`common/src/features/email/remoteContentConsent.ts`) stores the choice in the TanStack Query cache, keyed by account and email (`staleTime: 'static'`, `gcTime: Infinity`). It survives remounts and is cleared with the rest of the cache when the session ends.
- `EmailMessageBody` uses it in place of its local state. The choice is still per email; "Always show for this sender" is unchanged.
- New test in `EmailView.spec.tsx`: show the images, mount the view again, and check that the banner does not come back and the images load.

**Checks: not run.** The sandbox only has Node 12 and cannot load nvm's Node 24, so `npm ci` fails while preparing `jmap-client-ts` (`tsdown` needs a newer Node). Lint, prettier, typecheck and Jest have not run on this branch; CI has to validate it. I checked types, import order and Prettier line widths by hand.

---
*Generated automatically*
