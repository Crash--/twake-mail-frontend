import type { JmapClient, Session } from 'jmap-client-ts'

import { WEBPUSH_VAPID_CAPABILITY } from '@common/jmap/pushSubscription'

/** Served from `public/`, at the root: its scope is the whole app */
export const PUSH_WORKER_URL = '/push-worker.js'
const RECORD_KEY = 'twake-mail.push.subscription'
/** James keeps a subscription 7 days at most: renewed at each opening */
const LIFETIME_MS = (7 * 24 - 1) * 60 * 60 * 1000

/** What the service worker tells the pages (`public/push-worker.js`) */
export type PushWorkerMessage =
  | { type: 'twake-mail-push' }
  | { type: 'twake-mail-open'; url: string }
  | {
      type: 'twake-mail-push-verification'
      pushSubscriptionId: string
      verificationCode: string
    }

/**
 * The subscription this browser created on the server: no secret, the
 * server never gives `url` back, so the endpoint is remembered here.
 */
interface PushRecord {
  id: string
  endpoint: string
  username: string
  /** The server got its verification code back: it pushes */
  isVerified: boolean
}

function readRecord(): PushRecord | null {
  try {
    const raw = window.localStorage.getItem(RECORD_KEY)
    return raw === null ? null : (JSON.parse(raw) as PushRecord)
  } catch {
    return null
  }
}

function writeRecord(record: PushRecord | null): void {
  try {
    if (record === null) window.localStorage.removeItem(RECORD_KEY)
    else window.localStorage.setItem(RECORD_KEY, JSON.stringify(record))
  } catch (error: unknown) {
    console.warn('[web push] Cannot remember the subscription', error)
  }
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

/** Set while this page keeps a subscription: what signing out undoes */
let endSubscription: (() => Promise<void>) | null = null

/**
 * Before signing out: the server stops pushing to this browser. Never
 * rejects, so that it cannot keep the user signed in.
 */
export async function endWebPush(): Promise<void> {
  const end = endSubscription
  endSubscription = null
  await end?.().catch((error: unknown) => {
    console.warn('[web push] Cannot remove the subscription', error)
  })
}

async function removeWebPush(
  client: JmapClient,
  username: string
): Promise<void> {
  const record = readRecord()
  writeRecord(null)
  const registration = await getPushRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  await subscription?.unsubscribe()
  if (record?.username === username) {
    await client.call('PushSubscription/set', { destroy: [record.id] })
  }
}

/**
 * Brings the web push of this browser in line with what the user wants: a
 * JMAP push subscription (RFC 8620 §7.2) to the push service of the browser,
 * for the deliveries of emails only, so that the server wakes the service
 * worker with every tab closed. Renews it when it exists, and removes it
 * when notifications are off. `texts` are what the worker shows alone.
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
  if (typeof navigator.locks === 'undefined') {
    await syncUnlocked(client, session, isWanted, texts)
    return
  }
  await navigator.locks.request('twake-mail-web-push', () =>
    syncUnlocked(client, session, isWanted, texts)
  )
}

async function syncUnlocked(
  client: JmapClient,
  session: Session,
  isWanted: boolean,
  texts: { title: string; body: string }
): Promise<void> {
  if (!isWanted) {
    endSubscription = null
    await removeWebPush(client, session.username)
    return
  }
  endSubscription = () => removeWebPush(client, session.username)
  const serverKey = readServerKey(session)
  const registration = await navigator.serviceWorker.register(
    `${PUSH_WORKER_URL}?${new URLSearchParams(texts).toString()}`
  )
  await navigator.serviceWorker.ready

  const record = readRecord()
  const known = record?.username === session.username ? record : null
  let subscription = await registration.pushManager.getSubscription()
  // Another account, or another key of the server: the endpoint is given up
  if (
    subscription !== null &&
    (record?.username !== session.username ||
      toBase64Url(subscription.options.applicationServerKey) !== serverKey)
  ) {
    await subscription.unsubscribe()
    subscription = null
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
      console.info('[web push] No push subscription from this browser', error)
      return
    }
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
    if (renewed.notUpdated?.[known.id] === undefined) return
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
    writeRecord(null)
    console.warn('[web push] Subscription refused', response.notCreated?.push)
    return
  }
  writeRecord({
    id: created.id,
    endpoint: subscription.endpoint,
    username: session.username,
    isVerified: false
  })
}

/**
 * Proves to the server that this browser gets its pushes: the code it
 * pushed to the worker goes back to it (RFC 8620 §7.2.2).
 */
export async function confirmWebPush(
  client: JmapClient,
  pushSubscriptionId: string,
  verificationCode: string
): Promise<void> {
  const response = await client.call('PushSubscription/set', {
    update: { [pushSubscriptionId]: { verificationCode } }
  })
  const record = readRecord()
  if (
    record?.id === pushSubscriptionId &&
    response.notUpdated?.[pushSubscriptionId] === undefined
  ) {
    writeRecord({ ...record, isVerified: true })
  }
}
