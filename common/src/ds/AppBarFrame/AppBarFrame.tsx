// Upstream to twake-ui: yes, as options of the platform bar
// (`@linagora/twake-bar`): its height is fixed to 48 px and its search slot
// grows to the menus. The bar is 50 px high and its search starts above the
// list, where the sidebar ends, and takes half the room left.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

/** The height of the bar (Figma) */
export const APP_BAR_HEIGHT = 50
/** The search: half the room, at least this wide */
const SEARCH_MIN_WIDTH = 576
/** The 30 px margins of the bar and the sidebar under its start (236 px) */
const APP_BAR_ROOM = 30 + 236

const FRAME_SX = {
  flexShrink: 0,
  '& > header': {
    height: `${APP_BAR_HEIGHT}px`,
    pl: '30px',
    pr: '30px'
  }
} as const

const PLAIN_SX = { flexShrink: 0 } as const

const LEFT_SX = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0
} as const

// Half the room after the start of the bar and its margins (not the slot,
// which the buttons at the end shorten)
const SEARCH_SX = {
  width: `max(calc((100vw - ${APP_BAR_ROOM}px) / 2), ${SEARCH_MIN_WIDTH}px)`,
  maxWidth: '100%'
} as const

export interface AppBarFrameProps {
  /** The platform bar, a `header` */
  children: ReactNode
  /**
   * Leaves the bar as it is (the platform of Twake Workplace answers): the
   * same element, so that the bar does not mount again when it changes
   */
  isPlain?: boolean
}

/** Around the platform bar: its height and margins */
export function AppBarFrame({
  children,
  isPlain = false
}: AppBarFrameProps): ReactElement {
  return <Box sx={isPlain ? PLAIN_SX : FRAME_SX}>{children}</Box>
}

export interface AppBarLeftProps {
  /** The logotype */
  children: ReactNode
  /** The width of the sidebar: the search starts where it ends */
  width: number
}

/** The start of the bar, as wide as the sidebar under it (minus the margin) */
export function AppBarLeft({ children, width }: AppBarLeftProps): ReactElement {
  return <Box sx={{ ...LEFT_SX, width: `${width - 30}px` }}>{children}</Box>
}

/** The search of the bar */
export function AppBarSearch({
  children
}: {
  children: ReactNode
}): ReactElement {
  return <Box sx={SEARCH_SX}>{children}</Box>
}
