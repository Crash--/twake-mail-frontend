import { Skeleton } from '@linagora/twake-mui'
import { useMemo, type ReactElement } from 'react'

import {
  CompactAvatarSkeleton,
  CompactLinesSkeleton
} from '@/ds/ListTableSkeleton/CompactRowSkeleton'
import {
  ListTableSkeleton,
  type ListTableSkeletonColumn
} from '@/ds/ListTableSkeleton/ListTableSkeleton'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { SENDER_WIDTH } from '@/ds/RowSender/RowSender'
import { AfterDelay } from '@common/features/loading/AfterDelay'
import { useLoadingAnnouncement } from '@common/features/loading/LoadingAnnouncer'

import {
  ACTION_SIZE,
  getCompactRowLayout,
  getLeadWidth,
  getTrailingWidth,
  ROW_LAYOUT,
  useRowPointer,
  type RowPointer
} from './emailListGeometry'

/** More rows than the tallest screen holds: the container cuts the rest */
const ROW_COUNT = 20

/** The checkbox, in the first of the three icon buttons of a row */
const CHECKBOX = (
  <Skeleton
    variant="rounded"
    width={18}
    height={18}
    className="u-flex-shrink-0 u-ml-half"
  />
)

/** The skeleton of the first two columns: the sender and the subject */
function wideColumns(pointer: RowPointer): ListTableSkeletonColumn[] {
  return [
    { id: 'lead', width: getLeadWidth(pointer.isTouch), cell: CHECKBOX },
    {
      id: 'sender',
      width: SENDER_WIDTH,
      cell: (
        <>
          <Skeleton
            variant="circular"
            width={32}
            height={32}
            className="u-flex-shrink-0 u-mr-1"
          />
          <Skeleton width="55%" height={14} />
        </>
      )
    },
    {
      id: 'subject',
      cell: (
        <>
          <Skeleton width="30%" height={14} className="u-mr-1" />
          <Skeleton width="45%" height={14} />
        </>
      )
    },
    {
      id: 'trailing',
      width: getTrailingWidth(pointer),
      cell: (
        <Skeleton
          width={56}
          height={14}
          className="u-flex-shrink-0 u-ml-auto u-mr-half"
        />
      )
    }
  ]
}

/**
 * tmail-flutter's compact row: the 48 px avatar, then the sender and the
 * date, the subject and the preview, on the 72 px of the real rows
 */
function compactColumns(
  sides: number,
  isTagged: boolean
): ListTableSkeletonColumn[] {
  return [
    { id: 'select', width: sides + 48, cell: <CompactAvatarSkeleton /> },
    { id: 'message', cell: <CompactLinesSkeleton isTagged={isTagged} /> }
  ]
}

export interface EmailListSkeletonProps {
  /** Below the desktop size the rows are the narrow ones, as in the list */
  isCompact: boolean
  /** Search results: the folder pill makes the compact rows taller */
  isSearch?: boolean
  className?: string
  /** `SKELETON_DELAY_MS` by default */
  delayMs?: number
}

/**
 * The rows of the email list while it loads, on the boxes of the real ones:
 * a desktop row is 44 px, a narrow one (a phone, a tablet, the list beside
 * an open email) holds the sender, the subject and two lines of preview.
 */
export function EmailListSkeleton(props: EmailListSkeletonProps): ReactElement {
  return (
    <AfterDelay delayMs={props.delayMs}>
      <EmailListRowsSkeleton {...props} />
    </AfterDelay>
  )
}

function EmailListRowsSkeleton({
  isCompact,
  isSearch = false,
  className
}: EmailListSkeletonProps): ReactElement {
  useLoadingAnnouncement(true)
  const { canHover, isTouch } = useRowPointer()
  const isPhone = useScreenSize() === 'mobile'
  const compactLayout = useMemo(() => getCompactRowLayout(isPhone), [isPhone])
  const narrowColumns = useMemo(
    () => compactColumns(compactLayout.paddingX, isSearch),
    [compactLayout, isSearch]
  )
  const columns = useMemo(
    () => wideColumns({ canHover, isTouch }),
    [canHover, isTouch]
  )
  return (
    <ListTableSkeleton
      columns={columns}
      compactColumns={narrowColumns}
      compactRowLayout={compactLayout}
      compact={isCompact}
      rowCount={ROW_COUNT}
      rowLayout={ROW_LAYOUT}
      cellHeight={ACTION_SIZE}
      className={className}
      data-testid="email-list-loading"
    />
  )
}

/**
 * The list area of a page whose folder or label is not known yet: the rows
 * of the list, as the page will show them
 */
export function EmailListPageSkeleton({
  delayMs
}: {
  delayMs?: number
}): ReactElement {
  const screenSize = useScreenSize()
  return (
    <EmailListSkeleton
      isCompact={screenSize !== 'desktop'}
      className="u-h-100"
      delayMs={delayMs}
    />
  )
}
