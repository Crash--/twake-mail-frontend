import { Swap } from '@linagora/twake-icons'
import { useId, useState, type ReactElement } from 'react'

import { ChoiceMenu } from '@/ds/ChoiceMenu/ChoiceMenu'
import { FilterChip } from '@/ds/FilterChip/FilterChip'
import { ToolbarButton } from '@/ds/ToolbarButton/ToolbarButton'
import { useI18n } from '@common/i18n/useI18n'

import {
  DEFAULT_SORT_ORDER,
  SORT_ORDERS,
  type SearchFilter
} from './searchFilter'
import { SORT_LABELS } from './searchLabels'
import { storeSortOrder } from './searchStorage'

export interface SearchSortButtonProps {
  filter: SearchFilter
  /** Runs the search with the changed order */
  onChange: (filter: SearchFilter) => void
  /**
   * `chip`: the last chip of the filters, as tmail-flutter's search view of
   * phones and tablets
   */
  variant?: 'button' | 'chip'
}

/**
 * The order of the results, at the end of the list toolbar: a button showing
 * the current order and opening the menu of the orders. The order picked is
 * remembered for the next searches.
 */
export function SearchSortButton({
  filter,
  onChange,
  variant = 'button'
}: SearchSortButtonProps): ReactElement {
  const { t } = useI18n()
  const menuId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  return (
    <>
      {variant === 'chip' ? (
        <FilterChip
          label={t(SORT_LABELS[filter.sort])}
          icon={Swap}
          popup="menu"
          isSelected={filter.sort !== DEFAULT_SORT_ORDER}
          isExpanded={anchor !== null}
          onClick={event => {
            setAnchor(event.currentTarget)
          }}
          data-testid="search-filter-sort-by"
        />
      ) : (
        <ToolbarButton
          label={t(SORT_LABELS[filter.sort])}
          icon={Swap}
          hasMenu
          isActive={filter.sort !== DEFAULT_SORT_ORDER}
          onClick={event => {
            setAnchor(event.currentTarget)
          }}
          aria-haspopup="menu"
          aria-controls={anchor === null ? undefined : menuId}
          aria-expanded={anchor !== null}
          data-testid="search-filter-sort-by"
        />
      )}
      <ChoiceMenu
        id={menuId}
        anchorEl={anchor}
        onClose={() => {
          setAnchor(null)
        }}
        items={SORT_ORDERS.map(order => ({
          key: order,
          label: t(SORT_LABELS[order]),
          isSelected: filter.sort === order,
          onSelect: () => {
            storeSortOrder(order)
            onChange({ ...filter, sort: order })
          }
        }))}
        data-testid="search-filter-menu"
      />
    </>
  )
}
