import { Icon } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { Left } from '@/ds/FlutterIcons/FlutterIcons'
import { useI18n } from '@common/i18n/useI18n'

import { searchPath, type SearchFilter } from './searchFilter'
import { SearchFiltersBar } from './SearchFiltersBar'
import { useUrlSearchFilter } from './useUrlSearchFilter'

export interface SearchFiltersRowProps {
  filter: SearchFilter
}

/**
 * The back button and the filters of the search results. On a desktop, as
 * tmail-flutter, they sit above the white card of the list (`FlatMain`
 * header, `SearchFiltersHeader`), else at the top of the results.
 */
export function SearchFiltersRow({
  filter
}: SearchFiltersRowProps): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const backLabel = t('search.backToMailbox')

  const handleChange = (changed: SearchFilter): void => {
    void navigate(searchPath(changed), { replace: true })
  }
  const handleBack = (): void => {
    void navigate('/')
  }

  return (
    <Box className="u-flex u-flex-items-center">
      <Tooltip title={backLabel}>
        <IconButton
          size="small"
          aria-label={backLabel}
          onClick={handleBack}
          data-testid="search-results-back-button"
        >
          <Icon icon={Left} />
        </IconButton>
      </Tooltip>
      <SearchFiltersBar filter={filter} onChange={handleChange} />
    </Box>
  )
}

/** The filters of the search in the URL, for the header of the layout */
export function SearchFiltersHeader(): ReactElement | null {
  const filter = useUrlSearchFilter()
  return filter === null ? null : <SearchFiltersRow filter={filter} />
}
