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
import {
  useSuspendShortcuts,
  type ReleaseShortcuts
} from '@common/features/shortcuts/ShortcutsProvider'
import { useI18n } from '@common/i18n/useI18n'

import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  readStorage,
  registryKey,
  snapshotKey,
  writeStorage
} from './composerStorage'
import type { ComposerFormHandle, ComposerInit } from './ComposerForm'
import { acquireDraftLock, type ReleaseLock } from './draftLocks'

// The form and its editor (TipTap) load on demand, in their own chunk
const ComposerForm = lazy(() =>
  import('./ComposerForm').then(module => ({ default: module.ComposerForm }))
)

/** Most composers open at once (tmail-flutter has no limit) */
export const MAX_COMPOSERS = 3

/** An open composer: serializable, kept across a reload */
interface ComposerEntry {
  id: string
  init: ComposerInit
  /** The mode the user asked for; the dock may show less (`fitWindows`) */
  mode: DockedWindowMode
  /** Its subject, empty for none */
  title: string
}

interface ComposerApi {
  /** Opens a new message, or a draft (the composer editing it if any) */
  openComposer: (init?: ComposerInit) => void
}

const ComposerContext = createContext<ComposerApi | null>(null)

const MODES: readonly string[] = ['normal', 'minimized', 'fullscreen']

/** Two inits answering the same email the same way */
function isSameAnswer(first: ComposerInit, second: ComposerInit): boolean {
  const { reply } = first
  return (
    reply !== undefined &&
    second.reply?.emailId === reply.emailId &&
    second.reply.action === reply.action
  )
}

function isEntry(value: unknown): value is ComposerEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'init' in value &&
    typeof value.init === 'object' &&
    value.init !== null &&
    'mode' in value &&
    typeof value.mode === 'string' &&
    MODES.includes(value.mode) &&
    'title' in value &&
    typeof value.title === 'string'
  )
}

/** The composers a reload left, if any */
function readRegistry(accountId: string): ComposerEntry[] {
  const value = readStorage(registryKey(accountId))
  return Array.isArray(value) ? value.filter(isEntry) : []
}

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
 *
 * A draft is edited by one composer at a time (`draftLocks`). The open
 * composers are kept in `sessionStorage` on `beforeunload` and come back
 * after a reload (tmail-flutter ADR 0112).
 */
