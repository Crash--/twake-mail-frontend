/**
 * Where the open composers are kept in the browser, so that a reload, a
 * crash or a closed tab does not lose what was typed (`docs/composer-drafts.md`).
 *
 * IndexedDB, one record per composer, keyed by `[accountId, composerId]`.
 * It holds the message as the composer builds it (recipients, subject, body,
 * options, the ids of the files already uploaded, the id of the server draft):
 * never the content of a file. Records older than `COMPOSER_TTL_MS` are
 * dropped, signing out clears everything (`clearComposerStorage`), and
 * nothing here logs what it stores.
 *
 * Without IndexedDB (a private window of an old browser, Node tests) the
 * records live in memory: the composers work, only a reload loses them.
 * Kept apart from the rest of the composer: the provider, in the main chunk,
 * needs these only.
 */

const DATABASE = 'twake-mail-composers'
const STORE = 'composers'

/** A composer left in the browser this long is not reopened (tmail-flutter: 24 h) */
export const COMPOSER_TTL_MS = 24 * 60 * 60 * 1000

/** More than this many characters of body: not kept (the server draft is) */
const MAX_BODY_LENGTH = 2_000_000

/** What the store keeps for a composer */
export interface StoredComposer {
  accountId: string
  composerId: string
  /** The window: its init, mode, title (validated by the provider) */
  entry: unknown
  /** The form (validated by `composerContent`), null before the editor exists */
  snapshot: unknown
  /** `Date.now()` of the last write */
  updatedAt: number
}

const memory = new Map<string, StoredComposer>()
/** Tasks in order: a removal is never overtaken by an earlier write */
let queue: Promise<unknown> = Promise.resolve()
/** Signed out: nothing is written until the next provider starts */
let isSuspended = false
let opening: Promise<IDBDatabase | null> | null = null

function memoryKey(accountId: string, composerId: string): string {
  return `${accountId}|${composerId}`
}

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => {
      resolve(source.result)
    }
    source.onerror = () => {
      reject(source.error ?? new Error('IndexedDB request failed'))
    }
  })
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve()
    }
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    }
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    }
  })
}

function openDatabase(): Promise<IDBDatabase | null> {
  opening ??= new Promise(resolve => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    try {
      const opened = indexedDB.open(DATABASE, 1)
      opened.onupgradeneeded = () => {
        opened.result.createObjectStore(STORE, {
          keyPath: ['accountId', 'composerId']
        })
      }
      opened.onsuccess = () => {
        resolve(opened.result)
      }
      opened.onerror = () => {
        console.warn('Composers cannot be kept in the browser')
        resolve(null)
      }
      opened.onblocked = () => {
        resolve(null)
      }
    } catch {
      resolve(null)
    }
  })
  return opening
}

/** Runs a task after the ones before it; a failure is logged, not rethrown */
function enqueue<T>(task: () => Promise<T>, fallback: T): Promise<T> {
  const run = queue.then(task).catch((error: unknown) => {
    // Quota, storage disabled: the server draft is the fallback. Never the
    // content of the message in the log
    console.warn(
      'Composer storage failed',
      error instanceof Error ? error.name : 'unknown'
    )
    return fallback
  })
  queue = run
  return run
}

function isStored(value: unknown): value is StoredComposer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'accountId' in value &&
    typeof value.accountId === 'string' &&
    'composerId' in value &&
    typeof value.composerId === 'string' &&
    'updatedAt' in value &&
    typeof value.updatedAt === 'number'
  )
}

function isTooBig(snapshot: unknown): boolean {
  return (
    typeof snapshot === 'object' &&
    snapshot !== null &&
    'html' in snapshot &&
    typeof snapshot.html === 'string' &&
    snapshot.html.length > MAX_BODY_LENGTH
  )
}

const LAST_GASP_PREFIX = 'twake-mail-composer-last|'

function lastGaspKey(accountId: string, composerId: string): string {
  return `${LAST_GASP_PREFIX}${accountId}|${composerId}`
}

/**
 * The page is going (reload, closed tab): an IndexedDB transaction started
 * now may be cut short, a `sessionStorage` write is synchronous (tmail-flutter
 * ADR 0009). It is a copy for the next page of this tab only: `listComposers`
 * takes it when it is newer than the record, then drops it.
 */
export function keepComposerBeforeUnload(
  record: Omit<StoredComposer, 'updatedAt'>
): void {
  if (isSuspended || isTooBig(record.snapshot)) return
  if (isBuried(record.accountId, record.composerId)) return
  try {
    const stored: StoredComposer = { ...record, updatedAt: Date.now() }
    sessionStorage.setItem(
      lastGaspKey(record.accountId, record.composerId),
      JSON.stringify(stored)
    )
  } catch {
    // Quota or storage disabled: the IndexedDB write is the only one
  }
}

const TOMBSTONE_PREFIX = 'twake-mail-composer-gone|'

function tombstoneKey(accountId: string, composerId: string): string {
  return `${TOMBSTONE_PREFIX}${accountId}|${composerId}`
}

function isBuried(accountId: string, composerId: string): boolean {
  try {
    return sessionStorage.getItem(tombstoneKey(accountId, composerId)) !== null
  } catch {
    return false
  }
}

/**
 * A composer that is closed, sent, discarded or saved as a template is gone
 * for good: this mark is written synchronously, before the IndexedDB delete
 * (`removeComposer`), which a reload in the next milliseconds may cut short.
 * `listComposers` ignores the marked composers and finishes the delete.
 * `sessionStorage`, like the copy of `keepComposerBeforeUnload`: it only has
 * to survive a reload of this tab.
 */
