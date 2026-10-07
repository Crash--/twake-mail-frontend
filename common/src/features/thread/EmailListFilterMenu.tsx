import { Check, Cross, Filter, Icon } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip
} from '@linagora/twake-mui'
import { useId, useRef, useState, type ReactElement } from 'react'

import { FilterListIcon } from '@/ds/ListIcons/ListIcons'
import { IconAction } from '@/ds/IconAction/IconAction'
import { ToolbarButton } from '@/ds/ToolbarButton/ToolbarButton'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useI18n } from '@common/i18n/useI18n'

import type { ListFilter, ListFilterOption } from './listFilter'
import { listFilterLabelKey } from './ListFilterProvider'

export interface EmailListFilterMenuProps {
  current: ListFilter
  /** The filters this list offers */
  options: readonly ListFilterOption[]
  onSelect: (option: ListFilterOption) => void
  onClear: () => void
  className?: string
}

/**
 * "Filter" of the list toolbar, as tmail-flutter's filter button: a menu of
 * the filters, one at a time (picking the active one clears it), and a
 * button clearing the filter while one is on. Phones show the icon alone.
 * Clearing gives the focus to the filter button, as the clear button goes.
 */
export function EmailListFilterMenu({
  current,
  options,
  onSelect,
  onClear,
  className
}: EmailListFilterMenuProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const menuId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const isActive = current !== 'all'
  const label = isActive
    ? t(listFilterLabelKey(current))
    : t('thread.toolbar.filter')
  const clearLabel = t('thread.toolbar.clearFilter')
  const menuProps = {
    'aria-haspopup': 'menu',
    'aria-controls': anchor ? menuId : undefined,
    'aria-expanded': anchor ? true : undefined
  } as const

  return (
    <Box
      className={`u-flex u-flex-items-center u-flex-shrink-0 ${className ?? ''}`}
    >
      {isPhone ? (
        <Tooltip title={t('thread.toolbar.filter')}>
          <IconButton
            ref={filterButtonRef}
            aria-label={t('thread.toolbar.filter')}
            color={isActive ? 'primary' : 'default'}
            onClick={event => {
              setAnchor(event.currentTarget)
            }}
            data-testid="list-filter-button"
            {...menuProps}
          >
            <Icon icon={Filter} />
          </IconButton>
        </Tooltip>
      ) : (
        <ToolbarButton
          ref={filterButtonRef}
          label={label}
          icon={FilterListIcon}
          hasMenu
          isActive={isActive}
          onClick={event => {
            setAnchor(event.currentTarget)
          }}
          data-testid="list-filter-button"
          {...menuProps}
        />
      )}
      {isActive ? (
        <IconAction
          label={clearLabel}
          icon={Cross}
          iconSize={16}
          onClick={() => {
            onClear()
            filterButtonRef.current?.focus()
          }}
          data-testid="list-filter-clear-button"
        />
      ) : null}
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null)
        }}
        data-testid="list-filter-menu"
      >
        {options.map(option => (
          <MenuItem
            key={option}
            role="menuitemradio"
            aria-checked={current === option}
            onClick={() => {
              setAnchor(null)
              onSelect(option)
            }}
            data-testid={`quick-filter-${option}`}
          >
            <ListItemIcon>
              {current === option ? <Icon icon={Check} /> : null}
            </ListItemIcon>
            <ListItemText primary={t(listFilterLabelKey(option))} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}
