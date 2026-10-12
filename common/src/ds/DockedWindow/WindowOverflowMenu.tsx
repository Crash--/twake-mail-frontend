// Upstream to twake-ui: yes, with DockedWindow and WindowDock: the windows
// the dock has no room for stay reachable from it.
import {
  Button,
  ButtonBase,
  Menu,
  MenuItem,
  Paper,
  Typography
} from '@linagora/twake-mui'
import {
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement
} from 'react'

import { OVERFLOW_MENU_WIDTH } from './WindowDock'

const TITLE_BAR_HEIGHT = 48

export interface WindowOverflowItem {
  id: string
  /** What tells the window apart: its title, or who it is for */
  label: string
}

export interface WindowOverflowMenuProps {
  /**
   * Text and accessible name of the button, with the number of windows,
   * e.g. "+2 messages"
   */
  label: string
  /** The windows left out, the newest first */
  items: readonly WindowOverflowItem[]
  /** Shows the window chosen: the caller moves the focus into it */
  onSelect: (id: string) => void
  /**
   * `dock`: a title bar at the start of the dock; `titleBar`: a button in
   * the title bar of the window shown (full screen, small screens)
   */
  variant?: 'dock' | 'titleBar'
  testIds?: { button?: string; menu?: string; item?: string }
}

/**
 * The windows of a `WindowDock` it has no room for (`fitWindows` puts them
 * in the overflow): a button naming how many, opening a menu that lists
 * them (arrow keys, Enter, Escape). Choosing one hands it to `onSelect`;
 * closing the menu otherwise gives the focus back to the button.
 */
export function WindowOverflowMenu({
  label,
  items,
  onSelect,
  variant = 'dock',
  testIds = {}
}: WindowOverflowMenuProps): ReactElement {
  const buttonId = useId()
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const isOpen = anchor !== null

  const handleOpen = (event: MouseEvent<HTMLElement>): void => {
    setAnchor(event.currentTarget)
  }

  const handleClose = (): void => {
    setAnchor(null)
    buttonRef.current?.focus()
  }

  const handleSelect = (id: string): void => {
    // The focus goes to the window chosen, not back to the button
    setAnchor(null)
    onSelect(id)
  }

  const buttonProps = {
    ref: buttonRef,
    id: buttonId,
    'aria-haspopup': 'menu' as const,
    'aria-expanded': isOpen,
    'aria-controls': isOpen ? menuId : undefined,
    onClick: handleOpen,
    'data-testid': testIds.button
  }

  return (
    <>
      {variant === 'dock' ? (
        <Paper
          elevation={8}
          className="u-flex u-flex-shrink-0 u-ov-hidden"
          sx={theme => ({
            pointerEvents: 'auto',
            width: OVERFLOW_MENU_WIDTH,
            height: TITLE_BAR_HEIGHT,
            borderRadius: 2,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            bgcolor: 'grey.100',
            ...theme.applyStyles('dark', { bgcolor: 'grey.800' })
          })}
        >
          <ButtonBase
            {...buttonProps}
            className="u-flex-auto u-ph-1"
            sx={{ justifyContent: 'center' }}
          >
            <Typography variant="subtitle2" noWrap>
              {label}
            </Typography>
          </ButtonBase>
        </Paper>
      ) : (
        <Button
          {...buttonProps}
          size="small"
          variant="text"
          className="u-flex-shrink-0"
        >
          {label}
        </Button>
      )}
      <Menu
        anchorEl={anchor}
        open={isOpen}
        onClose={handleClose}
        disableRestoreFocus
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ list: { id: menuId, 'aria-labelledby': buttonId } }}
        data-testid={testIds.menu}
      >
        {items.map(item => (
          <MenuItem
            key={item.id}
            onClick={() => {
              handleSelect(item.id)
            }}
            data-testid={testIds.item}
          >
            <Typography noWrap>{item.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
