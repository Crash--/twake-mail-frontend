// Upstream to twake-icons: yes. The icon set has `Reply` only: "Reply all"
// (two arrows) and "Forward" (the arrow turned around) are drawn from it
// until twake-icons has them (docs/twake-mui-gaps.md "Reply all, Forward").
import { Icon, Reply } from '@linagora/twake-icons'
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export interface ReplyIconProps {
  /** Side of the icon, in px */
  size?: number
}

/** Two arrows, one behind the other */
export function ReplyAllIcon({ size = 20 }: ReplyIconProps): ReactElement {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        position: 'relative',
        display: 'inline-flex',
        width: size,
        height: size,
        '& > svg': { position: 'absolute', top: 0, width: size, height: size },
        '& > svg:first-of-type': { left: -size * 0.2 },
        '& > svg:last-of-type': { left: size * 0.2 }
      }}
    >
      <Icon icon={Reply} aria-hidden="true" />
      <Icon icon={Reply} aria-hidden="true" />
    </Box>
  )
}

/** The reply arrow, turned around */
export function ForwardIcon({ size = 20 }: ReplyIconProps): ReactElement {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        display: 'inline-flex',
        width: size,
        height: size,
        transform: 'scaleX(-1)',
        '& > svg': { width: size, height: size }
      }}
    >
      <Icon icon={Reply} aria-hidden="true" />
    </Box>
  )
}