export function ComposerProvider({
  children
}: ComposerProviderProps): ReactElement {
  const { t } = useI18n()
  const { notify } = useNotify()
  const { accountId } = useJmapSession()
  const suspendShortcuts = useSuspendShortcuts()
  const screenSize = useScreenSize()
  const isDesktop = screenSize === 'desktop'
  const screenWidth = useWindowWidth()
  const [entries, setEntries] = useState<ComposerEntry[]>(() =>
    readRegistry(accountId)
  )
  const entriesRef = useRef(entries)
  useEffect(() => {
    entriesRef.current = entries
  })
  /** What had the focus when each composer opened */
  const openers = useRef(new Map<string, Element | null>())
  const forms = useRef(new Map<string, ComposerFormHandle>())
  /**
   * The shortcuts are off while a composer opens: a key typed before its
   * form takes the focus belongs to it, not to the screen behind
   */
  const openings = useRef(new Map<string, ReleaseShortcuts>())
  /** The draft each composer edits, and the lock it holds on it */
  const drafts = useRef(
    new Map<string, { draftId: string; release: ReleaseLock }>()
  )

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

  // Kept across a reload: the composers, and what each one holds
  useEffect(() => {
    const handleBeforeUnload = (): void => {
      const open = entriesRef.current
      if (open.length === 0) {
        sessionStorage.removeItem(registryKey(accountId))
        return
      }
      writeStorage(registryKey(accountId), open)
      for (const entry of open) {
        const snapshot = forms.current.get(entry.id)?.snapshot() ?? null
        if (snapshot) writeStorage(snapshotKey(accountId, entry.id), snapshot)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [accountId])

  // The locks go with the composers
  useEffect(() => {
    const held = drafts.current
    return () => {
      held.forEach(draft => {
        draft.release()
      })
      held.clear()
    }
  }, [])

  const setDraft = useCallback(
    (id: string, draftId: string | null): void => {
      const current = drafts.current.get(id)
      if (current?.draftId === draftId) return
      current?.release()
      drafts.current.delete(id)
      if (draftId === null) return
      // In the tab at once; between tabs once the lock is there
      drafts.current.set(id, { draftId, release: () => undefined })
      void acquireDraftLock(accountId, draftId).then(release => {
        const now = drafts.current.get(id)
        if (now?.draftId !== draftId) {
          release?.()
          return
        }
        if (release) now.release = release
      })
    },
    [accountId]
  )

  const settleOpening = useCallback((id: string): void => {
    openings.current.get(id)?.()
    openings.current.delete(id)
  }, [])

  /** Shows a composer already open, the focus in its form */
  const bringBack = useCallback(
    (id: string): void => {
      setMode(id, 'normal')
      // Once shown again
      requestAnimationFrame(() => {
        forms.current.get(id)?.focus()
      })
    },
    [setMode]
  )

  const openComposer = useCallback(
    (init: ComposerInit = {}): void => {
      const current = entriesRef.current
      const { draftId } = init
      if (draftId !== undefined) {
        const holder = [...drafts.current].find(
          ([, draft]) => draft.draftId === draftId
        )
        if (holder) {
          bringBack(holder[0])
          return
        }
      }
      // Answering the same email twice: the answer already open
      const answer = current.find(entry => isSameAnswer(entry.init, init))
      if (answer) {
        bringBack(answer.id)
        return
      }
      if (current.length >= MAX_COMPOSERS) {
        const newest = current[current.length - 1]
        if (newest) setMode(newest.id, 'normal')
        notify({ message: t('composer.limit', { smart_count: MAX_COMPOSERS }) })
        return
      }
      const opener = document.activeElement
      const releaseShortcuts = suspendShortcuts()
      const add = (release: ReleaseLock | null): void => {
        const id = crypto.randomUUID()
        openers.current.set(id, opener)
        openings.current.set(id, releaseShortcuts)
        if (draftId !== undefined && release) {
          drafts.current.set(id, { draftId, release })
        }
        setEntries(previous => [
          ...previous,
          { id, init, mode: 'normal', title: '' }
        ])
      }
      if (draftId === undefined) {
        add(null)
        return
      }
      void acquireDraftLock(accountId, draftId).then(release => {
        if (release === null) {
          releaseShortcuts()
          notify({ message: t('composer.draft.lockedElsewhere') })
          return
        }
        add(release)
      })
    },
    [accountId, notify, setMode, t, bringBack, suspendShortcuts]
  )

  const close = useCallback(
    (id: string): void => {
      settleOpening(id)
      const opener = openers.current.get(id)
      openers.current.delete(id)
      forms.current.delete(id)
      drafts.current.get(id)?.release()
      drafts.current.delete(id)
      sessionStorage.removeItem(snapshotKey(accountId, id))
      // A reload keeps the others only
      const others = entriesRef.current.filter(entry => entry.id !== id)
      if (others.length === 0) {
        sessionStorage.removeItem(registryKey(accountId))
      } else if (sessionStorage.getItem(registryKey(accountId)) !== null) {
        writeStorage(registryKey(accountId), others)
      }
      setEntries(current => current.filter(entry => entry.id !== id))
      if (opener instanceof HTMLElement && opener.isConnected) {
        // Once the window is gone
        requestAnimationFrame(() => {
          opener.focus()
        })
      }
    },
    [accountId, settleOpening]
  )

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
              setDraft={setDraft}
              close={close}
              requestClose={requestClose}
              onFocusIn={settleOpening}
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
  setDraft: (id: string, draftId: string | null) => void
  close: (id: string) => void
  requestClose: (id: string) => Promise<void>
  /** The focus went in the composer */
  onFocusIn: (id: string) => void
}

/** One composer: its window, and its form once loaded */
function ComposerSlot({
  entry,
  mode,
  isModal,
  setMode,
  setTitle,
  registerForm,
  setDraft,
  close,
  requestClose,
  onFocusIn
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
  const handleDraftChange = useCallback(
    (draftId: string | null): void => {
      setDraft(id, draftId)
    },
    [id, setDraft]
  )
  const handleDone = useCallback((): void => {
    close(id)
  }, [id, close])

  return (
    // Hidden (no room): kept mounted, nothing typed is lost
    <div
      hidden={mode === null}
      className={mode === null ? undefined : 'u-flex u-flex-items-end'}
      onFocus={() => {
        onFocusIn(id)
      }}
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
            composerId={id}
            init={entry.init}
            autoFocus
            onTitleChange={handleTitleChange}
            onReady={handleReady}
            onDraftChange={handleDraftChange}
            onDone={handleDone}
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
