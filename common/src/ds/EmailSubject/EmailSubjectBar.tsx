// Upstream to twake-ui: no, the frame of tmail-flutter's subject
// (`EmailSubjectWidget`): 16 px around it (12 on a phone), its labels on the
// same line, 10 px after it.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { useIsReadingInset } from '@/ds/ReadingPane/ReadingPane'
import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

const BAR_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  p: '16px',
  [`@media ${SCREEN_QUERIES.mobile}`]: { p: '12px' }
} as const
const INSET_BAR_SX = {
  ...BAR_SX,
  px: 0,
  [`@media ${SCREEN_QUERIES.mobile}`]: { py: '12px', px: 0 }
} as const
// The subject gives way to its labels: it keeps its two lines, with an
// ellipsis, rather than pushing them under it
const SUBJECT_SX = { flex: '0 1 auto', minWidth: 0 } as const
// Many labels wrap among themselves, on half of the line at most
const END_SX = { flex: '0 0 auto', maxWidth: '50%' } as const

export interface EmailSubjectBarProps {
  /** The `EmailSubject` */
  children: ReactNode
  /** After the subject, on its line: its labels, its tags */
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
    <Box sx={useIsReadingInset() ? INSET_BAR_SX : BAR_SX} data-testid={testId}>
      <Box sx={SUBJECT_SX}>{children}</Box>
      {end ? <Box sx={END_SX}>{end}</Box> : null}
    </Box>
  )
}
