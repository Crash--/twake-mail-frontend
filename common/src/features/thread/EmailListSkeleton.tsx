import { Skeleton, Typography, useMediaQuery } from '@linagora/twake-mui'
import { useMemo, type ReactElement } from 'react'

import { ButtonSkeleton } from '@/ds/ListTableSkeleton/ButtonSkeleton'
import {
  ListTableSkeleton,
  type ListTableSkeletonColumn
} from '@/ds/ListTableSkeleton/ListTableSkeleton'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { SENDER_BLOCK_WIDTH } from '@/ds/RowSender/RowSender'
import { AfterDelay } from '@common/features/loading/AfterDelay'
import { useLoadingAnnouncement } from '@common/features/loading/LoadingAnnouncer'

import {
  ACTION_SIZE,
  getTrailingWidth,
  LEAD_WIDTH,
  ROW_LAYOUT
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
function wideColumns(canHover: boolean): ListTableSkeletonColumn[] {
  return [
    { id: 'lead', width: LEAD_WIDTH, cell: CHECKBOX },
    {
      id: 'sender',
      width: ROW_LAYOUT.gap + 20 + 4 + SENDER_BLOCK_WIDTH,
      cell: (
        <>
          <Skeleton
            variant="circular"
            width={20}
            height={20}
            className="u-flex-shrink-0 u-ml-1-half u-mr-half"
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
      width: getTrailingWidth(canHover),
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

/** Sender and date, subject, then two lines of preview: a narrow row */
const NARROW_MESSAGE = (
  <div>
    <Typography variant="body1" component="div" className="u-flex">
      <Skeleton width="40%" className="u-flex-auto" />
      <Skeleton width={48} className="u-ml-1" />
    </Typography>
    <Typography variant="body1" component="div">
      <Skeleton width="65%" />
    </Typography>
    <Typography variant="body2" component="div">
      <Skeleton width="95%" />
    </Typography>
    <Typography variant="body2" component="div">
      <Skeleton width="55%" />
    </Typography>
  </div>
)

const COMPACT_COLUMNS: ListTableSkeletonColumn[] = [
  { id: 'select', width: 44, cell: CHECKBOX },
  { id: 'unread', width: 20, cell: null },
  { id: 'message', paddingStart: 4, cell: NARROW_MESSAGE },
  {
    id: 'compactActions',
    width: 48,
    cell: (
      <div className="u-flex u-flex-column u-flex-items-center">
        <ButtonSkeleton />
        <ButtonSkeleton />
      </div>
    )
  }
]

export interface EmailListSkeletonProps {
  /** Below the desktop size the rows are the narrow ones, as in the list */
  isCompact: boolean
  className?: string
}

/**
 * The rows of the email list while it loads, on the boxes of the real ones:
 * a desktop row is 44 px, a narrow one (a phone, a tablet, the list beside
 * an open email) holds the sender, the subject and two lines of preview.
 */
export function EmailListSkeleton(props: EmailListSkeletonProps): ReactElement {
  return (
    <AfterDelay>
      <EmailListRowsSkeleton {...props} />
    </AfterDelay>
  )
}

function EmailListRowsSkeleton({
  isCompact,
  className
}: EmailListSkeletonProps): ReactElement {
  useLoadingAnnouncement(true)
  const canHover = !useMediaQuery('(hover: none)')
  const columns = useMemo(() => wideColumns(canHover), [canHover])
  return (
    <ListTableSkeleton
      columns={columns}
      compactColumns={COMPACT_COLUMNS}
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
export function EmailListPageSkeleton(): ReactElement {
  const screenSize = useScreenSize()
  return (
    <EmailListSkeleton
      isCompact={screenSize !== 'desktop'}
      className="u-h-100"
    />
  )
}
