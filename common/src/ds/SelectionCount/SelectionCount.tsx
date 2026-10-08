// Upstream to twake-ui: no, the look of tmail-flutter's selection bar
// (`TopBarThreadSelection`): "N selected" in Regular 15, steel grey.
import { Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const COUNT_SX = {
  fontSize: 15,
  fontWeight: 400,
  lineHeight: '20px',
  color: '#55687D',
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
