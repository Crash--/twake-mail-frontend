// Upstream to twake-ui: no, a layout detail of the list. A slot for a state
// icon of a row, kept when empty: the unread one when the email is read, so
// that the avatars line up; the attachment, so that the previews end in line.
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
  /** Its side, 32 px by default; 20 px holds the attachment icon exactly */
  size?: 20 | 32
  'data-testid'?: string
}

/** A square slot centring a state icon of a row, kept when empty */
export function RowStateSlot({
  children,
  inLink = false,
  size = 32,
  'data-testid': testId
}: RowStateSlotProps): ReactElement {
  return (
    <Box
      component="span"
      sx={{ ...(inLink ? IN_LINK_SX : SLOT_SX), width: size, height: size }}
      data-testid={testId}
    >
      {children}
    </Box>
  )
}
