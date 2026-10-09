import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

export interface SelectionState {
  ids: ReadonlySet<string>
  /** The last email toggled, where a range starts */
  anchorId: string | null
  isAllInFolder: boolean
}

export const EMPTY_SELECTION: SelectionState = {
  ids: new Set(),
  anchorId: null,
  isAllInFolder: false
}

interface StoredSelection {
  /** The list the emails were selected in */
  scope: string
  state: SelectionState
}

type SetStoredSelection = (
  update: (previous: StoredSelection) => StoredSelection
) => void

interface SelectionStore {
  stored: StoredSelection
  setStored: SetStoredSelection
}

const NO_SELECTION: StoredSelection = { scope: '', state: EMPTY_SELECTION }

const EmailSelectionStoreContext = createContext<SelectionStore | null>(null)

export interface EmailSelectionStoreProviderProps {
  children: ReactNode
}

/**
 * Keeps the selection of the list above it: opening an email replaces the
 * list below the side by side layout, and going back finds the emails
 * selected before
 */
export function EmailSelectionStoreProvider({
  children
}: EmailSelectionStoreProviderProps): ReactElement {
  const [stored, setStored] = useState<StoredSelection>(NO_SELECTION)
  const store = useMemo(() => ({ stored, setStored }), [stored])
  return (
    <EmailSelectionStoreContext.Provider value={store}>
      {children}
    </EmailSelectionStoreContext.Provider>
  )
}

export type SelectionStateUpdate = (
  update: (previous: SelectionState) => SelectionState
) => void

/**
 * The selection of the list `scope` (a folder, a label, a search), kept
 * while its emails are open; showing another list clears it. Without the
 * provider, it lasts as long as the list.
 */
export function useScopedSelectionState(
  scope: string
): [SelectionState, SelectionStateUpdate] {
  const store = useContext(EmailSelectionStoreContext)
  const [local, setLocal] = useState<StoredSelection>(NO_SELECTION)
  const stored = store?.stored ?? local
  const setStored = store?.setStored ?? setLocal

  useEffect(() => {
    setStored(previous =>
      previous.scope === scope ? previous : { scope, state: EMPTY_SELECTION }
    )
  }, [scope, setStored])

  const update = useCallback<SelectionStateUpdate>(
    next => {
      setStored(previous => ({
        scope,
        state: next(previous.scope === scope ? previous.state : EMPTY_SELECTION)
      }))
    },
    [scope, setStored]
  )

  return [stored.scope === scope ? stored.state : EMPTY_SELECTION, update]
}
