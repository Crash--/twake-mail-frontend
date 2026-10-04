import { useMemo } from 'react'
import { useLocation, useMatch } from 'react-router'

import { parseSearchParams, type SearchFilter } from './searchFilter'
import { readSortOrder } from './searchStorage'

/** The search the URL holds on the results (`/search/*`), null elsewhere */
export function useUrlSearchFilter(): SearchFilter | null {
  const isSearch = useMatch('/search/*') !== null
  const { search } = useLocation()
  return useMemo(
    () =>
      isSearch
        ? parseSearchParams(new URLSearchParams(search), readSortOrder())
        : null,
    [isSearch, search]
  )
}
