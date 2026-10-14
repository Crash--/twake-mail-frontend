import type { ReactElement, ReactNode } from 'react'

import { useTeamMailboxEmbed } from '@common/features/teamMailboxEmbed/TeamMailboxEmbedContext'
import {
  findTeamMailboxRoot,
  isInTeamMailbox
} from '@common/features/teamMailboxEmbed/teamMailbox'

import { DefaultMailboxRedirect } from './DefaultMailboxRedirect'
import { isTeamRoot } from './mailboxTree'
import { useMailboxes } from './useMailboxes'

export interface RequireKnownMailboxProps {
  mailboxId: string
  children: ReactNode
}

/**
 * Renders the screen of a mailbox of the signed-in user, or goes to the
 * inbox when the mailbox is not one of theirs: a link of another account
 * (the page a previous user signed out from), or a deleted folder. In the
 * facade of a team mailbox, only its folders are known. The root of a team
 * mailbox is a container, not a folder: it has no screen.
 */
export function RequireKnownMailbox({
  mailboxId,
  children
}: RequireKnownMailboxProps): ReactElement {
  const query = useMailboxes()
  const teamRootId = useTeamMailboxEmbed()

  if (query.isSuccess) {
    const teamRoot =
      teamRootId === null ? null : findTeamMailboxRoot(query.data, teamRootId)
    const isKnown = query.data.some(
      mailbox =>
        mailbox.id === mailboxId &&
        !isTeamRoot(mailbox) &&
        (teamRootId === null ||
          (teamRoot !== null && isInTeamMailbox(mailbox, teamRoot)))
    )
    if (!isKnown) return <DefaultMailboxRedirect />
  }
  return <>{children}</>
}
