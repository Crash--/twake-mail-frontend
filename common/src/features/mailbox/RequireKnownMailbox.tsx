import type { ReactElement, ReactNode } from 'react'

import { useTeamMailboxEmbed } from '@common/features/teamMailboxEmbed/TeamMailboxEmbedContext'
import { isInTeamMailbox } from '@common/features/teamMailboxEmbed/teamMailbox'

import { DefaultMailboxRedirect } from './DefaultMailboxRedirect'
import { useMailboxes } from './useMailboxes'

export interface RequireKnownMailboxProps {
  mailboxId: string
  children: ReactNode
}

/**
 * Renders the screen of a mailbox of the signed-in user, or goes to the
 * inbox when the mailbox is not one of theirs: a link of another account
 * (the page a previous user signed out from), or a deleted folder. In the
 * facade of a team mailbox, only its folders are known.
 */
export function RequireKnownMailbox({
  mailboxId,
  children
}: RequireKnownMailboxProps): ReactElement {
  const query = useMailboxes()
  const teamAddress = useTeamMailboxEmbed()

  if (
    query.isSuccess &&
    !query.data.some(
      mailbox =>
        mailbox.id === mailboxId &&
        (teamAddress === null || isInTeamMailbox(mailbox, teamAddress))
    )
  ) {
    return <DefaultMailboxRedirect />
  }
  return <>{children}</>
}
