// Upstream to twake-ui: yes. The design puts the search at the top of the
// page, under the app bar, as a wide pill with one icon button at the far
// end of the row (the settings); twake-mui only has the bar itself
// (`SearchBar`), not this row.
import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode, Ref } from 'react'

/** The search is 700 px wide in the design, less when the room is short */
const SEARCH_WIDTH = 700
const ROW_SX = { px: 2, pt: 1.5, pb: 1 } as const
const SEARCH_SX = { flex: `0 1 ${SEARCH_WIDTH}px`, minWidth: 0 } as const

export interface SearchRowProps {
  /** The search field, e.g. a `SearchCombobox` */
  search: ReactNode
  /** Buttons at the far end of the row, e.g. the settings */
  actions?: ReactNode
  /** Reaches the box around the search, to move the focus into it */
  searchRef?: Ref<HTMLDivElement>
  'data-testid'?: string
}

/**
 * The row at the top of the page: the search is 700 px wide at the
 * start, the actions stay at the far end.
 */
export function SearchRow({
  search,
  actions,
  searchRef,
  'data-testid': testId
}: SearchRowProps): ReactElement {
  return (
    <Box
      className="u-flex u-flex-items-center"
      sx={ROW_SX}
      data-testid={testId}
    >
      <Box ref={searchRef} sx={SEARCH_SX}>
        {search}
      </Box>
      <Box className="u-flex-auto" />
      {actions}
    </Box>
  )
}
