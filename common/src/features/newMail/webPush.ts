import type { JmapClient, Session } from 'jmap-client-ts'

import { WEBPUSH_VAPID_CAPABILITY } from '@common/jmap/pushSubscription'

/** Served from `public/`, at the root: its scope is the whole app */
export const PUSH_WORKER_URL = '/push-worker.js'
/** Tag of the notification the worker shows alone (`public/push-worker.js`) */
export const GENERIC_NOTIFICATION_TAG = 'twake-mail-new-mail'
const RECORDS_KEY = 'twake-mail.push.subscriptions'
/** James keeps a subscription 7 days at most: renewed at each opening */
const LIFETIME_MS = (7 * 24 - 1) * 60 * 60 * 1000
/** A worker that does not activate must not hold the tabs back for ever */
const WORKER_READY_MS = 10_000
/** Signing out never waits longer for the server to forget this browser */
const SIGN_OUT_MS = 3000
/**
 * How long the verification code of a new subscription is waited for,
 * before the subscription counts as lost and is replaced
 */
const VERIFICATION_GRACE_MS = 60_000
const SYNC_LOCK = 'twake-mail-web-push'
const PRESENCE_LOCK = 'twake-mail-web-push-account:'

/**
 * What the service worker tells the pages (`public/push-worker.js`), each
 * with a port for the answer. `accountIds` and `accountId`: the accounts
 * concerned, null when the worker cannot tell.
 */
export type PushWorkerMessage =
  /** Answers: `reading`, then `shown` or `failed` */
  | { type: 'twake-mail-push'; accountIds: string[] | null }
  /** Answers: `opened` */
  | { type: 'twake-mail-open'; url: string; accountId: string | null }
  | {
      type: 'twake-mail-push-verification'
      pushSubscriptionId: string
      verificationCode: string
    }

/**
 * A subscription this browser created on the server: no secret. The server
 * never gives `url` back, so the endpoint is remembered here.
 */
interface PushRecord {
  id: string
  endpoint: string
  /** The server got its verification code back: it pushes */
  isVerified: boolean
  /** When it was created, in ms */
  createdAt: number
}

/** By username: the accounts signed in in this browser share its endpoint */
type PushRecords = Record<string, PushRecord>

/** By username: what signing out undoes, set while a subscription is kept */
const endings = new Map<string, () => Promise<void>>()

/**
 * Verification codes that came before their subscription was known here:
 * the server pushes the code before it answers the creation.
 */
const earlyCodes = new Map<string, string>()

function readRecords(): PushRecords {
  try {
    const raw = window.localStorage.getItem(RECORDS_KEY)
    return raw === null ? {} : (JSON.parse(raw) as PushRecords)
  } catch {
    return {}
  }
}

function writeRecords(records: PushRecords): void {
  try {
    const raw = JSON.stringify(records)
    // Unchanged: no `storage` event for the other tabs
    if (window.localStorage.getItem(RECORDS_KEY) === raw) return
    window.localStorage.setItem(RECORDS_KEY, raw)
  } catch (error: unknown) {
    console.warn('[web push] Cannot remember the subscription', error)
  }
}

function without(records: PushRecords, username: string): PushRecords {
  return Object.fromEntries(
    Object.entries(records).filter(([name]) => name !== username)
  )
}

