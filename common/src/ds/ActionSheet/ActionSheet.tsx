// Upstream to twake-ui: yes. tmail-flutter opens its menus from the bottom
// edge on phones and tablets (`openBottomSheetContextMenuAction`): a white
// sheet with a drag handle, rounded by 16 px at the top, 48 px rows (a 20 px
// icon 24 px in, a 16 px label) and dividers between the groups. twake-mui's
// `Menu` is a popover and its `Drawer` holds no menu.
import { Box, Drawer, MenuList } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const PAPER_SX = {
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  maxHeight: '85dvh',
  pb: 'calc(24px + env(safe-area-inset-bottom))'
} as const

/** Material's drag handle: 32 x 4, 22 px from the top */
const HANDLE_SX = {
  flexShrink: 0,
  width: 32,
  height: 4,
  mx: 'auto',
  mt: '22px',
  mb: '22px',
  borderRadius: 2,
  bgcolor: '#49454F'
} as const

/** Over the menu look of the theme (`ds/MenuLook`): grey, 16 px, wider */
const LIST_SX = {
  py: 0,
  overflowY: 'auto',
  '&& .MuiMenuItem-root': {
    minHeight: 48,
    px: '24px',
    fontSize: 16,
    lineHeight: '21px',
    letterSpacing: '-0.15px',
    color: 'rgba(66, 66, 68, 0.9)'
  },
  '&& .MuiListItemText-primary': {
    fontSize: 16,
    lineHeight: '21px',
    letterSpacing: '-0.15px',
    color: 'rgba(66, 66, 68, 0.9)'
  },
  '&& .MuiListItemIcon-root': {
    width: 20,
    minWidth: 20,
    mr: '24px',
    color: 'rgba(66, 66, 68, 0.72)'
  },
  '&& .MuiListItemIcon-root svg': { width: 20, height: 20 },
  '&& .MuiDivider-root': {
    my: '8px',
    borderColor: 'rgba(66, 66, 68, 0.12)'
  }
} as const

export interface ActionSheetProps {
  open: boolean
  /** Escape, a click outside */
  onClose: () => void
  /** Name of the menu */
  label: string
  /** `MenuItem`s and `Divider`s, as in a `Menu` */
  children: ReactNode
  'data-testid'?: string
}

/**
 * A menu rising from the bottom edge: the focus goes to its first item, the
 * arrows move between the items, Escape closes it and the focus goes back
 * to what opened it.
 */
export function ActionSheet({
  open,
  onClose,
  label,
  children,
  'data-testid': testId
}: ActionSheetProps): ReactElement {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: { sx: PAPER_SX },
        backdrop: { sx: { bgcolor: 'rgba(0, 0, 0, 0.2)' } }
      }}
      data-testid={testId}
    >
      <Box sx={HANDLE_SX} aria-hidden="true" />
      <MenuList autoFocusItem={open} aria-label={label} sx={LIST_SX}>
        {children}
      </MenuList>
    </Drawer>
  )
}
