// Upstream to twake-ui: no, the layout of the compact mail rows of a phone
// (Figma Teammail 11827:29045): a control at the end of the last line of
// the row (the star), out of the link covering the row, its 20 px icon on
// the end edge of the lines above whatever the size of its touch target.
// The last line keeps `COMPACT_ROW_ASIDE_ROOM` for it (`CompactRowLines`
// `previewEndRoom`); the lines above run to the end.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { TOUCH_MEDIA, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'

/** The icon of the control and its button with a mouse, in px */
const ICON_SIZE = 20
const BUTTON_SIZE = 32
/** The height of the last line of `CompactRowLines` */
const LAST_LINE = 20

/** What the last line of the row leaves free for the control, in px */
export const COMPACT_ROW_ASIDE_ROOM = ICON_SIZE + 8

// Takes no room: a 32 px button, 44 px on touch screens, centred on the
// last line (which it overflows), its icon on the end edge
const CONTROL_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flexShrink: 0,
  width: 0,
  height: `${LAST_LINE}px`,
  '& > button': { mr: `${(ICON_SIZE - BUTTON_SIZE) / 2}px` },
  [TOUCH_MEDIA]: {
    '& > button': { mr: `${(ICON_SIZE - TOUCH_TARGET_SIZE) / 2}px` }
  }
} as const

export interface CompactRowAsideProps {
  /** The lines of the row (its link) */
  children: ReactNode
  /** The control at the end of the last line, e.g. a 20 px icon button */
  aside: ReactNode
}

/** The lines of a compact row and a control at the end of the last one */
export function CompactRowAside({
  children,
  aside
}: CompactRowAsideProps): ReactElement {
  return (
    <Box
      component="span"
      sx={{ display: 'flex', alignItems: 'flex-end', minWidth: 0 }}
    >
      <Box component="span" sx={{ flex: '1 1 auto', minWidth: 0 }}>
        {children}
      </Box>
      <Box component="span" sx={CONTROL_SX}>
        {aside}
      </Box>
    </Box>
  )
}
