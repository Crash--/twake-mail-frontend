import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

/** The sections of the sidebar that collapse */
export type SidebarSectionId =
  'folders' | 'personalFolders' | 'teamMailboxes' | 'labels'

export interface SidebarSections {
  isExpanded: (id: SidebarSectionId) => boolean
  toggle: (id: SidebarSectionId) => void
}

const SidebarSectionsContext = createContext<SidebarSections | null>(null)

export interface SidebarSectionsProviderProps {
  children: ReactNode
}

/**
 * Which sections of the sidebar are collapsed, as tmail-flutter's
 * `MailboxCategoriesExpandMode`: all expanded at first, kept for the
 * session (not across reloads) so that closing the drawer or changing
 * folder leaves them as they are.
 */
export function SidebarSectionsProvider({
  children
}: SidebarSectionsProviderProps): ReactElement {
  const [collapsed, setCollapsed] = useState<ReadonlySet<SidebarSectionId>>(
    () => new Set()
  )
  const isExpanded = useCallback(
    (id: SidebarSectionId): boolean => !collapsed.has(id),
    [collapsed]
  )
  const toggle = useCallback((id: SidebarSectionId): void => {
    setCollapsed(previous => {
      const next = new Set(previous)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])
  const value = useMemo(() => ({ isExpanded, toggle }), [isExpanded, toggle])
  return (
    <SidebarSectionsContext.Provider value={value}>
      {children}
    </SidebarSectionsContext.Provider>
  )
}

const ALL_EXPANDED: SidebarSections = {
  isExpanded: () => true,
  toggle: () => undefined
}

/** The state of the collapsible sections; without provider, all expanded */
export function useSidebarSections(): SidebarSections {
  return useContext(SidebarSectionsContext) ?? ALL_EXPANDED
}
