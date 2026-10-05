// Upstream to twake-ui: no, a layout detail of the Twake Mail design: the
// list and its toolbar never touch the edges of the page (16 px, except on
// phones).
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

export interface ListPaneProps {
  children: ReactNode
}

/**
 * The column holding a list and its toolbar: it fills the room left in its
 * parent, scrolls nothing itself (the list does) and keeps 16 px on each
 * side.
 */
export function ListPane({ children }: ListPaneProps): ReactElement {
  return (
    <Box
      className="u-flex u-flex-column u-flex-auto"
      sx={{
        minHeight: 0,
        px: 2,
        // Phones need the width: the rows touch the edges, the toolbar pads itself
        [`@media ${SCREEN_QUERIES.mobile}`]: { px: 0 }
      }}
    >
      {children}
    </Box>
  )
}
