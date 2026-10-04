// Upstream to twake-ui: yes, with the nested `NavItem`s it serves (an
// expand toggle slot, see docs/twake-mui-gaps.md "Mailbox tree").
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { TOUCH_MEDIA, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'

const SLOT_SX = {
  width: '2rem',
  [TOUCH_MEDIA]: { width: TOUCH_TARGET_SIZE }
} as const

export interface IconSlotProps {
  /** An icon button, or nothing: the slot keeps its width to align rows */
  children?: ReactNode
}

/**
 * A fixed-width column holding a small icon button, e.g. the expand arrow
 * of a tree row: 2rem wide, and as wide as a touch target on touch screens
 * and phones, so that rows with and without a button stay aligned.
 */
export function IconSlot({ children }: IconSlotProps): ReactElement {
  return (
    <Box
      className="u-flex u-flex-items-center u-flex-justify-center u-flex-shrink-0"
      sx={SLOT_SX}
    >
      {children}
    </Box>
  )
}
