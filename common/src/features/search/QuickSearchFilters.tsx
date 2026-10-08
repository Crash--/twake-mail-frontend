import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import {
  Account,
  Attachment,
  Calendar,
  StarOutline
} from '@/ds/FlutterIcons/FlutterIcons'
import { FilterChip } from '@/ds/FilterChip/FilterChip'
import { useI18n } from '@common/i18n/useI18n'

import type { SearchFilter } from './searchFilter'

export interface QuickSearchFiltersProps {
  filter: SearchFilter
  /** The address of the user, for "From me" */
  ownAddress: string
  onChange: (filter: SearchFilter) => void
}

/**
 * The filters offered under the search field while typing, as in
 * tmail-flutter: has attachment, last 7 days, from me, starred. They change
 * the search being typed; it runs on submit. Clicking keeps the focus in
 * the field; with the keyboard they follow it in the tab order.
 */
export function QuickSearchFilters({
  filter,
  ownAddress,
  onChange
}: QuickSearchFiltersProps): ReactElement {
  const { t } = useI18n()
  const isFromMe = filter.from.includes(ownAddress)
  const isLast7Days = filter.dateRange === 'last7Days'

  // The chips keep a bottom margin for when they wrap: half a padding below
  // them makes the space the same above and below
  return (
    <Box
      role="group"
      aria-label={t('search.quickFilters')}
      className="u-flex u-flex-wrap u-pt-1 u-ph-1 u-pb-half"
      data-testid="quick-search-filters"
    >
      <span className="u-mr-half u-mb-half">
        <FilterChip
          label={t('search.filters.hasAttachment')}
          icon={Attachment}
          isSelected={filter.hasAttachment}
          keepFocus
          onClick={() => {
            onChange({ ...filter, hasAttachment: !filter.hasAttachment })
          }}
          data-testid="quick-search-filter-has-attachment"
        />
      </span>
      <span className="u-mr-half u-mb-half">
        <FilterChip
          label={t('search.dates.last7Days')}
          icon={Calendar}
          isSelected={isLast7Days}
          keepFocus
          onClick={() => {
            onChange({
              ...filter,
              dateRange: isLast7Days ? 'allTime' : 'last7Days',
              startDate: null,
              endDate: null
            })
          }}
          data-testid="quick-search-filter-last-7-days"
        />
      </span>
      <span className="u-mr-half u-mb-half">
        <FilterChip
          label={t('search.filters.fromMe')}
          icon={Account}
          isSelected={isFromMe}
          keepFocus
          onClick={() => {
            onChange({
              ...filter,
              from: isFromMe
                ? filter.from.filter(address => address !== ownAddress)
                : [...filter.from, ownAddress]
            })
          }}
          data-testid="quick-search-filter-from-me"
        />
      </span>
      <span className="u-mr-half u-mb-half">
        <FilterChip
          label={t('search.filters.starred')}
          icon={StarOutline}
          isSelected={filter.starred}
          keepFocus
          onClick={() => {
            onChange({ ...filter, starred: !filter.starred })
          }}
          data-testid="quick-search-filter-starred"
        />
      </span>
    </Box>
  )
}
