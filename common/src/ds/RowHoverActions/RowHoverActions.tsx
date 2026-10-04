// Upstream to twake-ui: yes, as the `MuiTableRow` theme rule (or a
// `VirtualizedTable` slot) that Twake Contacts is also waiting for (see its
// ContactRowActions.tsx): actions shown on row hover only.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface RowHoverActionsProps {
  children: ReactNode
}

/**
 * Actions of a table row, shown when the row is hovered or holds the focus:
 * keyboard users tab to them like to any control, touch screens (no hover)
 * always show them.
 */
export function RowHoverActions({
  children
}: RowHoverActionsProps): ReactElement {
  return (
    <Box
      className="u-flex u-flex-items-center u-flex-justify-end"
      sx={{
        // Transparent rather than hidden: the actions stay in the tab
        // order, in both directions, and show up once they get the focus
        opacity: 0,
        '.MuiTableRow-root:hover &, .MuiTableRow-root:focus-within &': {
          opacity: 1
        },
        '@media (hover: none)': { opacity: 1 }
      }}
    >
      {children}
    </Box>
  )
}
