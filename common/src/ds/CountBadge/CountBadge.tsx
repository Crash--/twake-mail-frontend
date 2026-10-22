// Upstream to twake-ui: yes, as a navigation counter.
// twake-mui has no such badge: `Badge` is a dot over an avatar or an icon,
// and a small `Chip` is 24 px high.
import { Box, radius } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { formatCount } from './formatCount'

export interface CountBadgeProps {
  count: number
  'aria-hidden'?: boolean
  'data-testid'?: string
}

/**
 * A pill with a number (unread emails of a folder), the selected
 * background of the theme, overline text, at least 16 px wide, "999+" past 999.
 * Pass `aria-hidden` when the count is already part of the name of the
 * control it sits next to.
 */
export function CountBadge({
  count,
  'aria-hidden': ariaHidden,
  'data-testid': testId
}: CountBadgeProps): ReactElement {
  return (
    <Box
      component="span"
      aria-hidden={ariaHidden}
      data-testid={testId}
      className="u-flex-shrink-0"
      sx={{
        display: 'inline-block',
        boxSizing: 'border-box',
        minWidth: 16,
        px: '4.5px',
        borderRadius: radius.pill,
        textAlign: 'center',
        backgroundColor: 'action.selected',
        color: 'text.primary',
        typography: 'overline',
        whiteSpace: 'nowrap'
      }}
    >
      {formatCount(count)}
    </Box>
  )
}
