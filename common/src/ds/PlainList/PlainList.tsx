// Upstream to twake-ui: no. A `ul` without bullets, margin nor padding, for
// list items that draw themselves (`FolderVisibilityRow`); twake-mui's
// `List` adds its own padding and expects `ListItem`s, twake-css has no
// `list-style` utility.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const LIST_SX = { listStyle: 'none', m: 0, p: 0 } as const

export interface PlainListProps {
  /** Accessible name of the list */
  label: string
  children: ReactNode
  'data-testid'?: string
}

/** A bare list, named by `label` */
export function PlainList({
  label,
  children,
  'data-testid': testId
}: PlainListProps): ReactElement {
  return (
    <Box component="ul" aria-label={label} sx={LIST_SX} data-testid={testId}>
      {children}
    </Box>
  )
}
