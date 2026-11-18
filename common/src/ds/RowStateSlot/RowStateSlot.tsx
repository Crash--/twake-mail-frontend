// Upstream to twake-ui: no, a layout detail of the list. A 32 px slot for a
// state icon of a row; the unread one stays empty when the email is read, so
// that the avatars of the rows line up.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const SLOT_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 32,
  height: 32,
  color: 'text.icon'
} as const

// Above the overlay of a row link (its `::after`), so that the pointer
// reaches the tooltip of the icon; a click still goes to the link
const IN_LINK_SX = { ...SLOT_SX, position: 'relative', zIndex: 1 } as const

export interface RowStateSlotProps {
  /** A 16 to 20 px icon, or nothing */
  children?: ReactNode
  /** In the row link: the icon has a tooltip to reach */
  inLink?: boolean
}

/** A 32 px slot centring a state icon of a row */
export function RowStateSlot({
  children,
  inLink = false
}: RowStateSlotProps): ReactElement {
  return (
    <Box component="span" sx={inLink ? IN_LINK_SX : SLOT_SX}>
      {children}
    </Box>
  )
}
