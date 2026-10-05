// Upstream to twake-ui: no, a typographic detail of the Twake Mail list.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface RowDateProps {
  children: ReactNode
  /** The row stands out (unread): Semi Bold 12 / 18.4, else Regular 12 / 12 */
  isStrong?: boolean
  'data-testid'?: string
}

/** The date of a list row: 12 px, Semi Bold when unread */
export function RowDate({
  children,
  isStrong = false,
  'data-testid': testId
}: RowDateProps): ReactElement {
  return (
    <Box
      component="span"
      sx={{
        color: 'text.primary',
        fontSize: 12,
        whiteSpace: 'nowrap',
        fontWeight: isStrong ? 600 : 400,
        lineHeight: isStrong ? '18.4px' : '12px',
        letterSpacing: isStrong ? '0.25px' : '0.15px'
      }}
      data-testid={testId}
    >
      {children}
    </Box>
  )
}
