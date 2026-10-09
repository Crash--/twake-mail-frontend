// Upstream to twake-ui: yes, with `RowHoverActions`. tmail-flutter's list row
// is a flex line: the preview runs up to the date, and up to the actions
// when they replace it on hover. A table cannot size a column per row, so
// the cell of the date is narrow and its content runs out of it; this keeps
// its room at the end of the cell before, as wide as the date of the row.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { ROW_CONTAINERS } from './rowContainers'

export interface RowHoverSpaceProps {
  /**
   * A copy of what `RowHoverActions` replaces (the date of the row, without
   * test ids nor controls): hidden, it only takes its width
   */
  children: ReactNode
  /** Its room on hover or focus, in px: the actions and the gap before */
  hoverWidth: number
  /** Before it, in px */
  gap: number
  in?: keyof typeof ROW_CONTAINERS
}

/**
 * The room of the date of a row, then of its actions on hover or focus, at
 * the end of the cell before them. Nothing on a screen without hover, where
 * the cell of the date holds both.
 */
export function RowHoverSpace({
  children,
  hoverWidth,
  gap,
  in: container = 'tableRow'
}: RowHoverSpaceProps): ReactElement {
  const row = ROW_CONTAINERS[container]
  return (
    <Box
      component="span"
      aria-hidden="true"
      className="u-flex u-flex-items-center"
      data-row-space=""
      sx={{
        flex: 'none',
        ml: `${gap}px`,
        visibility: 'hidden',
        whiteSpace: 'nowrap',
        [`${row}:hover &, ${row}:focus-within &`]: {
          width: hoverWidth - gap,
          '& > *': { display: 'none' }
        },
        '@media (hover: none)': { display: 'none' }
      }}
    >
      {children}
    </Box>
  )
}
