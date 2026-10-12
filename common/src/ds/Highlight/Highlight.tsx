// Upstream to twake-ui: no, the look of tmail-flutter's search results: a
// match on amber (`Colors.amberAccent[200]`), in the colour of its text,
// where the browser's `mark` is plain yellow and black.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const MARK_SX = { bgcolor: '#FFD740', color: 'inherit' } as const

export interface HighlightProps {
  children: ReactNode
}

/** A match of a search, in a `mark` */
export function Highlight({ children }: HighlightProps): ReactElement {
  return (
    <Box component="mark" sx={MARK_SX}>
      {children}
    </Box>
  )
}
