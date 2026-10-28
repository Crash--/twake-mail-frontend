// Upstream to twake-ui: no, twake-mui's `xsmall` Button (11 px) in the
// secondary text colour, the text button of a sidebar row in the design
// ("Clean" on Spam), with a 44 px touch target.
import { Button, Tooltip } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

import { TOUCH_MEDIA, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'

export interface RowTextActionProps {
  /** The text, and the accessible name */
  children: string
  /** What it does, in full: the tooltip and the accessible description */
  description: string
  onClick: (event: MouseEvent<HTMLElement>) => void
  'data-testid'?: string
}

/** A small text button shown at the end of a row, on hover or focus */
export function RowTextAction({
  children,
  description,
  onClick,
  'data-testid': testId
}: RowTextActionProps): ReactElement {
  return (
    <Tooltip title={description} describeChild>
      <Button
        variant="text"
        color="inherit"
        size="xsmall"
        onClick={onClick}
        data-testid={testId}
        sx={{
          color: 'text.secondary',
          [TOUCH_MEDIA]: { minHeight: TOUCH_TARGET_SIZE }
        }}
      >
        {children}
      </Button>
    </Tooltip>
  )
}
