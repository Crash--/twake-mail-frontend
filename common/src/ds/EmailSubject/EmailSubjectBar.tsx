// Upstream to twake-ui: no, the frame of tmail-flutter's subject
// (`EmailSubjectWidget`): 16 px around it (12 on a phone), its labels after
// it, 10 px apart, wrapping.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

const BAR_SX = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '10px',
  p: '16px',
  [`@media ${SCREEN_QUERIES.mobile}`]: { p: '12px' }
} as const

export interface EmailSubjectBarProps {
  /** The `EmailSubject` */
  children: ReactNode
  /** After the subject: its labels, its tags */
  end?: ReactNode
  'data-testid'?: string
}

/** The subject of an open email or conversation and its labels */
export function EmailSubjectBar({
  children,
  end,
  'data-testid': testId
}: EmailSubjectBarProps): ReactElement {
  return (
    <Box sx={BAR_SX} data-testid={testId}>
      {children}
      {end}
    </Box>
  )
}
