import {
  createContext,
  useContext,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

/** What a list has selected (`useEmailSelection`) */
export interface SelectionState {
  ids: ReadonlySet<string>
  /** The last email toggled, where a range starts */
  anchorId: string | null
  isAllInFolder: boolean
}

/**
 * The selection of the last list shown, kept while the list is unmounted:
 * outside the side by side layout, the open email takes the place of the
 * list, which comes back from scratch
 */
export interface EmailSelectionMemory {
  /** The selection kept for `listKey`, null for another list */
  read: (listKey: string) => SelectionState | null
  write: (listKey: string, state: SelectionState) => void
}

function createEmailSelectionMemory(): EmailSelectionMemory {
  let kept: { listKey: string; state: SelectionState } | null = null
  return {
    read: listKey => (kept?.listKey === listKey ? kept.state : null),
    write: (listKey, state) => {
      kept = { listKey, state }
    }
  }
}

const EmailSelectionMemoryContext = createContext<EmailSelectionMemory | null>(
  null
)

/**
 * Keeps the selection of the email list while an email opened from it is
 * shown, for the selection to be there when going back to the list. One
 * list only: showing another one (folder, search, filter) forgets it. Under
 * the signed-in screens, so that signing out forgets it too.
 */
export function EmailSelectionMemoryProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const [memory] = useState(createEmailSelectionMemory)
  return (
    <EmailSelectionMemoryContext.Provider value={memory}>
      {children}
    </EmailSelectionMemoryContext.Provider>
  )
}

/** The memory of the selection, null outside the signed-in screens */
export function useEmailSelectionMemory(): EmailSelectionMemory | null {
  return useContext(EmailSelectionMemoryContext)
}