export function buryComposer(accountId: string, composerId: string): void {
  forgetLastGasps(accountId, composerId)
  try {
    sessionStorage.setItem(
      tombstoneKey(accountId, composerId),
      String(Date.now())
    )
  } catch {
    // Quota or storage disabled: the IndexedDB delete is the only one
  }
}

/** The `[accountId, composerId]` of the marks of this tab */
function readTombstones(): { accountId: string; composerId: string }[] {
  const marks: { accountId: string; composerId: string }[] = []
  try {
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (!key?.startsWith(TOMBSTONE_PREFIX)) continue
      const rest = key.slice(TOMBSTONE_PREFIX.length)
      const cut = rest.lastIndexOf('|')
      if (cut > 0) {
        marks.push({
          accountId: rest.slice(0, cut),
          composerId: rest.slice(cut + 1)
        })
      }
    }
  } catch {
    // No marks
  }
  return marks
}

function dropTombstone(accountId: string, composerId: string): void {
  try {
    sessionStorage.removeItem(tombstoneKey(accountId, composerId))
  } catch {
    // Nothing to drop
  }
}

function takeLastGasps(): StoredComposer[] {
  const taken: StoredComposer[] = []
  try {
    const keys: string[] = []
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (key?.startsWith(LAST_GASP_PREFIX)) keys.push(key)
    }
    for (const key of keys) {
      const raw = sessionStorage.getItem(key)
      sessionStorage.removeItem(key)
      const value: unknown = raw === null ? null : JSON.parse(raw)
      if (isStored(value)) taken.push(value)
    }
  } catch {
    // Nothing to take
  }
  return taken
}

/** One copy of this tab, or every one (`accountId` null) */
function forgetLastGasps(accountId: string | null, composerId = ''): void {
  try {
    const keys: string[] = []
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (!key?.startsWith(LAST_GASP_PREFIX)) continue
      if (accountId === null || key === lastGaspKey(accountId, composerId)) {
        keys.push(key)
      }
    }
    keys.forEach(key => {
      sessionStorage.removeItem(key)
    })
  } catch {
    // Nothing to forget
  }
}

/** Keeps a composer (the record replaces the previous one) */
export function putComposer(
  record: Omit<StoredComposer, 'updatedAt'>
): Promise<void> {
  if (isSuspended || isTooBig(record.snapshot)) return Promise.resolve()
  const stored: StoredComposer = { ...record, updatedAt: Date.now() }
  return enqueue(async () => {
    if (isSuspended) return
    const database = await openDatabase()
    if (!database) {
      memory.set(memoryKey(record.accountId, record.composerId), stored)
      return
    }
    const transaction = database.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put(stored)
    await done(transaction)
  }, undefined)
}

/** Forgets a composer: closed, sent, discarded */
export function removeComposer(
  accountId: string,
  composerId: string
): Promise<void> {
  forgetLastGasps(accountId, composerId)
  return enqueue(async () => {
    memory.delete(memoryKey(accountId, composerId))
    const database = await openDatabase()
    if (!database) return
    const transaction = database.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).delete([accountId, composerId])
    await done(transaction)
  }, undefined)
}

/** Lets the store write again after a sign out */
export function resumeComposerStorage(): void {
  isSuspended = false
}

/**
 * The composers of an account left in the browser, the oldest first. The
 * ones too old are dropped on the way. Also lets the store write again
 * after a sign out.
 */
export function listComposers(accountId: string): Promise<StoredComposer[]> {
  resumeComposerStorage()
  return enqueue(async () => {
    const database = await openDatabase()
    // Discarded just before the previous page went: finish the delete
    for (const mark of readTombstones()) {
      memory.delete(memoryKey(mark.accountId, mark.composerId))
      if (database) {
        const transaction = database.transaction(STORE, 'readwrite')
        transaction.objectStore(STORE).delete([mark.accountId, mark.composerId])
        await done(transaction)
      }
      forgetLastGasps(mark.accountId, mark.composerId)
      dropTombstone(mark.accountId, mark.composerId)
    }
    const all: unknown[] = database
      ? await request(
          database.transaction(STORE, 'readonly').objectStore(STORE).getAll()
        )
      : [...memory.values()]
    // What the previous page of this tab wrote last, when newer
    const newest = new Map<string, StoredComposer>()
    for (const value of all) {
      if (isStored(value)) {
        newest.set(memoryKey(value.accountId, value.composerId), value)
      }
    }
    for (const gasp of takeLastGasps()) {
      const key = memoryKey(gasp.accountId, gasp.composerId)
      const kept = newest.get(key)
      if (kept && gasp.updatedAt < kept.updatedAt) continue
      newest.set(key, gasp)
      if (database) {
        const transaction = database.transaction(STORE, 'readwrite')
        transaction.objectStore(STORE).put(gasp)
        await done(transaction)
      } else {
        memory.set(key, gasp)
      }
    }
    const now = Date.now()
    const mine: StoredComposer[] = []
    for (const value of newest.values()) {
      if (!isStored(value)) continue
      if (now - value.updatedAt > COMPOSER_TTL_MS) {
        void removeComposer(value.accountId, value.composerId)
        continue
      }
      if (value.accountId === accountId) mine.push(value)
    }
    return mine.sort((first, second) => first.updatedAt - second.updatedAt)
  }, [])
}

/**
 * Signing out: every composer of every account goes (tmail-flutter ADR
 * 0112), and nothing is written until `listComposers` runs again.
 */
export function clearComposerStorage(): Promise<void> {
  isSuspended = true
  memory.clear()
  forgetLastGasps(null)
  readTombstones().forEach(mark => {
    dropTombstone(mark.accountId, mark.composerId)
  })
  return enqueue(async () => {
    const database = await openDatabase()
    if (!database) return
    const transaction = database.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).clear()
    await done(transaction)
  }, undefined)
}
