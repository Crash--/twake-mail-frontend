// Upstream to twake-ui: no, the mark of the rows carrying a calendar event: an
// outline calendar in text.secondary (20 px, 18 on a phone), read or unread,
// centred on the subject it precedes (12 px on a desktop, 8 on a tablet, 4 on
// a phone).
import { CalendarToday } from '@linagora/twake-icons'
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { Icon } from '@/ds/Icon/Icon'

const MARK_SX = {
  display: 'inline-flex',
  flexShrink: 0,
  // In the text of the subject: centred on its line, not on its baseline
  verticalAlign: 'text-bottom',
  color: 'text.secondary'
} as const

export interface CalendarEventMarkProps {
  /** The space after it, in px */
  gap: 4 | 8 | 12
  size?: 18 | 20
  'data-testid'?: string
}

/** Decorative: the row says it in its name */
export function CalendarEventMark({
  gap,
  size = 20,
  'data-testid': testId
}: CalendarEventMarkProps): ReactElement {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{ ...MARK_SX, mr: `${String(gap)}px` }}
      data-testid={testId}
    >
      <Icon icon={CalendarToday} size={size} />
    </Box>
  )
}
