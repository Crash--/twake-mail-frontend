import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { EmailListPageSkeleton } from '@common/features/thread/EmailListSkeleton'

import { TeamMailboxPane } from './TeamMailboxPane'

/**
 * The facade of a team mailbox while the configuration, the login and the
 * JMAP session load: the rows of its list rather than a spinner. Each step
 * mounts its own copy, so the rows show without a delay, or they would blink
 * at every handover. `AppBootstrap` mounts the "Loading" live region.
 */
export function TeamMailboxLoadingScreen(): ReactElement {
  return (
    <Box className="u-flex u-flex-column u-h-100">
      <TeamMailboxPane>
        <EmailListPageSkeleton delayMs={0} />
      </TeamMailboxPane>
    </Box>
  )
}
