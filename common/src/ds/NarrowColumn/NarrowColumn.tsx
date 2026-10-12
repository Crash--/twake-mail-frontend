// Upstream to twake-ui: no, a layout detail of tmail-flutter: some settings
// (Folder visibility) are a 315 px column, 12 px from the edge, on a tablet
// or a desktop, and take the width on a phone. twake-css has no max-width
// utility of that size.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

const COLUMN_SX = {
  width: 315,
  maxWidth: '100%',
  mx: '12px',
  [`@media ${SCREEN_QUERIES.mobile}`]: { width: 'auto' }
} as const

/** A 315 px column, full width on a phone */
export function NarrowColumn({
  children
}: {
  children: ReactNode
}): ReactElement {
  return <Box sx={COLUMN_SX}>{children}</Box>
}
