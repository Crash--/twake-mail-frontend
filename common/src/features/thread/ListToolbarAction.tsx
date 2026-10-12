import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode
} from 'react'

const ListToolbarActionContext = createContext<ReactNode>(null)

export interface ListToolbarActionProviderProps {
  /** At the far end of the toolbar above the list, null for none */
  action: ReactNode
  children: ReactNode
}

/**
 * The main action of the screens below, in the toolbar above their list
 * (the facade of a team mailbox, which has no sidebar for it)
 */
export function ListToolbarActionProvider({
  action,
  children
}: ListToolbarActionProviderProps): ReactElement {
  return (
    <ListToolbarActionContext.Provider value={action}>
      {children}
    </ListToolbarActionContext.Provider>
  )
}

export function useListToolbarAction(): ReactNode {
  return useContext(ListToolbarActionContext)
}
