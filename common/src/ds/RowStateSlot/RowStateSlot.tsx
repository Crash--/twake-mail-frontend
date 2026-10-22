// Upstream to twake-ui: no, a layout detail of the list. Its rows keep a
// 28 px slot for each state icon (answered or forwarded, unread), empty when
// the state is off, so that the avatars of the rows line up.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const SLOT_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 28,
  height: 28,
  color: 'text.icon'
} as const

export interface RowStateSlotProps {
  /** A 16 to 20 px icon, or nothing */
  children?: ReactNode
}

/** A 28 px slot centring a state icon of a row */
export function RowStateSlot({ children }: RowStateSlotProps): ReactElement {
  return (
    <Box component="span" sx={SLOT_SX}>
      {children}
    </Box>
  )
}
