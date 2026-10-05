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

interface ShortcutsApi {
  register: (registration: Registration) => () => void
  openHelp: () => void
}

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

  const register = useCallback((registration: Registration): (() => void) => {
    registrations.current = [...registrations.current, registration]
    return () => {
      registrations.current = registrations.current.filter(
        candidate => candidate !== registration
      )
    }
  }, [])

  const openHelp = useCallback((): void => {
    setIsHelpOpen(true)
  }, [])

  const handleCloseHelp = useCallback((): void => {
    setIsHelpOpen(false)
  }, [])

  useEffect(() => {
    if (!isEnabled) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      const key = isShortcutEvent(event) ? shortcutKeyOf(event) : null
      if (key === null) return
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

  const api = useMemo(() => ({ register, openHelp }), [register, openHelp])

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

const NO_SHORTCUTS: ShortcutsApi = { register: () => noop, openHelp: noop }

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

/** Opens the list of the keyboard shortcuts (account menu) */
export function useOpenShortcutsHelp(): () => void {
  return useShortcutsApi().openHelp
}
