// Upstream to twake-ui: no, a menu of one choice (the date, the order and
// the label of a search): the one chosen is followed by a blue tick, and the
// menu may be capped in height for the labels. twake-mui's `MenuItem` has no
// checked mark.
import { Icon } from '@linagora/twake-icons'
import { Box, ListItemText, Menu, MenuItem } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { FilterSelected } from '@/ds/FlutterIcons/FlutterIcons'

const MARK_SX = {
  display: 'flex',
  flexShrink: 0,
  ml: '16px',
  color: 'primary.main'
} as const

export interface ChoiceMenuItem {
  key: string
  label: string
  isSelected: boolean
  onSelect: () => void
}

export interface ChoiceMenuProps {
  /** The element it hangs from; null while closed */
  anchorEl: HTMLElement | null
  items: readonly ChoiceMenuItem[]
  onClose: () => void
  /** In px, e.g. 400 for the labels as tmail-flutter */
  maxHeight?: number
  id?: string
  'data-testid'?: string
}

/**
 * A menu of exclusive choices (`menuitemradio`): picking one closes it and
 * gives the focus back to what opened it.
 */
export function ChoiceMenu({
  anchorEl,
  items,
  onClose,
  maxHeight,
  id,
  'data-testid': testId
}: ChoiceMenuProps): ReactElement {
  return (
    <Menu
      id={id}
      open={anchorEl !== null}
      anchorEl={anchorEl}
      onClose={onClose}
      slotProps={{ paper: { sx: { maxHeight } } }}
      data-testid={testId}
    >
      {items.map(item => (
        <MenuItem
          key={item.key}
          role="menuitemradio"
          aria-checked={item.isSelected}
          onClick={() => {
            onClose()
            item.onSelect()
          }}
        >
          <ListItemText primary={item.label} />
          {item.isSelected ? (
            <Box component="span" sx={MARK_SX}>
              <Icon icon={FilterSelected} size={16} aria-hidden="true" />
            </Box>
          ) : null}
        </MenuItem>
      ))}
    </Menu>
  )
}
