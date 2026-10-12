import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { EmailListSkeleton } from '@common/features/thread/EmailListSkeleton'

import { TeamMailboxPane } from './TeamMailboxPane'

/**
 * The facade of a team mailbox while the configuration, the login and the
 * JMAP session load: the rows of its list rather than a spinner. Each step
 * mounts its own copy, so the rows show without a delay, or they would blink
 * at every handover. `AppBootstrap` mounts the "Loading" live region.
 */
export function TeamMailboxLoadingScreen(): ReactElement {
  const screenSize = useScreenSize()
  return (
    <Box className="u-flex u-flex-column u-h-100">
      <TeamMailboxPane>
        <EmailListSkeleton
          isCompact={screenSize !== 'desktop'}
          className="u-h-100 u-ph-1 u-pb-1"
          delayMs={0}
        />
      </TeamMailboxPane>
    </Box>
  )
}
