// Upstream to twake-ui: no, a typographic detail of the Twake Mail list.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { rowTextSx } from '@/ds/RowLine/rowText'

export interface RowDateProps {
  children: ReactNode
  /** The row stands out (unread): Semi Bold and black, else steel grey */
  isStrong?: boolean
  'data-testid'?: string
}

/** The date of a list row, as its subject: 12 px, Semi Bold when unread */
export function RowDate({
  children,
  isStrong = false,
  'data-testid': testId
}: RowDateProps): ReactElement {
  return (
    <Box
      component="span"
      sx={{
        ...rowTextSx(isStrong),
        whiteSpace: 'nowrap',
        // Cut with an ellipsis when its cell is too narrow
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}
      data-testid={testId}
    >
      {children}
    </Box>
  )
}
