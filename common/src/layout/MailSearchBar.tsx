import type { ReactElement } from 'react'

import {
  EMPTY_SEARCH_FILTER,
  toSearchParams
} from '@common/features/search/searchFilter'
import { SearchField } from '@common/features/search/SearchField'
import { readSortOrder } from '@common/features/search/searchStorage'
import { useUrlSearchFilter } from '@common/features/search/useUrlSearchFilter'

/**
 * Search field of the top bar: it starts from the search on screen, and
 * starts over when another search is shown or the user leaves the results.
 */
export function MailSearchBar(): ReactElement {
  const urlFilter = useUrlSearchFilter()
  const filter = urlFilter ?? { ...EMPTY_SEARCH_FILTER, sort: readSortOrder() }
  const key = urlFilter === null ? 'none' : toSearchParams(urlFilter).toString()
  return <SearchField key={key} initialFilter={filter} />
}
