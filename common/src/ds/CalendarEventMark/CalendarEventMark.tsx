// Upstream to twake-ui: no, the mark of the rows carrying a calendar event: a
// 20 px outline calendar in text.secondary, read or unread, before the
// subject (12 px on a desktop, 8 on a tablet, 4 on a phone).
import { CalendarToday, Icon } from '@linagora/twake-icons'
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const MARK_SX = {
  display: 'inline-flex',
  flexShrink: 0,
  color: 'text.secondary'
} as const

export interface CalendarEventMarkProps {
  /** The space after it, in px */
  gap: 4 | 8 | 12
  'data-testid'?: string
}

/** Decorative: the row says it in its name */
export function CalendarEventMark({
  gap,
  'data-testid': testId
}: CalendarEventMarkProps): ReactElement {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{ ...MARK_SX, mr: `${String(gap)}px` }}
      data-testid={testId}
    >
      <Icon icon={CalendarToday} size={20} />
    </Box>
  )
}
