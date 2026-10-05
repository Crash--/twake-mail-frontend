import { useSyncExternalStore } from 'react'

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface LocalPreference<T> {
  read: (storage?: PreferenceStorage | null) => T
  write: (value: T, storage?: PreferenceStorage | null) => void
  /** The preference, following its changes in every tab */
  useValue: () => T
}

function getStorage(): PreferenceStorage | null {
  try {
    return window.localStorage
  } catch {
    // Storage disabled by the browser settings
    return null
  }
}

/**
 * A preference tmail-flutter keeps on the device (its `PreferencesSetting`
 * configs), here in this browser: read from its raw stored text (null when
 * never stored), written with `serialize`
 */
export function createLocalPreference<T>(options: {
  key: string
  parse: (raw: string | null) => T
  serialize: (value: T) => string
}): LocalPreference<T> {
  const { key, parse, serialize } = options
  const listeners = new Set<() => void>()
  // useSyncExternalStore needs a stable snapshot for an unchanged value
  let cache: { raw: string | null; value: T } | null = null

  const readRaw = (storage: PreferenceStorage | null): string | null => {
    try {
      return storage?.getItem(key) ?? null
    } catch {
      return null
    }
  }

  const read = (storage: PreferenceStorage | null = getStorage()): T => {
    const raw = readRaw(storage)
    if (cache?.raw === raw) return cache.value
    const value = parse(raw)
    cache = { raw, value }
    return value
  }

  const write = (
    value: T,
    storage: PreferenceStorage | null = getStorage()
  ): void => {
    try {
      storage?.setItem(key, serialize(value))
    } catch (error: unknown) {
      console.warn(`[settings] Cannot remember ${key}`, error)
    }
    listeners.forEach(listener => {
      listener()
    })
  }

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    const handleStorage = (event: StorageEvent): void => {
      if (event.key === key) listener()
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', handleStorage)
    }
  }

  return {
    read,
    write,
    useValue: () => useSyncExternalStore(subscribe, () => read())
  }
}
