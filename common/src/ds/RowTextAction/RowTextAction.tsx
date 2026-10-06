// Upstream to twake-ui: yes, as a `Button` size for a row (`size="small"` is
// 13 px). The text button of a sidebar row in the design ("Clean" on Spam)
// is 11/16 in the secondary text colour, without padding to speak of.
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
        size="small"
        onClick={onClick}
        data-testid={testId}
        sx={{
          minWidth: 0,
          px: 1,
          py: 0,
          fontSize: 11,
          lineHeight: '16px',
          letterSpacing: 0.5,
          color: 'text.secondary',
          [TOUCH_MEDIA]: { minHeight: TOUCH_TARGET_SIZE }
        }}
      >
        {children}
      </Button>
    </Tooltip>
  )
}
