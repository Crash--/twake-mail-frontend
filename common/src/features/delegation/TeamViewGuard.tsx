import { useEffect } from 'react'

import { findTeamMailboxRoot } from '@common/features/teamMailboxEmbed/teamMailbox'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useMailboxView } from '@common/jmap/JmapSessionProvider'
import { OWN_VIEW } from '@common/jmap/mailboxView'

/**
 * Bound to a team mailbox the user is no longer a member of (or that is
 * gone): gives the user's own mailbox back, once the folders are known
 */
export function TeamViewGuard(): null {
  const { view, switchView } = useMailboxView()
  const mailboxes = useMailboxes()
  const isGone =
    view.kind === 'team' &&
    mailboxes.isSuccess &&
    findTeamMailboxRoot(mailboxes.data, view.rootId) === null

  useEffect(() => {
    if (isGone) switchView(OWN_VIEW)
  }, [isGone, switchView])

  return null
}
