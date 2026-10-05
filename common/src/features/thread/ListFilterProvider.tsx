import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'

import type { ListFilter, ListFilterOption } from './listFilter'

interface FilterState {
  /** The list the filter was picked in: another list starts unfiltered */
  scope: string
  filter: ListFilter
}

interface ListFilterApi {
  /** Where phones show the filter button: the end of the top bar */
  slot: HTMLElement | null
  setSlot: (element: HTMLElement | null) => void
  state: FilterState | null
  select: (scope: string, option: ListFilterOption) => void
  clear: () => void
}

const ListFilterContext = createContext<ListFilterApi | null>(null)

const OPTION_LABELS = {
  attachments: 'thread.toolbar.filters.attachments',
  unread: 'thread.toolbar.filters.unread',
  starred: 'thread.toolbar.filters.starred'
} as const satisfies Record<ListFilterOption, string>

/** The key of the label of a filter: the menu entry and the toast name it */
export function listFilterLabelKey(
  option: ListFilterOption
): (typeof OPTION_LABELS)[ListFilterOption] {
  return OPTION_LABELS[option]
}

export interface ListFilterProviderProps {
  children: ReactNode
}

/**
 * The filter of the email list on screen (tmail-flutter's
 * `filterMessageOption` of the dashboard): one at a time for the session,
 * dropped when another list is shown. Picking the active one clears it; a
 * toast says which filter is on.
 */
export function ListFilterProvider({
  children
}: ListFilterProviderProps): ReactElement {
  const { t } = useI18n()
  const { notify } = useNotify()
  const [state, setState] = useState<FilterState | null>(null)
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  const clear = useCallback((): void => {
    setState(null)
    notify({ message: t('thread.toolbar.filterOff'), severity: 'info' })
  }, [notify, t])

  const select = useCallback(
    (scope: string, option: ListFilterOption): void => {
      if (state?.scope === scope && state.filter === option) {
        clear()
        return
      }
      setState({ scope, filter: option })
      notify({
        message: t('thread.toolbar.filterOn', {
          name: t(listFilterLabelKey(option))
        }),
        severity: 'info'
      })
    },
    [state, clear, notify, t]
  )

  const api = useMemo(
    () => ({ state, select, clear, slot, setSlot }),
    [state, select, clear, slot]
  )
  return (
    <ListFilterContext.Provider value={api}>
      {children}
    </ListFilterContext.Provider>
  )
}

export interface ListFilterControl {
  filter: ListFilter
  select: (option: ListFilterOption) => void
  clear: () => void
}

const NO_FILTER: ListFilterApi = {
  slot: null,
  setSlot: () => undefined,
  state: null,
  select: () => undefined,
  clear: () => undefined
}

/** The filter of the list `scope` (a folder, a label…), `all` if none */
export function useListFilter(scope: string | null): ListFilterControl {
  const api = useContext(ListFilterContext) ?? NO_FILTER
  const filter: ListFilter =
    scope !== null && api.state?.scope === scope ? api.state.filter : 'all'
  return useMemo(
    () => ({
      filter,
      select: option => {
        if (scope !== null) api.select(scope, option)
      },
      clear: api.clear
    }),
    [filter, scope, api]
  )
}

/**
 * Where phones show the filter button of the list: tmail-flutter's mobile
 * app bar holds it, so the top bar renders this slot and the list on screen
 * fills it. Null when there is no top bar to host it.
 */
export function useListFilterSlot(): HTMLElement | null {
  return (useContext(ListFilterContext) ?? NO_FILTER).slot
}

/** The place of the filter button in the top bar, on phones */
export function ListFilterSlot(): ReactElement {
  const { setSlot } = useContext(ListFilterContext) ?? NO_FILTER
  return (
    <span
      ref={setSlot}
      className="u-flex u-flex-items-center"
      data-testid="list-filter-slot"
    />
  )
}
