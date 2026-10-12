// Upstream to twake-ui: yes, as the `MuiTableRow` theme rule (or a
// `VirtualizedTable` slot) that Twake Contacts is also waiting for (see its
// ContactRowActions.tsx): actions shown on row hover only.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { ROW_CONTAINERS } from './rowContainers'

export interface RowHoverActionsProps {
  children: ReactNode
  /** What holds the actions: a table row, or a list item (a folder) */
  in?: keyof typeof ROW_CONTAINERS
  /**
   * What the actions take the place of on hover or focus (a date): it stays
   * in the DOM and the layout, only faded. On a screen without hover the
   * actions are shown beside it instead. With hover it keeps its whole
   * width and runs out of a narrower cell to the left, over the room
   * `RowHoverSpace` keeps at the end of the cell before.
   */
  replaces?: ReactNode
  /** With `replaces`: room after the actions, in px */
  endGap?: number
}

/**
 * Actions of a table row (or a list item), shown when it is hovered or holds the focus:
 * keyboard users tab to them like to any control, touch screens (no hover)
 * always show them.
 */
export function RowHoverActions({
  children,
  in: container = 'tableRow',
  replaces,
  endGap = 0
}: RowHoverActionsProps): ReactElement {
  const row = ROW_CONTAINERS[container]
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
            // Never cut: it runs out of its cell to the left
            '@media (hover: hover)': { flex: 'none' },
            // Beside the actions, it gives way to them rather than spilling
            // over the cell before
            '@media (hover: none)': {
              opacity: 1,
              minWidth: 0,
              overflow: 'hidden'
            }
          }}
        >
          {replaces}
        </Box>
        <Box
          className="u-flex u-flex-items-center u-flex-justify-end"
          data-row-actions=""
          sx={{
            position: 'absolute',
            right: 0,
            // As wide as they are, whatever the width of the cell
            width: 'max-content',
            // tmail-flutter's actions are 11 px apart
            gap: '11px',
            pr: `${endGap}px`,
            opacity: 0,
            [`${row}:hover &, ${row}:focus-within &`]: { opacity: 1 },
            '@media (hover: none)': {
              position: 'static',
              width: 'auto',
              flexShrink: 0,
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
      data-row-actions=""
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
