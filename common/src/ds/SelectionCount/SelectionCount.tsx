// Upstream to twake-ui: no, the "N selected" of the selection bar, in
// twake-mui's `subtitle1` and `text.primary`.
import { Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const COUNT_SX = {
  typography: 'subtitle1',
  color: 'text.primary',
  mr: 1
} as const

export interface SelectionCountProps {
  children: ReactNode
  'data-testid'?: string
}

/** How many items are selected, said politely when it changes */
export function SelectionCount({
  children,
  'data-testid': testId
}: SelectionCountProps): ReactElement {
  return (
    <Typography role="status" sx={COUNT_SX} data-testid={testId}>
      {children}
    </Typography>
  )
}
