// Upstream to twake-ui: no, the shapes of the compact email row while the list
// loads: the three lines (sender and date, subject, preview) of the text of
// the real row, 18.4 px each and 2 px apart, beside the 20 px avatar in the
// middle of its 48 px touch target.
import { Box, Skeleton } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const LINES_SX = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  height: 59.2
} as const

const TARGET_SX = { width: 48, height: 48, flexShrink: 0 } as const

function lineSx(height: number): Record<string, unknown> {
  return { display: 'flex', alignItems: 'center', height }
}

/** The avatar of a compact row */
export function CompactAvatarSkeleton(): ReactElement {
  return (
    <Box
      className="u-flex u-flex-items-center u-flex-justify-center"
      sx={TARGET_SX}
    >
      <Skeleton variant="circular" width={20} height={20} />
    </Box>
  )
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
    <Box sx={{ ...LINES_SX, height: isTagged ? 64.8 : 59.2 }}>
      <Box sx={lineSx(18.4)}>
        <Skeleton width="40%" height={14} className="u-flex-auto" />
        <Skeleton width={48} height={12} className="u-ml-1" />
      </Box>
      <Box sx={lineSx(isTagged ? 24 : 18.4)}>
        <Skeleton width="60%" height={12} />
      </Box>
      <Box sx={lineSx(18.4)}>
        <Skeleton width="90%" height={12} />
      </Box>
    </Box>
  )
}
