// Upstream to twake-ui: no, the look of tmail-flutter's menus of one choice
// (`PopupMenuItemActionRequiredSelectedIcon`: the date, the order and the
// label of a search): the names in black, the one chosen followed by
// icFilterSelected, a 16 px blue disc holding a white tick, 16 px after
// it; 400 px high at most for the labels. twake-mui's `MenuItem` marks the
// chosen one with a background.
import { Icon } from '@linagora/twake-icons'
import { Box, ListItemText, Menu, MenuItem } from '@mui/material'
import type { ReactElement } from 'react'

import { FilterSelected } from '@/ds/FlutterIcons/FlutterIcons'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

/** `AppColor.primaryMain` */
const MARK_COLOR = TMAIL.primary0A

const MARK_SX = {
  display: 'flex',
  flexShrink: 0,
  ml: '16px',
  color: MARK_COLOR
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
