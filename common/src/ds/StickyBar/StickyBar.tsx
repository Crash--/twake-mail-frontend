// Upstream to twake-ui: no, a one-line sticky wrapper.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const STICKY_SX = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  bgcolor: 'background.paper'
} as const

// The app bar of tmail-flutter's reading view: 52 px, a 0.5 px divider
const DIVIDER_SX = {
  ...STICKY_SX,
  minHeight: 52,
  boxSizing: 'border-box',
  borderBottom: '0.5px solid #D7D8D9'
} as const

export interface StickyBarProps {
  children: ReactNode
  /** ARIA role of the bar, e.g. `toolbar` */
  role?: string
  /** Accessible name of the bar */
  label?: string
  className?: string
  /** A line under the bar, the toolbar of a reading view */
  hasDivider?: boolean
  'data-testid'?: string
}

/**
 * A bar staying at the top of the scrolling area it is in, e.g. the actions
 * of a long conversation, on phones where nothing else stays in view.
 */
export function StickyBar({
  children,
  role,
  label,
  className,
  hasDivider = false,
  'data-testid': testId
}: StickyBarProps): ReactElement {
  return (
    <Box
      role={role}
      aria-label={label}
      className={className}
      sx={hasDivider ? DIVIDER_SX : STICKY_SX}
      data-testid={testId}
    >
      {children}
    </Box>
  )
}
