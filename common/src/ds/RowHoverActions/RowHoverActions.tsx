// Upstream to twake-ui: yes, as the `MuiTableRow` theme rule (or a
// `VirtualizedTable` slot) that Twake Contacts is also waiting for (see its
// ContactRowActions.tsx): actions shown on row hover only.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface RowHoverActionsProps {
  children: ReactNode
  /** What holds the actions: a table row, or a list item (a folder) */
  in?: 'tableRow' | 'listItem'
  /**
   * What the actions take the place of on hover or focus (a date): it stays
   * in the DOM and the layout, only faded. On a screen without hover the
   * actions are shown beside it instead.
   */
  replaces?: ReactNode
}

const CONTAINERS = {
  tableRow: '.MuiTableRow-root',
  listItem: '.MuiListItem-root'
} as const

/**
 * Actions of a table row (or a list item), shown when it is hovered or holds the focus:
 * keyboard users tab to them like to any control, touch screens (no hover)
 * always show them.
 */
export function RowHoverActions({
  children,
  in: container = 'tableRow',
  replaces
}: RowHoverActionsProps): ReactElement {
  const row = CONTAINERS[container]
  if (replaces !== undefined) {
    return (
      <Box
        className="u-flex u-flex-items-center u-flex-justify-end"
        sx={{ position: 'relative', width: '100%' }}
      >
        <Box
          className="u-flex u-flex-items-center"
          sx={{
            [`${row}:hover &, ${row}:focus-within &`]: { opacity: 0 },
            '@media (hover: none)': { opacity: 1 }
          }}
        >
          {replaces}
        </Box>
        <Box
          className="u-flex u-flex-items-center u-flex-justify-end"
          sx={{
            position: 'absolute',
            right: 0,
            opacity: 0,
            [`${row}:hover &, ${row}:focus-within &`]: { opacity: 1 },
            '@media (hover: none)': {
              position: 'static',
              opacity: 1,
              marginLeft: 1
            }
          }}
        >
          {children}
        </Box>
      </Box>
    )
  }
  return (
    <Box
      className="u-flex u-flex-items-center u-flex-justify-end"
      sx={{
        // Transparent rather than hidden: the actions stay in the tab
        // order, in both directions, and show up once they get the focus
        opacity: 0,
        [`${row}:hover &, ${row}:focus-within &`]: { opacity: 1 },
        '@media (hover: none)': { opacity: 1 }
      }}
    >
      {children}
    </Box>
  )
}
