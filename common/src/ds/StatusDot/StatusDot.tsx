// Upstream to twake-ui: yes. A status dot without a number (unread, online,
// new) is a common need; twake-mui only has the numbered `Badge`.
import { CircleFilled, Icon } from '@linagora/twake-icons'
import { Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export interface StatusDotProps {
  /**
   * What the dot means, e.g. "Unread": its accessible name. The colour is
   * never the only carrier of the information (RGAA 3.1).
   */
  label: string | null
  /**
   * Centred in a 20 px frame, which stays (empty) when `label` is null: the
   * names next to dots of several rows line up
   */
  framed?: boolean
  'data-testid'?: string
}

/**
 * An 8 px dot in the primary colour, announced as an image named `label`
 * (a null label draws nothing, only the frame if there is one).
 */
export function StatusDot({
  label,
  framed = false,
  'data-testid': testId
}: StatusDotProps): ReactElement {
  return (
    <Typography
      component="span"
      color="primary"
      className="u-flex u-flex-items-center u-flex-justify-center u-flex-shrink-0"
      sx={framed ? { width: 20, height: 20 } : undefined}
    >
      {label === null ? null : (
        <Icon
          icon={CircleFilled}
          size={framed ? 9 : 8}
          role="img"
          aria-label={label}
          data-testid={testId}
        />
      )}
    </Typography>
  )
}
