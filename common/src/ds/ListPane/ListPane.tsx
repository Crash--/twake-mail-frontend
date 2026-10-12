// Upstream to twake-ui: no, a layout detail of tmail-flutter: the list and
// its toolbar span the white card, the rows and the toolbar pad themselves.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface ListPaneProps {
  children: ReactNode
}

/**
 * The column holding a list and its toolbar: it fills the room left in its
 * parent and scrolls nothing itself (the list does).
 */
export function ListPane({ children }: ListPaneProps): ReactElement {
  return (
    <Box className="u-flex u-flex-column u-flex-auto" sx={{ minHeight: 0 }}>
      {children}
    </Box>
  )
}
