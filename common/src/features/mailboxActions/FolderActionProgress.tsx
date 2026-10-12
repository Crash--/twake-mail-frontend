import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

/** The long folder actions whose progress shows */
export type FolderActionKind = 'markAsRead' | 'empty'

export interface FolderActionProgressState {
  kind: FolderActionKind
  mailboxId: string
  /** The name of the folder, said when the action starts */
  folderName: string
  /** Emails done so far */
  done: number
  /** Emails to do; null when unknown (one server call does it all) */
  total: number | null
}

export interface FolderActionProgressControls {
  /** The action running, null when none */
  progress: FolderActionProgressState | null
  /** Starts showing an action; false when one already runs (not started) */
  start: (progress: Omit<FolderActionProgressState, 'done'>) => boolean
  /** How many emails are done, and of how many once it is known */
  update: (done: number, total?: number) => void
  /** The action ended, whatever the outcome */
  finish: () => void
}

const NO_PROGRESS: FolderActionProgressControls = {
  progress: null,
  start: () => true,
  update: () => undefined,
  finish: () => undefined
}

const FolderActionProgressContext =
  createContext<FolderActionProgressControls>(NO_PROGRESS)

/**
 * Holds the long folder action running (mark every email read, empty the
 * Trash or Spam), one at a time as tmail-flutter, for the progress bar
 * above the list
 */
export function FolderActionProgressProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const [progress, setProgress] = useState<FolderActionProgressState | null>(
    null
  )
  // Read by `start` whatever render its caller saw: no second action
  const isRunningRef = useRef(false)
  const controls = useMemo<FolderActionProgressControls>(
    () => ({
      progress,
      start: next => {
        if (isRunningRef.current) return false
        isRunningRef.current = true
        setProgress({ ...next, done: 0 })
        return true
      },
      update: (done, total) => {
        setProgress(current =>
          current === null
            ? null
            : { ...current, done, total: total ?? current.total }
        )
      },
      finish: () => {
        isRunningRef.current = false
        setProgress(null)
      }
    }),
    [progress]
  )

  return (
    <FolderActionProgressContext.Provider value={controls}>
      {children}
    </FolderActionProgressContext.Provider>
  )
}

/** The running folder action and its controls (no-ops outside the provider) */
export function useFolderActionProgress(): FolderActionProgressControls {
  return useContext(FolderActionProgressContext)
}