function toBase64Url(buffer: ArrayBuffer | null): string | null {
  if (buffer === null) return null
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

function toBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64Url.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

/** The VAPID public key of the server (RFC 9749), null without one */
function readServerKey(session: Session): string | null {
  const capability = session.capabilities[WEBPUSH_VAPID_CAPABILITY] as
    { applicationServerKey?: unknown } | undefined
  const key = capability?.applicationServerKey
  return typeof key === 'string' ? key.replace(/=+$/, '') : null
}

function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${what} took more than ${String(ms)} ms`))
    }, ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    )
  })
}

export function isWebPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof PushManager !== 'undefined'
  )
}

/** The worker of this app, null before the first subscription */
export async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) return null
  return (
    (await navigator.serviceWorker.getRegistration(PUSH_WORKER_URL)) ?? null
  )
}

/**
 * Says that a tab of this account is open, until the returned function is
 * called: the other accounts of the browser then keep its endpoint.
 */
export function holdWebPushPresence(username: string): () => void {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) {
    return () => undefined
  }
  const released = new AbortController()
  navigator.locks
    .request(
      PRESENCE_LOCK + username,
      { mode: 'shared', signal: released.signal },
      () =>
        new Promise<void>(resolve => {
          if (released.signal.aborted) resolve()
          released.signal.addEventListener('abort', () => {
            resolve()
          })
        })
    )
    .catch(() => undefined)
  return () => {
    released.abort()
  }
}

/** Those of these accounts that have a tab open */
async function findPresent(usernames: readonly string[]): Promise<Set<string>> {
  // ponytail: without Web Locks (old browsers) nobody else counts as here,
  // so two accounts of one browser take the endpoint from each other
  if (usernames.length === 0 || !('locks' in navigator)) return new Set()
  const { held = [] } = await navigator.locks.query()
  const names = new Set(held.map(lock => lock.name))
  return new Set(usernames.filter(name => names.has(PRESENCE_LOCK + name)))
}

/**
 * Forgets the subscription of this account in this browser, and gives the
 * endpoint up unless another account with a tab open uses it. Resolves the
 * record the server may still have.
 */
async function removeLocally(username: string): Promise<PushRecord | null> {
  const records = readRecords()
  const record = records[username] ?? null
  const others = without(records, username)
  writeRecords(others)
  const registration = await getPushRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    const present = await findPresent(Object.keys(others))
    const isShared = Object.entries(others).some(
      ([name, other]) =>
        present.has(name) && other.endpoint === subscription.endpoint
    )
    if (!isShared) await subscription.unsubscribe()
  }
  return record
}

async function removeWebPush(
  client: JmapClient,
  username: string
): Promise<void> {
  const record = await removeLocally(username)
  if (record !== null) {
    await client.call('PushSubscription/set', { destroy: [record.id] })
  }
}

/**
 * The session of this account ended without a sign-out (credentials
 * refused): the server cannot be told, so the endpoint is given up and its
 * pushes go nowhere.
 */
export async function forgetWebPush(username: string): Promise<void> {
  endings.delete(username)
  await removeLocally(username)
}

/**
 * Before signing out: the server stops pushing to this browser. Never
 * rejects nor waits long, so that it cannot keep the user signed in.
 */
export async function endWebPush(): Promise<void> {
  const pending = [...endings.values()].map(end => end())
  endings.clear()
  await within(Promise.all(pending), SIGN_OUT_MS, 'Removing the push').catch(
    (error: unknown) => {
      console.warn('[web push] Cannot remove the subscription', error)
    }
  )
}

async function syncUnlocked(
  client: JmapClient,
  session: Session,
  isWanted: boolean,
  texts: { title: string; body: string }
): Promise<void> {
  const username = session.username
  if (!isWanted) {
    endings.delete(username)
    await removeWebPush(client, username)
    return
  }
  endings.set(username, () => removeWebPush(client, username))
  const serverKey = readServerKey(session)
  const registration = await navigator.serviceWorker.register(
    `${PUSH_WORKER_URL}?${new URLSearchParams(texts).toString()}`
  )
  await within(navigator.serviceWorker.ready, WORKER_READY_MS, 'The worker')

  earlyCodes.clear()
  const stored = readRecords()
  const present = await findPresent(
    Object.keys(stored).filter(name => name !== username)
  )
  // The accounts that left without signing out are forgotten
  const records = Object.fromEntries(
    Object.entries(stored).filter(
      ([name]) => name === username || present.has(name)
    )
  )
  let subscription = await registration.pushManager.getSubscription()
  if (subscription !== null) {
    const endpoint = subscription.endpoint
    const browserKey = toBase64Url(subscription.options.applicationServerKey)
    const owners = Object.entries(stored).filter(
      ([, record]) => record.endpoint === endpoint
    )
    // Kept only when every account known to use it is here: the server of
    // one that left may still push to it. A browser that does not tell the
    // key of its subscription keeps it
    if (
      (browserKey !== null && browserKey !== serverKey) ||
      owners.length === 0 ||
      owners.some(([name]) => name !== username && !present.has(name))
    ) {
      await subscription.unsubscribe()
      subscription = null
    }
  }
  if (subscription === null) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        ...(serverKey === null
          ? {}
          : { applicationServerKey: toBytes(serverKey) })
      })
    } catch (error: unknown) {
      writeRecords(records)
      console.info('[web push] No push subscription from this browser', error)
      return
    }
  }

  const known = records[username] ?? null
  // Just created, here or in another tab of the account: its code is on
  // its way
  if (
    known?.endpoint === subscription.endpoint &&
    !known.isVerified &&
    Date.now() - known.createdAt < VERIFICATION_GRACE_MS
  ) {
    writeRecords(records)
    return
  }
  // Never verified (the page closed before the code came): a new one,
  // whose code the server pushes again
  if (known?.endpoint === subscription.endpoint && known.isVerified) {
    const expires = new Date(Date.now() + LIFETIME_MS)
      .toISOString()
      .replace(/\.\d+Z$/, 'Z')
    const renewed = await client.call('PushSubscription/set', {
      update: { [known.id]: { expires } }
    })
    if (renewed.notUpdated?.[known.id] === undefined) {
      writeRecords(records)
      return
    }
  }

  const keys = subscription.toJSON().keys
  const response = await client.call('PushSubscription/set', {
    create: {
      push: {
        deviceClientId: crypto.randomUUID(),
        url: subscription.endpoint,
        keys:
          keys?.p256dh !== undefined && keys.auth !== undefined
            ? { p256dh: keys.p256dh, auth: keys.auth }
            : null,
        types: ['EmailDelivery']
      }
    },
    ...(known === null ? {} : { destroy: [known.id] })
  })
  const created = response.created?.push
  if (created === undefined) {
    writeRecords(without(records, username))
    console.warn('[web push] Subscription refused', response.notCreated?.push)
    return
  }
  writeRecords({
    ...records,
    [username]: {
      id: created.id,
      endpoint: subscription.endpoint,
      isVerified: false,
      createdAt: Date.now()
    }
  })
  const earlyCode = earlyCodes.get(created.id)
  if (earlyCode !== undefined) {
    await confirmWebPush(client, username, created.id, earlyCode)
  }
}

/**
 * Brings the web push of this browser in line with what the user wants: a
 * JMAP push subscription (RFC 8620 §7.2) to the push service of the browser,
 * for the deliveries of emails only, so that the server wakes the service
 * worker with every tab closed. Renews it when it exists, and removes it
 * when notifications are off. `texts` are what the worker shows alone.
 *
 * A browser has one endpoint, which the accounts with a tab open share: an
 * endpoint left by an account that is gone is replaced, as its server may
 * still push to it.
 *
 * Without the VAPID key of the server (RFC 9749) the browser is asked for
 * an unsigned subscription, which only some give (Firefox).
 */
export async function syncWebPush(
  client: JmapClient,
  session: Session,
  isWanted: boolean,
  texts: { title: string; body: string }
): Promise<void> {
  if (!isWebPushSupported()) return
  // One tab at a time: two would create two subscriptions of one endpoint
  // ponytail: without Web Locks (old browsers), the tabs may do so
  if (!('locks' in navigator)) {
    await syncUnlocked(client, session, isWanted, texts)
    return
  }
  await navigator.locks.request(SYNC_LOCK, () =>
    syncUnlocked(client, session, isWanted, texts)
  )
}

/**
 * Proves to the server that this browser gets its pushes: the code it
 * pushed to the worker goes back to it (RFC 8620 §7.2.2). The worker tells
 * every page: only the account of the subscription answers.
 */
export async function confirmWebPush(
  client: JmapClient,
  username: string,
  pushSubscriptionId: string,
  verificationCode: string
): Promise<void> {
  if (readRecords()[username]?.id !== pushSubscriptionId) {
    earlyCodes.set(pushSubscriptionId, verificationCode)
    return
  }
  earlyCodes.delete(pushSubscriptionId)
  const response = await client.call('PushSubscription/set', {
    update: { [pushSubscriptionId]: { verificationCode } }
  })
  if (response.notUpdated?.[pushSubscriptionId] !== undefined) return
  const records = readRecords()
  const record = records[username]
  if (record?.id === pushSubscriptionId) {
    writeRecords({ ...records, [username]: { ...record, isVerified: true } })
  }
}

/**
 * Calls back when another tab replaced the endpoint of the browser, or
 * forgot the subscription of this account: this tab then brings its own in
 * line. Not when a tab of the same account only wrote about the same
 * endpoint (created, verified).
 *
 * @returns a function that stops listening
 */
export function onWebPushChangedElsewhere(
  username: string,
  listener: () => void
): () => void {
  const handleStorage = (event: StorageEvent): void => {
    if (event.key !== RECORDS_KEY) return
    const records = readRecords()
    const mine = records[username]
    if (
      mine === undefined ||
      Object.values(records).some(other => other.endpoint !== mine.endpoint)
    ) {
      listener()
    }
  }
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener('storage', handleStorage)
  }
}
