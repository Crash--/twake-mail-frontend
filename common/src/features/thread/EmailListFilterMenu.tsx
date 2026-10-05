import { Check, Cross, Filter, Icon } from '@linagora/twake-icons'
import {
  Box,
  DropdownButton,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip
} from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

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
    <Box className={`u-flex u-flex-items-center ${className ?? ''}`}>
      {isPhone ? (
        <Tooltip title={t('thread.toolbar.filter')}>
          <IconButton
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
        <DropdownButton
          variant="text"
          color={isActive ? 'primary' : 'inherit'}
          startIcon={<Icon icon={Filter} />}
          onClick={event => {
            setAnchor(event.currentTarget)
          }}
          data-testid="list-filter-button"
          {...menuProps}
        >
          {label}
        </DropdownButton>
      )}
      {isActive ? (
        <Tooltip title={clearLabel}>
          <IconButton
            size="small"
            aria-label={clearLabel}
            onClick={onClear}
            data-testid="list-filter-clear-button"
          >
            <Icon icon={Cross} />
          </IconButton>
        </Tooltip>
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
