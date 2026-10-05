// Upstream to twake-ui: no, a one-line sticky wrapper.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const STICKY_SX = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  bgcolor: 'background.paper'
} as const

export interface StickyBarProps {
  children: ReactNode
  /** ARIA role of the bar, e.g. `toolbar` */
  role?: string
  /** Accessible name of the bar */
  label?: string
  className?: string
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
  'data-testid': testId
}: StickyBarProps): ReactElement {
  return (
    <Box
      role={role}
      aria-label={label}
      className={className}
      sx={STICKY_SX}
      data-testid={testId}
    >
      {children}
    </Box>
  )
}
