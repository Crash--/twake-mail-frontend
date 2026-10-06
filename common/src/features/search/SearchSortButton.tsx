import { Swap } from '@linagora/twake-icons'
import { Menu, MenuItem } from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

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
}

/**
 * The order of the results, at the end of the list toolbar: a button showing
 * the current order and opening the menu of the orders. The order picked is
 * remembered for the next searches.
 */
export function SearchSortButton({
  filter,
  onChange
}: SearchSortButtonProps): ReactElement {
  const { t } = useI18n()
  const menuId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  return (
    <>
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
      <Menu
        id={menuId}
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => {
          setAnchor(null)
        }}
        data-testid="search-filter-menu"
      >
        {SORT_ORDERS.map(order => (
          <MenuItem
            key={order}
            role="menuitemradio"
            aria-checked={filter.sort === order}
            selected={filter.sort === order}
            onClick={() => {
              setAnchor(null)
              storeSortOrder(order)
              onChange({ ...filter, sort: order })
            }}
          >
            {t(SORT_LABELS[order])}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
