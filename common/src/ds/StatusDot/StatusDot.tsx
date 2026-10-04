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
  label: string
  'data-testid'?: string
}

/**
 * An 8 px dot in the primary colour, announced as an image named `label`.
 */
export function StatusDot({
  label,
  'data-testid': testId
}: StatusDotProps): ReactElement {
  return (
    <Typography
      component="span"
      color="primary"
      className="u-flex u-flex-items-center"
    >
      <Icon
        icon={CircleFilled}
        size={8}
        role="img"
        aria-label={label}
        data-testid={testId}
      />
    </Typography>
  )
}
