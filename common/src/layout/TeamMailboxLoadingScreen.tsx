import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { LoadingAnnouncer } from '@common/features/loading/LoadingAnnouncer'
import { EmailListPageSkeleton } from '@common/features/thread/EmailListSkeleton'

import { TeamMailboxPane } from './TeamMailboxPane'

/**
 * The facade of a team mailbox while the login and the JMAP session load:
 * the rows of its list rather than a spinner. Its own live region says
 * "Loading": the one of the mail screens is not mounted yet.
 */
export function TeamMailboxLoadingScreen(): ReactElement {
  return (
    <LoadingAnnouncer>
      <Box className="u-flex u-flex-column u-h-100">
        <TeamMailboxPane>
          <EmailListPageSkeleton />
        </TeamMailboxPane>
      </Box>
    </LoadingAnnouncer>
  )
}
