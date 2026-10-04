import { useCallback, useSyncExternalStore } from 'react'

/**
 * The "Thread" preference of tmail-flutter (Settings > Preferences): show
 * the emails of a conversation together. Off by default, kept in this
 * browser as tmail-flutter does (`PREFERENCES_SETTING_THREAD`).
 *
 * TODO: keep it in the Linagora JMAP settings (`Settings/set`) with the
 * other preferences, once they exist (phase 4).
 */
export const THREAD_PREFERENCE_STORAGE_KEY = 'twake-mail.preferences.thread'

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

const listeners = new Set<() => void>()

function getStorage(): PreferenceStorage | null {
  try {
    return window.localStorage
  } catch {
    // Storage disabled by the browser settings
    return null
  }
}

/** Whether conversations are on */
export function readThreadPreference(
  storage: PreferenceStorage | null = getStorage()
): boolean {
  return storage?.getItem(THREAD_PREFERENCE_STORAGE_KEY) === 'true'
}

export function storeThreadPreference(
  isEnabled: boolean,
  storage: PreferenceStorage | null = getStorage()
): void {
  try {
    storage?.setItem(THREAD_PREFERENCE_STORAGE_KEY, String(isEnabled))
  } catch (error: unknown) {
    console.warn('[settings] Cannot remember the thread preference', error)
  }
  listeners.forEach(listener => {
    listener()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // Another tab changed it
  const handleStorage = (event: StorageEvent): void => {
    if (event.key === THREAD_PREFERENCE_STORAGE_KEY) listener()
  }
  window.addEventListener('storage', handleStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', handleStorage)
  }
}

export interface ThreadPreference {
  isEnabled: boolean
  setEnabled: (isEnabled: boolean) => void
}

/** The "Thread" preference, following its changes in every tab */
export function useThreadPreference(): ThreadPreference {
  const isEnabled = useSyncExternalStore(subscribe, () =>
    readThreadPreference()
  )
  const setEnabled = useCallback((value: boolean) => {
    storeThreadPreference(value)
  }, [])
  return { isEnabled, setEnabled }
}
