// Upstream to twake-ui: no, a layout detail of the Figma's settings: some
// settings (Folder visibility) are a 628 px column on a tablet or a desktop,
// and take the width on a phone. twake-css has no max-width utility of that
// size.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const COLUMN_SX = { maxWidth: 628 } as const

/** A 628 px column at most */
export function NarrowColumn({
  children
}: {
  children: ReactNode
}): ReactElement {
  return <Box sx={COLUMN_SX}>{children}</Box>
}
