// Upstream to twake-ui: no, the look of tmail-flutter's detail pane of a
// landscape tablet with no email open: its title alone, Bold 20 black,
// centred; twake-mui's `Empty` adds a large icon.
import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

const ROOT_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  p: 2
} as const

const TITLE_SX = {
  fontSize: 20,
  fontWeight: 700,
  lineHeight: '24px',
  color: TMAIL.textBlack,
  textAlign: 'center'
} as const

export interface DetailPlaceholderProps {
  /** What the pane would show, e.g. "No email selected" */
  title: string
  'data-testid'?: string
}

/** The detail pane of a list-detail layout while nothing is open */
export function DetailPlaceholder({
  title,
  'data-testid': testId
}: DetailPlaceholderProps): ReactElement {
  return (
    <Box sx={ROOT_SX} data-testid={testId}>
      <Typography component="h2" sx={TITLE_SX}>
        {title}
      </Typography>
    </Box>
  )
}
