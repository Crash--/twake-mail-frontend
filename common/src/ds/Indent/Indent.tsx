// Upstream to twake-ui: no, a start margin in px.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface IndentProps {
  /** Start margin in px: e.g. an avatar and its gap, to line up under a name */
  size: number
  /** Pulls the content up under the line above, in px */
  pullUp?: number
  children: ReactNode
}

/** Content lined up with a column further in, such as the name of a sender */
export function Indent({
  size,
  pullUp = 0,
  children
}: IndentProps): ReactElement {
  return <Box sx={{ ml: `${size}px`, mt: `-${pullUp}px` }}>{children}</Box>
}
