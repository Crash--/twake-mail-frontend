// Upstream to twake-ui: yes, with the table variant of `ListItemSkeleton`
// asked in docs/twake-mui-gaps.md ("Loading"): `ListItemSkeleton` is a 56 px
// list item, a table row of 44 px (or a few lines taller) is not.
import { Box, Table, TableBody, TableCell, TableRow } from '@linagora/twake-mui'
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'

import { SkeletonRegion } from '@/ds/SkeletonRegion/SkeletonRegion'
import {
  COMPACT_BELOW,
  makeRowLayoutSx,
  type RowLayout
} from '@/ds/VirtualizedListTable/VirtualizedListTable'

export interface ListTableSkeletonColumn {
  id: string
  /** Width in px; the column without one takes the rest */
  width?: number
  /** Start padding of the cell of a narrow row, in px (the text of a link) */
  paddingStart?: number
  /** What the cell of every row draws, e.g. `Skeleton`s */
  cell: ReactNode
}

export interface ListTableSkeletonProps {
  columns: readonly ListTableSkeletonColumn[]
  /** The columns of a narrow table, as `VirtualizedListTable`'s */
  compactColumns: readonly ListTableSkeletonColumn[]
  /** Forces the compact columns, whatever the width */
  compact?: boolean
  /** More rows than the screen holds: the extra ones are cut */
  rowCount: number
  /** The padding and gap of the real rows (the wide columns only) */
  rowLayout: RowLayout
  /** Height of the content of a cell of the wide rows (an icon button) */
  cellHeight: number
  /** The padding and gap of the real compact rows, when they have their own */
  compactRowLayout?: RowLayout
  className?: string
  'data-testid'?: string
}

const TABLE_SX = { tableLayout: 'fixed' } as const

/** Whether the node is narrower than the width of the compact columns */
function useIsNarrow(node: HTMLElement | null): boolean {
  const [isNarrow, setIsNarrow] = useState(false)
  useEffect(() => {
    if (node === null) return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width !== undefined && width > 0) setIsNarrow(width < COMPACT_BELOW)
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [node])
  return isNarrow
}

/**
 * The rows of a `VirtualizedListTable` while its data loads: the same table,
 * widths, padding and borders, with the shapes of the cells in place of
 * their content, so that the real rows land where the skeleton rows were.
 */
export function ListTableSkeleton({
  columns: wideColumns,
  compactColumns,
  compact = false,
  rowCount,
  rowLayout,
  cellHeight,
  compactRowLayout,
  className,
  'data-testid': testId
}: ListTableSkeletonProps): ReactElement {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const isNarrow = useIsNarrow(node)
  const isCompact = compact || isNarrow
  const columns = isCompact ? compactColumns : wideColumns
  const layout = isCompact ? compactRowLayout : rowLayout
  const rowSx = layout === undefined ? undefined : makeRowLayoutSx(layout)
  const rows = Array.from({ length: rowCount }, (_, index) => index)
  return (
    <SkeletonRegion
      className={className}
      data-testid={testId}
      rootRef={setNode}
    >
      <Box className="u-ov-hidden u-h-100">
        <Table sx={TABLE_SX}>
          <colgroup>
            {columns.map(column => (
              <Box
                component="col"
                key={column.id}
                sx={{ width: column.width }}
              />
            ))}
          </colgroup>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row} sx={rowSx}>
                {columns.map(column => (
                  <TableCell
                    key={column.id}
                    sx={
                      layout === undefined
                        ? { py: 1, pr: 0, pl: `${column.paddingStart ?? 0}px` }
                        : undefined
                    }
                  >
                    {isCompact ? (
                      column.cell
                    ) : (
                      <Box
                        className="u-flex u-flex-items-center"
                        sx={{ minHeight: cellHeight }}
                      >
                        {column.cell}
                      </Box>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </SkeletonRegion>
  )
}
