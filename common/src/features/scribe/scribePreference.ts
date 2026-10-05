import { useCallback, useSyncExternalStore } from 'react'

/**
 * "AI Scribe" of tmail-flutter (Settings > Preferences): shows or hides the
 * AI assistant of the composer. On by default, kept in this browser as
 * tmail-flutter does (`PREFERENCES_SETTING_AI_SCRIBE`).
 */
export const SCRIBE_PREFERENCE_STORAGE_KEY = 'twake-mail.preferences.ai-scribe'

const listeners = new Set<() => void>()

function getStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    // Storage disabled by the browser settings
    return null
  }
}

export function readScribePreference(): boolean {
  return getStorage()?.getItem(SCRIBE_PREFERENCE_STORAGE_KEY) !== 'false'
}

function writeScribePreference(isEnabled: boolean): void {
  try {
    getStorage()?.setItem(SCRIBE_PREFERENCE_STORAGE_KEY, String(isEnabled))
  } catch (error: unknown) {
    console.warn('[scribe] Cannot remember the AI Scribe preference', error)
  }
  listeners.forEach(listener => {
    listener()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const handleStorage = (event: StorageEvent): void => {
    if (event.key === SCRIBE_PREFERENCE_STORAGE_KEY) listener()
  }
  window.addEventListener('storage', handleStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', handleStorage)
  }
}

/** Whether the AI assistant shows, and the setter; follows the other tabs */
export function useScribePreference(): [boolean, (isEnabled: boolean) => void] {
  const isEnabled = useSyncExternalStore(subscribe, readScribePreference)
  const setEnabled = useCallback((next: boolean): void => {
    writeScribePreference(next)
  }, [])
  return [isEnabled, setEnabled]
}
