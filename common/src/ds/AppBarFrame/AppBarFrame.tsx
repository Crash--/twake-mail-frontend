// Upstream to twake-ui: yes, as options of the platform bar
// (`@linagora/twake-bar`): its margins.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

/** 4 px of the page background before the sidebar and the page, as the design */
const BASE_SX = {
  flexShrink: 0,
  mb: '4px'
} as const

const FRAME_SX = {
  ...BASE_SX,
  '& > header': {
    pl: '30px',
    pr: '30px'
  }
} as const

const LEFT_SX = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0
} as const

export interface AppBarFrameProps {
  /** The platform bar, a `header` */
  children: ReactNode
  /**
   * Leaves the margins of the bar as they are (the platform of Twake
   * Workplace answers): the same element, so that the bar does not mount
   * again when it changes
   */
  isPlain?: boolean
}

/** Around the platform bar: its margins, the gap under it */
export function AppBarFrame({
  children,
  isPlain = false
}: AppBarFrameProps): ReactElement {
  return <Box sx={isPlain ? BASE_SX : FRAME_SX}>{children}</Box>
}

export interface AppBarLeftProps {
  /** The logotype */
  children: ReactNode
  /** The width of the sidebar under it */
  width: number
}

/** The start of the bar, as wide as the sidebar under it (minus the margin) */
export function AppBarLeft({ children, width }: AppBarLeftProps): ReactElement {
  return <Box sx={{ ...LEFT_SX, width: `${width - 30}px` }}>{children}</Box>
}
