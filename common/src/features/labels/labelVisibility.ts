import { useCallback, useSyncExternalStore } from 'react'

/**
 * "Label visibility" of tmail-flutter (Settings > Preferences): labels in
 * the folder tree, on emails and in menus. On by default, kept in this
 * browser as tmail-flutter does (`PREFERENCES_SETTING_LABEL`).
 */
export const LABEL_VISIBILITY_STORAGE_KEY = 'twake-mail.preferences.labels'

const listeners = new Set<() => void>()

function getStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    // Storage disabled by the browser settings
    return null
  }
}

export function readLabelVisibility(): boolean {
  return getStorage()?.getItem(LABEL_VISIBILITY_STORAGE_KEY) !== 'false'
}

function writeLabelVisibility(isVisible: boolean): void {
  try {
    getStorage()?.setItem(LABEL_VISIBILITY_STORAGE_KEY, String(isVisible))
  } catch (error: unknown) {
    console.warn('[labels] Cannot remember the label visibility', error)
  }
  listeners.forEach(listener => {
    listener()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const handleStorage = (event: StorageEvent): void => {
    if (event.key === LABEL_VISIBILITY_STORAGE_KEY) listener()
  }
  window.addEventListener('storage', handleStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', handleStorage)
  }
}

/** Whether labels show, and the setter; follows the other tabs */
export function useLabelVisibility(): [boolean, (isVisible: boolean) => void] {
  const isVisible = useSyncExternalStore(subscribe, readLabelVisibility)
  const setVisible = useCallback((next: boolean): void => {
    writeLabelVisibility(next)
  }, [])
  return [isVisible, setVisible]
}
