import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import { isShortcutEvent, shortcutKeyOf, type ShortcutKey } from './shortcuts'
import { ShortcutsHelpDialog } from './ShortcutsHelpDialog'
import { useShortcutsEnabled } from './shortcutsSetting'

export type ShortcutBindings = Partial<Record<ShortcutKey, () => void>>

interface Registration {
  bindings: { current: ShortcutBindings }
  /** Whether this screen handles the keys now (e.g. where the focus is) */
  when: { current: () => boolean }
}

/** Gives the keys back to the shortcuts; calling it again does nothing */
export type ReleaseShortcuts = () => void

interface ShortcutsApi {
  register: (registration: Registration) => () => void
  suspend: () => ReleaseShortcuts
}

/**
 * Longest suspension: a view that never takes the focus (it failed to
 * load) does not leave the shortcuts off
 */
export const MAX_SUSPENSION_MS = 10_000

const ShortcutsContext = createContext<ShortcutsApi | null>(null)

function always(): boolean {
  return true
}

export interface ShortcutsProviderProps {
  children: ReactNode
}

/**
 * The single-key shortcuts of the mail screens (`SHORTCUTS`), listened to
 * on the document: a key goes to the last screen registered for it whose
 * `when` holds. Off when the user turned them off, and ignored while typing
 * or in a dialog or menu (`isShortcutEvent`). `?` opens the list, where they
 * can be turned off.
 */
export function ShortcutsProvider({
  children
}: ShortcutsProviderProps): ReactElement {
  const [isEnabled] = useShortcutsEnabled()
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const registrations = useRef<Registration[]>([])
  const suspensions = useRef(0)

  const register = useCallback((registration: Registration): (() => void) => {
    registrations.current = [...registrations.current, registration]
    return () => {
      registrations.current = registrations.current.filter(
        candidate => candidate !== registration
      )
    }
  }, [])

  const suspend = useCallback((): ReleaseShortcuts => {
    suspensions.current += 1
    let isReleased = false
    const release = (): void => {
      if (isReleased) return
      isReleased = true
      window.clearTimeout(timer)
      suspensions.current -= 1
    }
    const timer = window.setTimeout(release, MAX_SUSPENSION_MS)
    return release
  }, [])

  const handleCloseHelp = useCallback((): void => {
    setIsHelpOpen(false)
  }, [])

  useEffect(() => {
    if (!isEnabled) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      const key = isShortcutEvent(event) ? shortcutKeyOf(event) : null
      if (key === null) return
      // A view opening, about to take the focus: the key was meant for it
      if (suspensions.current > 0) {
        event.preventDefault()
        return
      }
      if (key === '?') {
        event.preventDefault()
        setIsHelpOpen(true)
        return
      }
      const handler = [...registrations.current]
        .reverse()
        .find(
          registration =>
            registration.bindings.current[key] !== undefined &&
            registration.when.current()
        )?.bindings.current[key]
      if (handler === undefined) return
      event.preventDefault()
      handler()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isEnabled])

  const api = useMemo(() => ({ register, suspend }), [register, suspend])

  return (
    <ShortcutsContext.Provider value={api}>
      {children}
      <ShortcutsHelpDialog open={isHelpOpen} onClose={handleCloseHelp} />
    </ShortcutsContext.Provider>
  )
}

function noop(): void {
  // Outside the mail screens (tests of a single component): no shortcut
}

const NO_SHORTCUTS: ShortcutsApi = {
  register: () => noop,
  suspend: () => noop
}

function useShortcutsApi(): ShortcutsApi {
  return useContext(ShortcutsContext) ?? NO_SHORTCUTS
}

/**
 * Handles keyboard shortcuts while the calling screen is shown, and `when`
 * holds (read at each key press). The handlers may change at each render.
 */
export function useShortcuts(
  bindings: ShortcutBindings,
  when: () => boolean = always
): void {
  const { register } = useShortcutsApi()
  const bindingsRef = useRef(bindings)
  const whenRef = useRef(when)
  useEffect(() => {
    bindingsRef.current = bindings
    whenRef.current = when
  })
  useEffect(
    () => register({ bindings: bindingsRef, when: whenRef }),
    [register]
  )
}

/**
 * Turns the shortcuts off until the returned function is called, at most
 * `MAX_SUSPENSION_MS`: while a view opens (a composer loading its editor),
 * the keys typed are meant for it, not for the screen behind
 */
export function useSuspendShortcuts(): () => ReleaseShortcuts {
  return useShortcutsApi().suspend
}
