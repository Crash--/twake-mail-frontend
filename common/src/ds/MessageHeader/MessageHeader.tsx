// Upstream to twake-ui: yes, see docs/twake-mui-gaps.md "Email header":
// twake-mui has no message header (identity, recipients, date), and a
// flex row of them does not reflow on a phone.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

const ROOT_SX = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gridTemplateAreas: '"avatar identity date"',
  columnGap: 2,
  rowGap: 0.5,
  alignItems: 'start',
  // Long addresses wrap instead of widening the page (RGAA 10.11)
  overflowWrap: 'anywhere',
  [`@media ${SCREEN_QUERIES.mobile}`]: {
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    gridTemplateAreas: '"avatar identity" ". date"'
  }
} as const

export interface MessageHeaderProps {
  avatar: ReactNode
  /** Sender and recipients */
  identity: ReactNode
  date: ReactNode
  className?: string
}

/**
 * The header of a message: avatar, sender and recipients, and the date at
 * the end of the line; on phones the date goes under the recipients, and
 * long names and addresses wrap rather than overflow.
 */
export function MessageHeader({
  avatar,
  identity,
  date,
  className
}: MessageHeaderProps): ReactElement {
  return (
    <Box className={className} sx={ROOT_SX}>
      <Box sx={{ gridArea: 'avatar' }}>{avatar}</Box>
      <Box sx={{ gridArea: 'identity' }}>{identity}</Box>
      <Box sx={{ gridArea: 'date' }}>{date}</Box>
    </Box>
  )
}
