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
    const all: unknown[] = database
      ? await request(
          database.transaction(STORE, 'readonly').objectStore(STORE).getAll()
        )
      : [...memory.values()]
    const now = Date.now()
    const mine: StoredComposer[] = []
    for (const value of all) {
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
  return enqueue(async () => {
    const database = await openDatabase()
    if (!database) return
    const transaction = database.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).clear()
    await done(transaction)
  }, undefined)
}
