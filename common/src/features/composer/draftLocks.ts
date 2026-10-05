/**
 * A draft is edited by one composer at a time: two would destroy each
 * other's versions (each save destroys the previous one). Inside a tab the
 * composers say which draft they hold (`ComposerProvider`); between tabs a
 * Web Lock named after the draft says it, held while a composer edits it.
 */

/** Releases a lock; nothing happens the second time */
export type ReleaseLock = () => void

function lockName(accountId: string, draftId: string): string {
  return `twake-mail-draft|${accountId}|${draftId}`
}

/**
 * Takes the lock of a draft for as long as it is edited. Resolves null
 * when another tab holds it; resolves a no-op where the browser has no Web
 * Locks (only the composers of the tab are then known).
 */
export function acquireDraftLock(
  accountId: string,
  draftId: string
): Promise<ReleaseLock | null> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  // Not in every browser (nor in jsdom)
  if (!locks) return Promise.resolve(() => undefined)
  return new Promise(resolve => {
    let release: () => void = () => undefined
    const held = new Promise<void>(done => {
      release = done
    })
    locks
      .request(lockName(accountId, draftId), { ifAvailable: true }, lock => {
        if (lock === null) {
          resolve(null)
          return undefined
        }
        resolve(release)
        return held
      })
      .catch((error: unknown) => {
        console.warn('Draft lock failed', error)
        resolve(() => undefined)
      })
  })
}
