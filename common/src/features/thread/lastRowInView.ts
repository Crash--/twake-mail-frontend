/** A row the virtualized list rendered, as react-virtuoso reports it */
export interface RenderedRow {
  index: number
  offset: number
  size: number
}

/**
 * Index of the last row in view, or null when no row is rendered. The list
 * renders `overscanPx` beyond the viewport (its `increaseViewportBy`), which
 * its rendered range includes: the rows starting in those last pixels are
 * not in view. At the end of the list, where nothing is rendered beyond the
 * viewport, it may count a few rows in view as out of it.
 */
export function lastRowInView(
  rows: readonly RenderedRow[],
  overscanPx: number
): number | null {
  const first = rows.at(0)
  const last = rows.at(-1)
  if (first === undefined || last === undefined) return null
  const viewportEnd = last.offset + last.size - overscanPx
  const inView = rows.filter(row => row.offset < viewportEnd)
  return (inView.at(-1) ?? first).index
}
