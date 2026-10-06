// Upstream to twake-ui: yes. A row of chips that stays on one line and
// scrolls sideways when the room is short (the filters of the Figma search
// are one line at every width), with a thin scroll bar that only shows when
// there is something to scroll. twake-mui has no such container.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const ROW_SX = {
  display: 'flex',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: 0.75,
  minWidth: 0,
  overflowX: 'auto',
  // Hidden, not auto: the focus ring of a chip must not add a vertical bar
  overflowY: 'hidden',
  // Room for the focus ring, which the scrolling box would cut
  px: 0.5,
  py: 0.5,
  scrollbarWidth: 'thin',
  '& > *': { flexShrink: 0 }
} as const

export interface ScrollRowProps {
  /** Name of the toolbar for screen readers */
  label: string
  children: ReactNode
  'data-testid'?: string
}

/**
 * A `toolbar` of controls on one line. Wider than its room, it scrolls
 * sideways (a keyboard focus brings the control into view by itself).
 */
export function ScrollRow({
  label,
  children,
  'data-testid': testId
}: ScrollRowProps): ReactElement {
  return (
    <Box
      role="toolbar"
      aria-label={label}
      className="u-flex-auto"
      sx={ROW_SX}
      data-testid={testId}
    >
      {children}
    </Box>
  )
}
