// Upstream to twake-ui: no, the shapes of tmail-flutter's compact email row
// while the list loads: the three lines (sender and date, subject,
// preview) on the 56 px beside the 48 px avatar.
import { Box, Skeleton } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const LINES_SX = {
  display: 'flex',
  flexDirection: 'column',
  height: 56
} as const

function lineSx(height: number): Record<string, unknown> {
  return { display: 'flex', alignItems: 'center', height }
}

/** The avatar of a compact row */
export function CompactAvatarSkeleton(): ReactElement {
  return <Skeleton variant="circular" width={48} height={48} />
}

/**
 * The three lines of a compact row; `isTagged`: a search result, whose
 * folder pill (24 px) makes the subject line taller
 */
export function CompactLinesSkeleton({
  isTagged = false
}: {
  isTagged?: boolean
}): ReactElement {
  return (
    <Box sx={{ ...LINES_SX, height: isTagged ? 65 : 56 }}>
      <Box sx={lineSx(20)}>
        <Skeleton width="40%" height={14} className="u-flex-auto" />
        <Skeleton width={48} height={12} className="u-ml-1" />
      </Box>
      <Box sx={lineSx(isTagged ? 27 : 18)}>
        <Skeleton width="60%" height={12} />
      </Box>
      <Box sx={lineSx(18)}>
        <Skeleton width="90%" height={12} />
      </Box>
    </Box>
  )
}
