// Upstream to twake-ui: no, it draws the layout of an open email (subject,
// header of a message, body) with twake-mui's `Skeleton`.
import { Box, Skeleton, Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { SkeletonRegion } from '@/ds/SkeletonRegion/SkeletonRegion'

/** Width of the lines of the body, in %: a paragraph, not a block */
const BODY_LINES = [96, 88, 92, 60, 94, 84, 40]

export interface ReadingSkeletonProps {
  'data-testid'?: string
}

/**
 * What an open email or conversation shows below its toolbar while it loads:
 * the subject, the header of the first message (avatar, sender, date) and
 * the lines of its body, on the boxes of the real ones.
 */
export function ReadingSkeleton({
  'data-testid': testId
}: ReadingSkeletonProps): ReactElement {
  return (
    <SkeletonRegion className="u-flex-auto" data-testid={testId}>
      <Box className="u-ph-1 u-pt-1 u-pb-half">
        <Typography variant="h4" component="div">
          <Skeleton width="45%" />
        </Typography>
      </Box>
      <Box className="u-flex u-flex-items-center u-ph-1 u-pv-half">
        <Skeleton
          variant="circular"
          width={32}
          height={32}
          className="u-flex-shrink-0 u-mr-1"
        />
        <Typography variant="body1" component="div" className="u-flex-auto">
          <Skeleton width="30%" />
        </Typography>
        <Skeleton width={64} height={14} />
      </Box>
      <Box className="u-ph-1 u-pv-1">
        {BODY_LINES.map((width, index) => (
          <Typography key={index} variant="body1" component="div">
            <Skeleton width={`${width}%`} />
          </Typography>
        ))}
      </Box>
    </SkeletonRegion>
  )
}
