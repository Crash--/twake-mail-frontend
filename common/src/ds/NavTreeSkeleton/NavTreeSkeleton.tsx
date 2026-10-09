// Upstream to twake-ui: yes, with the nested `NavItem` that
// docs/twake-mui-gaps.md ("Mailbox tree") asks for: a skeleton of its rows.
// `ListItemSkeleton` is a 56 px list item, a row of the sidebar is 36 px.
import { Box, Skeleton } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { SkeletonRegion } from '@/ds/SkeletonRegion/SkeletonRegion'

/** Width of the name of each row, in %: the names are not all as long */
const NAME_WIDTHS = [48, 62, 40, 55, 44, 58, 36, 52]

export interface NavTreeSkeletonProps {
  rowCount: number
  'data-testid'?: string
}

/**
 * The rows of a `NavTreeItem` (36 px, 8 px of padding, an icon of 16 px, a
 * gap of 8 px and a name) while the folders load.
 */
export function NavTreeSkeleton({
  rowCount,
  'data-testid': testId
}: NavTreeSkeletonProps): ReactElement {
  const rows = Array.from({ length: rowCount }, (_, index) => index)
  return (
    <SkeletonRegion className="u-ph-1" data-testid={testId}>
      {rows.map(row => (
        <Box
          key={row}
          className="u-flex u-flex-items-center u-ph-half"
          sx={{ height: 36, gap: 1 }}
        >
          <Skeleton variant="rounded" width={16} height={16} />
          <Skeleton
            width={`${NAME_WIDTHS[row % NAME_WIDTHS.length] ?? 50}%`}
            height={14}
          />
        </Box>
      ))}
    </SkeletonRegion>
  )
}
