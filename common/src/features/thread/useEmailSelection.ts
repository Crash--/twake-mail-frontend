import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from 'react'

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

interface SelectionState {
  ids: ReadonlySet<string>
  /** The last email toggled, where a range starts */
  anchorId: string | null
  isAllInFolder: boolean
}

const EMPTY: SelectionState = {
  ids: new Set(),
  anchorId: null,
  isAllInFolder: false
}

/**
 * The emails selected in a list, as tmail-flutter's selection mode: rows
 * toggled one by one or by range, the loaded ones, or the whole folder.
 * Emails leaving the list leave the selection.
 */
export function useEmailSelection(
  emails: readonly EmailListItemData[]
): EmailSelection {
  const [state, setState] = useState<SelectionState>(EMPTY)

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
    [emails]
  )

  const selectLoaded = useCallback((): void => {
    setState({
      ids: new Set(emails.map(email => email.id)),
      anchorId: null,
      isAllInFolder: false
    })
  }, [emails])

  const selectAllInFolder = useCallback((): void => {
    setState({ ids: new Set(), anchorId: null, isAllInFolder: true })
  }, [])

  const clear = useCallback((): void => {
    setState(EMPTY)
  }, [])

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
