// Upstream to twake-ui: yes. A menu rising from the bottom edge on phones
// and tablets: a sheet with a drag handle, rounded at the top, the rows of a
// `Menu` and dividers between the groups. twake-mui's `Menu` is a popover
// and its `BottomSheet` holds no menu (no `role="menu"`, no arrow keys).
import { Box, Drawer, MenuList } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const PAPER_SX = {
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  maxHeight: '85dvh',
  pb: 'calc(24px + env(safe-area-inset-bottom))'
} as const

/** The handle of twake-mui's `BottomSheet`: 64 x 4 in a 48 px bar */
const HANDLE_SX = {
  flexShrink: 0,
  width: 64,
  height: 4,
  mx: 'auto',
  mt: '22px',
  mb: '22px',
  borderRadius: '99px',
  bgcolor: 'text.secondary'
} as const

const LIST_SX = {
  py: 0,
  overflowY: 'auto'
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
      slotProps={{ paper: { sx: PAPER_SX } }}
      data-testid={testId}
    >
      <Box sx={HANDLE_SX} aria-hidden="true" />
      <MenuList autoFocusItem={open} aria-label={label} sx={LIST_SX}>
        {children}
      </MenuList>
    </Drawer>
  )
}
