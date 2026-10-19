// Upstream to twake-ui: no, the look of tmail-flutter's search results: a
// match on amber (`Colors.amberAccent[200]`), in the colour of its text,
// where the browser's `mark` is plain yellow and black.
import { Box, type Theme } from '@linagora/twake-mui'
import type { SystemStyleObject } from '@mui/system'
import type { ReactElement, ReactNode } from 'react'

// In the dark scheme the text is light: kept as is it would melt into the
// amber, so the match is written dark there
const MARK_SX = (theme: Theme): SystemStyleObject<Theme> => ({
  bgcolor: '#FFD740',
  color: 'inherit',
  ...theme.applyStyles('dark', { color: theme.palette.grey[900] })
})

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
