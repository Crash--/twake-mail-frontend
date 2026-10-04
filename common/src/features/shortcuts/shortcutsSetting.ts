import { useCallback, useSyncExternalStore } from 'react'

export const SHORTCUTS_STORAGE_KEY = 'twake-mail.shortcuts.enabled'

const listeners = new Set<() => void>()

function getStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    // Storage disabled by the browser settings
    return null
  }
}

/** Single-key shortcuts are on unless the user turned them off */
export function readShortcutsEnabled(
  storage: Storage | null = getStorage()
): boolean {
  return storage?.getItem(SHORTCUTS_STORAGE_KEY) !== 'false'
}

export function writeShortcutsEnabled(
  isEnabled: boolean,
  storage: Storage | null = getStorage()
): void {
  try {
    storage?.setItem(SHORTCUTS_STORAGE_KEY, String(isEnabled))
  } catch (error: unknown) {
    console.warn('[shortcuts] Cannot remember the setting', error)
  }
  listeners.forEach(listener => {
    listener()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // Another tab changed it
  const handleStorage = (event: StorageEvent): void => {
    if (event.key === SHORTCUTS_STORAGE_KEY) listener()
  }
  window.addEventListener('storage', handleStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', handleStorage)
  }
}

/**
 * Whether the keyboard shortcuts are on, and the setter. Kept in the
 * browser: single-key shortcuts must be possible to turn off (WCAG 2.1.4,
 * character key shortcuts), e.g. for speech input or a screen reader in
 * focus mode.
 */
export function useShortcutsEnabled(): [boolean, (isEnabled: boolean) => void] {
  const isEnabled = useSyncExternalStore(subscribe, () =>
    readShortcutsEnabled()
  )
  const setEnabled = useCallback((next: boolean): void => {
    writeShortcutsEnabled(next)
  }, [])
  return [isEnabled, setEnabled]
}
