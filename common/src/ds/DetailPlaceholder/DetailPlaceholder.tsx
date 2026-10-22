import { Box, Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const ROOT_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  p: 2
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
      <Typography variant="h4" component="h2" align="center">
        {title}
      </Typography>
    </Box>
  )
}
