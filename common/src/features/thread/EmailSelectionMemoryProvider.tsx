import {
  createContext,
  useContext,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import type { ListTableScroll } from '@/ds/VirtualizedListTable/VirtualizedListTable'

/** What a list has selected (`useEmailSelection`) */
export interface SelectionState {
  ids: ReadonlySet<string>
  /** The last email toggled, where a range starts */
  anchorId: string | null
  isAllInFolder: boolean
}

/**
 * What the last list shown had, kept while the list is unmounted: outside
 * the side by side layout, the open email takes the place of the list,
 * which comes back from scratch
 */
export interface ListMemory<T> {
  /** The value kept for `listKey`, null for another list */
  read: (listKey: string) => T | null
  write: (listKey: string, value: T) => void
  clear: () => void
}

export type EmailSelectionMemory = ListMemory<SelectionState>

function createListMemory<T>(): ListMemory<T> {
  let kept: { listKey: string; value: T } | null = null
  return {
    read: listKey => (kept?.listKey === listKey ? kept.value : null),
    write: (listKey, value) => {
      kept = { listKey, value }
    },
    clear: () => {
      kept = null
    }
  }
}

const EmailSelectionMemoryContext = createContext<EmailSelectionMemory | null>(
  null
)

const EmailListScrollMemoryContext =
  createContext<ListMemory<ListTableScroll> | null>(null)

/**
 * Keeps the selection and the scroll position of the email list while an
 * email opened from it is shown, for them to be there when going back to
 * the list. One list only: showing another one (folder, search, filter)
 * forgets them. Under the signed-in screens, so that signing out forgets
 * them too.
 */
export function EmailSelectionMemoryProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const [memory] = useState(createListMemory<SelectionState>)
  const [scrollMemory] = useState(createListMemory<ListTableScroll>)
  return (
    <EmailSelectionMemoryContext.Provider value={memory}>
      <EmailListScrollMemoryContext.Provider value={scrollMemory}>
        {children}
      </EmailListScrollMemoryContext.Provider>
    </EmailSelectionMemoryContext.Provider>
  )
}

/** The memory of the selection, null outside the signed-in screens */
export function useEmailSelectionMemory(): EmailSelectionMemory | null {
  return useContext(EmailSelectionMemoryContext)
}

/** The memory of the scroll position, null outside the signed-in screens */
export function useEmailListScrollMemory(): ListMemory<ListTableScroll> | null {
  return useContext(EmailListScrollMemoryContext)
}
