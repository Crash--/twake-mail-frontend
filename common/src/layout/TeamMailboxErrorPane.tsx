import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { TeamMailboxPane } from './TeamMailboxPane'

export interface TeamMailboxErrorPaneProps {
  children: ReactNode
}

/**
 * The white pane of the facade of a team mailbox around an error screen,
 * where its loading screen shows the rows of a list: an error does not sit
 * on the grey background of the page.
 */
export function TeamMailboxErrorPane({
  children
}: TeamMailboxErrorPaneProps): ReactElement {
  return (
    <Box className="u-flex u-flex-column u-h-100">
      <TeamMailboxPane data-testid="team-mailbox-error-pane">
        {children}
      </TeamMailboxPane>
    </Box>
  )
}
