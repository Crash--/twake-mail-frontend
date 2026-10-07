import { ListSkeleton } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { SkeletonRegion } from '@/ds/SkeletonRegion/SkeletonRegion'
import { useLoadingAnnouncement } from '@common/features/loading/LoadingAnnouncer'

export interface LoadingListSkeletonProps {
  /** The number of rows the skeleton shows */
  count: number
  'data-testid'?: string
}

/**
 * The rows of a list, a settings section or a dialog while it loads: busy,
 * hidden to screen readers, and announced as loading by the page
 */
export function LoadingListSkeleton({
  count,
  'data-testid': testId
}: LoadingListSkeletonProps): ReactElement {
  useLoadingAnnouncement(true)
  return (
    <SkeletonRegion data-testid={testId}>
      <ListSkeleton count={count} />
    </SkeletonRegion>
  )
}
