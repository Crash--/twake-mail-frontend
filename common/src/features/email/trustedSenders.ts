import { useCallback, useSyncExternalStore } from 'react'

/**
 * Senders whose remote content (images, backgrounds, fonts) the user chose
 * to always show, kept in this browser.
 *
 * TODO: keep them in the Linagora JMAP settings (`Settings/set`), so that
 * they follow the user on every device.
 */
export const TRUSTED_SENDERS_STORAGE_KEY = 'twake-mail.remote-content.senders'

type SenderStorage = Pick<Storage, 'getItem' | 'setItem'>

const listeners = new Set<() => void>()
/** Last value read, so that the snapshot is stable between renders */
let cache: { raw: string | null; senders: ReadonlySet<string> } | null = null

function normalize(email: string): string {
  return email.trim().toLowerCase()
}

function getStorage(): SenderStorage | null {
  try {
    return window.localStorage
  } catch {
    // Storage disabled by the browser settings
    return null
  }
}

/** The trusted senders, lower-cased */
export function readTrustedSenders(
  storage: SenderStorage | null = getStorage()
): ReadonlySet<string> {
  const raw = storage?.getItem(TRUSTED_SENDERS_STORAGE_KEY) ?? null
  if (cache?.raw === raw) return cache.senders
  let senders = new Set<string>()
  try {
    const parsed: unknown = raw === null ? [] : JSON.parse(raw)
    if (Array.isArray(parsed)) {
      senders = new Set(
        parsed.filter(item => typeof item === 'string').map(normalize)
      )
    }
  } catch {
    // A broken value is as good as none
  }
  cache = { raw, senders }
  return senders
}

/** Always shows the remote content of `email` from now on */
export function trustSender(
  email: string,
  storage: SenderStorage | null = getStorage()
): void {
  const senders = new Set(readTrustedSenders(storage))
  senders.add(normalize(email))
  try {
    storage?.setItem(TRUSTED_SENDERS_STORAGE_KEY, JSON.stringify([...senders]))
  } catch (error: unknown) {
    console.warn('[email] Cannot remember the trusted sender', error)
  }
  listeners.forEach(listener => {
    listener()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // Another tab trusted a sender
  const handleStorage = (event: StorageEvent): void => {
    if (event.key === TRUSTED_SENDERS_STORAGE_KEY) listener()
  }
  window.addEventListener('storage', handleStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', handleStorage)
  }
}

export interface TrustedSender {
  isTrusted: boolean
  /** Always shows the remote content of this sender */
  trust: () => void
}

/** Whether the remote content of `email` is always shown */
export function useTrustedSender(email: string | null): TrustedSender {
  const senders = useSyncExternalStore(subscribe, () => readTrustedSenders())
  const trust = useCallback(() => {
    if (email !== null) trustSender(email)
  }, [email])
  return {
    isTrusted: email !== null && senders.has(normalize(email)),
    trust
  }
}
