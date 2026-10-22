// Upstream to twake-ui: no, a match of a search on `warning.light`, in the
// colour of its text, where the browser's `mark` is plain yellow and black.
import { Box, type Theme } from '@linagora/twake-mui'
import type { SystemStyleObject } from '@mui/system'
import type { ReactElement, ReactNode } from 'react'

// In the dark scheme the text is light: kept as is it would melt into the
// highlight, so the match takes the dark contrast text there
const MARK_SX = (theme: Theme): SystemStyleObject<Theme> => ({
  bgcolor: 'warning.light',
  color: 'inherit',
  ...theme.applyStyles('dark', {
    color: theme.vars.palette.warning.contrastText
  })
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
