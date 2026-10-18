import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  useEmailSelectionMemory,
  type SelectionState
} from './EmailSelectionMemoryProvider'
import type { EmailListItemData } from './queries'

export interface EmailSelection {
  /** The selected emails among the loaded ones, in the list order */
  selected: EmailListItemData[]
  /** Every email of the folder is selected, loaded or not */
  isAllInFolder: boolean
  isSelected: (emailId: string) => boolean
  /**
   * Selects or unselects an email; with `range` (Shift), every email from
   * the last one toggled to this one takes its new state
   */
  toggle: (emailId: string, range: boolean) => void
  /** Selects the loaded emails */
  selectLoaded: () => void
  /** Selects every email of the folder, beyond the loaded ones */
  selectAllInFolder: () => void
  clear: () => void
}

const EMPTY: SelectionState = {
  ids: new Set(),
  anchorId: null,
  isAllInFolder: false
}

/**
 * A selection kept for a list, back in it: without the emails that left
 * it meanwhile (still unknown while the list loads). The whole folder
 * stays selected if it was.
 */
function restore(
  state: SelectionState,
  emails: readonly EmailListItemData[]
): SelectionState {
  if (emails.length === 0) return state
  const listed = new Set(emails.map(email => email.id))
  return {
    ids: new Set([...state.ids].filter(id => listed.has(id))),
    anchorId:
      state.anchorId !== null && listed.has(state.anchorId)
        ? state.anchorId
        : null,
    isAllInFolder: state.isAllInFolder
  }
}

/**
 * The emails selected in a list, as tmail-flutter's selection mode: rows
 * toggled one by one or by range, the loaded ones, or the whole folder.
 * Emails leaving the list leave the selection. `listKey` tells the list
 * apart (account, folder or search, filter): another list starts with
 * nothing selected; the same list shown again (back from an email opened
 * from it) finds its selection (`EmailSelectionMemoryProvider`).
 */
export function useEmailSelection(
  emails: readonly EmailListItemData[],
  listKey: string
): EmailSelection {
  const memory = useEmailSelectionMemory()
  const [kept, setKept] = useState(() => ({
    listKey,
    state: restore(memory?.read(listKey) ?? EMPTY, emails)
  }))
  // Another list in the same component (a search typed, a filter): start
  // over, as React resets a state during the render
  if (kept.listKey !== listKey) setKept({ listKey, state: EMPTY })
  const state = kept.listKey === listKey ? kept.state : EMPTY
  const setState = useCallback(
    (
      update: SelectionState | ((previous: SelectionState) => SelectionState)
    ): void => {
      setKept(previous => {
        const current = previous.listKey === listKey ? previous.state : EMPTY
        return {
          listKey,
          state: typeof update === 'function' ? update(current) : update
        }
      })
    },
    [listKey]
  )
  useEffect(() => {
    memory?.write(listKey, state)
  }, [memory, listKey, state])

  const selected = useMemo(
    () =>
      state.isAllInFolder
        ? [...emails]
        : emails.filter(email => state.ids.has(email.id)),
    [emails, state]
  )

  const isSelected = useCallback(
    (emailId: string): boolean => state.isAllInFolder || state.ids.has(emailId),
    [state]
  )

  const toggle = useCallback(
    (emailId: string, range: boolean): void => {
      setState(previous => {
        const ids = new Set(
          previous.isAllInFolder ? emails.map(email => email.id) : previous.ids
        )
        const isSelecting = !ids.has(emailId)
        const anchorIndex =
          previous.anchorId === null
            ? -1
            : emails.findIndex(email => email.id === previous.anchorId)
        const index = emails.findIndex(email => email.id === emailId)
        const targets =
          range && anchorIndex !== -1 && index !== -1
            ? emails
                .slice(
                  Math.min(anchorIndex, index),
                  Math.max(anchorIndex, index) + 1
                )
                .map(email => email.id)
            : [emailId]
        for (const id of targets) {
          if (isSelecting) ids.add(id)
          else ids.delete(id)
        }
        return { ids, anchorId: emailId, isAllInFolder: false }
      })
    },
    [emails, setState]
  )

  const selectLoaded = useCallback((): void => {
    setState({
      ids: new Set(emails.map(email => email.id)),
      anchorId: null,
      isAllInFolder: false
    })
  }, [emails, setState])

  const selectAllInFolder = useCallback((): void => {
    setState({ ids: new Set(), anchorId: null, isAllInFolder: true })
  }, [setState])

  const clear = useCallback((): void => {
    setState(EMPTY)
  }, [setState])

  return useMemo(
    () => ({
      selected,
      isAllInFolder: state.isAllInFolder,
      isSelected,
      toggle,
      selectLoaded,
      selectAllInFolder,
      clear
    }),
    [
      selected,
      state.isAllInFolder,
      isSelected,
      toggle,
      selectLoaded,
      selectAllInFolder,
      clear
    ]
  )
}

/** The selection of the list, for its cells (rows are memoized) */
export const EmailSelectionContext = createContext<EmailSelection | null>(null)

export function useEmailSelectionContext(): EmailSelection | null {
  return useContext(EmailSelectionContext)
}
