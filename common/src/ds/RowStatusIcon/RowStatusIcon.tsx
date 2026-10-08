// Upstream to twake-ui: no, it is specific to the mail list. A passive state
// of a row drawn as an icon (replied, forwarded): a decorative image with a
// tooltip for the mouse, which is not a control, so it takes neither the
// focus nor a click. A button would announce an action the row does not offer.
// It is hidden from assistive technologies: the row says the state in its own
// name, and a second announcement would repeat it. No tooltip on touch: its
// long press would compete with the context menu of the row.
import { Box, Tooltip } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { TOUCH_MEDIA, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'

export interface RowStatusIconProps {
  /** What the state is, e.g. "Replied message": the tooltip of the mouse */
  label: string
  /** The icon, drawn on the current colour */
  children: ReactNode
  /** Side of the box holding the icon, in px: lines up with icon buttons, 44 px on touch like theirs */
  boxSize?: number
  'data-testid'?: string
}

/** The state of a row as a quiet, secondary coloured icon. */
export function RowStatusIcon({
  label,
  children,
  boxSize = 32,
  'data-testid': testId
}: RowStatusIconProps): ReactElement {
  return (
    <Tooltip title={label} disableTouchListener>
      <Box
        component="span"
        aria-hidden="true"
        className="u-flex u-flex-items-center u-flex-justify-center u-flex-shrink-0"
        sx={{
          width: boxSize,
          height: boxSize,
          color: 'text.secondary',
          [TOUCH_MEDIA]: { width: TOUCH_TARGET_SIZE }
        }}
        data-testid={testId}
      >
        {children}
      </Box>
    </Tooltip>
  )
}
