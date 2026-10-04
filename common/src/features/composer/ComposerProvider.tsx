import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import {
  DockedWindow,
  type DockedWindowMode
} from '@/ds/DockedWindow/DockedWindow'
import { fitWindows } from '@/ds/DockedWindow/fitWindows'
import { WindowDock } from '@/ds/DockedWindow/WindowDock'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'

import type { ComposerFormHandle } from './ComposerForm'

// The form and its editor (TipTap) load on demand, in their own chunk
const ComposerForm = lazy(() =>
  import('./ComposerForm').then(module => ({ default: module.ComposerForm }))
)

/** Most composers open at once (tmail-flutter has no limit) */
export const MAX_COMPOSERS = 3

/** What a composer opens with: a new message (drafts and replies later) */
export type ComposerInit = Record<string, never>

/** An open composer: serializable, to be kept across a reload */
interface ComposerEntry {
  id: string
  init: ComposerInit
  /** The mode the user asked for; the dock may show less (`fitWindows`) */
  mode: DockedWindowMode
  /** Its subject, empty for none */
  title: string
}

interface ComposerApi {
  openComposer: (init?: ComposerInit) => void
}

const ComposerContext = createContext<ComposerApi | null>(null)

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const handleResize = (): void => {
      setWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])
  return width
}

export interface ComposerProviderProps {
  children: ReactNode
}

/**
 * The composers of the mail screens, `useComposer().openComposer()` opens
 * one. On a desktop they are windows docked at the bottom end of the
 * screen, up to `MAX_COMPOSERS`, minimized or put full screen; Escape
 * minimizes one. Below, a composer fills the screen (a modal dialog) and
 * Escape closes it. Closing asks to save a modified message, then gives
 * the focus back to what opened the composer.
 */
export function ComposerProvider({
  children
}: ComposerProviderProps): ReactElement {
  const { t } = useI18n()
  const { notify } = useNotify()
  const screenSize = useScreenSize()
  const isDesktop = screenSize === 'desktop'
  const screenWidth = useWindowWidth()
  const [entries, setEntries] = useState<ComposerEntry[]>([])
  const entriesRef = useRef(entries)
  useEffect(() => {
    entriesRef.current = entries
  })
  /** What had the focus when each composer opened */
  const openers = useRef(new Map<string, Element | null>())
  const forms = useRef(new Map<string, ComposerFormHandle>())

  const setMode = useCallback((id: string, mode: DockedWindowMode): void => {
    setEntries(current => {
      const entry = current.find(candidate => candidate.id === id)
      if (!entry) return current
      const others = current.filter(candidate => candidate.id !== id)
      // Shown again: it becomes the newest, the dock makes room for it
      return mode === 'minimized'
        ? current.map(candidate =>
            candidate.id === id ? { ...candidate, mode } : candidate
          )
        : [...others, { ...entry, mode }]
    })
  }, [])

  const openComposer = useCallback(
    (init: ComposerInit = {}): void => {
      const current = entriesRef.current
      if (current.length >= MAX_COMPOSERS) {
        const newest = current[current.length - 1]
        if (newest) setMode(newest.id, 'normal')
        notify({ message: t('composer.limit', { smart_count: MAX_COMPOSERS }) })
        return
      }
      const id = crypto.randomUUID()
      openers.current.set(id, document.activeElement)
      setEntries(previous => [
        ...previous,
        { id, init, mode: 'normal', title: '' }
      ])
    },
    [notify, setMode, t]
  )

  const close = useCallback((id: string): void => {
    const opener = openers.current.get(id)
    openers.current.delete(id)
    forms.current.delete(id)
    setEntries(current => current.filter(entry => entry.id !== id))
    if (opener instanceof HTMLElement && opener.isConnected) {
      // Once the window is gone
      requestAnimationFrame(() => {
        opener.focus()
      })
    }
  }, [])

  const requestClose = useCallback(
    async (id: string): Promise<void> => {
      const form = forms.current.get(id)
      if (form && !(await form.requestClose())) return
      close(id)
    },
    [close]
  )

  const setTitle = useCallback((id: string, title: string): void => {
    setEntries(current =>
      current.some(entry => entry.id === id && entry.title !== title)
        ? current.map(entry => (entry.id === id ? { ...entry, title } : entry))
        : current
    )
  }, [])

  const registerForm = useCallback(
    (id: string, handle: ComposerFormHandle): void => {
      forms.current.set(id, handle)
    },
    []
  )

  const api = useMemo(() => ({ openComposer }), [openComposer])

  // The newest first, at the end of the dock
  const newestFirst = [...entries].reverse()
  const shownModes = isDesktop
    ? fitWindows(
        newestFirst.map(entry => entry.mode),
        screenWidth
      )
    : newestFirst.map((_entry, index) => (index === 0 ? 'fullscreen' : null))

  return (
    <ComposerContext.Provider value={api}>
      {children}
      {entries.length > 0 ? (
        <WindowDock data-testid="composer-dock">
          {newestFirst.map((entry, index) => (
            <ComposerSlot
              key={entry.id}
              entry={entry}
              mode={shownModes[index] ?? null}
              isModal={!isDesktop}
              setMode={setMode}
              setTitle={setTitle}
              registerForm={registerForm}
              requestClose={requestClose}
            />
          ))}
        </WindowDock>
      ) : null}
    </ComposerContext.Provider>
  )
}

