/**
 * Where the open composers are kept across a reload (tmail-flutter ADR
 * 0009 and 0112): `sessionStorage`, one entry for the list of composers of
 * an account and one per composer. Kept apart from the rest of the
 * composer: the provider, in the main chunk, needs these only.
 */

const SNAPSHOT_PREFIX = 'twake-mail-composer|'

export function snapshotKey(accountId: string, composerId: string): string {
  return `${SNAPSHOT_PREFIX}${accountId}|${composerId}`
}

/** The open composers of an account, kept across a reload */
export function registryKey(accountId: string): string {
  return `twake-mail-composers|${accountId}`
}

export function writeStorage(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch (error: unknown) {
    // Quota exceeded: the draft on the server is the fallback
    console.warn('Composer not kept for a reload', error)
  }
}

export function readStorage(key: string): unknown {
  try {
    const raw = sessionStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}