interface ComposerSlotProps {
  entry: ComposerEntry
  /** The mode shown, null when the dock has no room for it */
  mode: DockedWindowMode | null
  isModal: boolean
  setMode: (id: string, mode: DockedWindowMode) => void
  setTitle: (id: string, title: string) => void
  registerForm: (id: string, handle: ComposerFormHandle) => void
  requestClose: (id: string) => Promise<void>
}

/** One composer: its window, and its form once loaded */
function ComposerSlot({
  entry,
  mode,
  isModal,
  setMode,
  setTitle,
  registerForm,
  requestClose
}: ComposerSlotProps): ReactElement {
  const { t } = useI18n()
  const { id } = entry
  const handleTitleChange = useCallback(
    (title: string): void => {
      setTitle(id, title)
    },
    [id, setTitle]
  )
  const handleReady = useCallback(
    (handle: ComposerFormHandle): void => {
      registerForm(id, handle)
    },
    [id, registerForm]
  )

  return (
    // Hidden (no room): kept mounted, nothing typed is lost
    <div
      hidden={mode === null}
      className={mode === null ? undefined : 'u-flex u-flex-items-end'}
    >
      <DockedWindow
        title={entry.title === '' ? t('composer.newMessage') : entry.title}
        mode={mode ?? 'minimized'}
        isModal={isModal}
        isCompact={isModal}
        labels={{
          minimize: t('composer.window.minimize'),
          restore: t('composer.window.show'),
          fullscreen: t('composer.window.fullscreen'),
          exitFullscreen: t('composer.window.exitFullscreen'),
          close: t('composer.window.close')
        }}
        onModeChange={next => {
          setMode(id, next)
        }}
        onClose={() => {
          void requestClose(id)
        }}
        onEscape={() => {
          if (isModal || mode === 'fullscreen') {
            void requestClose(id)
          } else {
            setMode(id, 'minimized')
          }
        }}
        testIds={{
          window: 'composer',
          minimize: 'composer-minimize-button',
          fullscreen: 'composer-fullscreen-button',
          close: 'composer-close-button'
        }}
      >
        <Suspense fallback={null}>
          <ComposerForm
            autoFocus
            onTitleChange={handleTitleChange}
            onReady={handleReady}
          />
        </Suspense>
      </DockedWindow>
    </div>
  )
}

function noop(): void {
  // Outside the mail screens: nothing to compose in
}

const NO_COMPOSER: ComposerApi = { openComposer: noop }

/** Opens composers; a no-op outside a `ComposerProvider` */
export function useComposer(): ComposerApi {
  return useContext(ComposerContext) ?? NO_COMPOSER
}
