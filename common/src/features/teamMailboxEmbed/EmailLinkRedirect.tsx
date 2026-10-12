import type { ReactElement } from 'react'
import { Navigate, useParams } from 'react-router'

import { useEmail } from '@common/features/email/useEmail'
import { DefaultMailboxRedirect } from '@common/features/mailbox/DefaultMailboxRedirect'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { EmailListPageSkeleton } from '@common/features/thread/EmailListSkeleton'

import { useTeamMailboxRoot } from './TeamMailboxEmbedContext'
import { isInTeamMailbox } from './teamMailbox'

/**
 * `/email/:emailId`, the link TwakeSpace builds from an activity of the team
 * mailbox, which names the email and not its folder: goes to the email in
 * the first folder of the team mailbox that holds it. An email that does not
 * exist, or that is in no folder of the team mailbox, leads to its Inbox.
 */
export function EmailLinkRedirect(): ReactElement {
  const { emailId = '' } = useParams()
  const mailboxes = useMailboxes()
  const teamRoot = useTeamMailboxRoot()
  const email = useEmail(emailId)

  if (mailboxes.isPending || email.isPending) return <EmailListPageSkeleton />

  const detail = email.data
  const folder =
    teamRoot === null || mailboxes.data === undefined || !detail
      ? undefined
      : mailboxes.data.find(
          mailbox =>
            detail.mailboxIds[mailbox.id] === true &&
            isInTeamMailbox(mailbox, teamRoot)
        )
  if (folder === undefined) return <DefaultMailboxRedirect />

  return (
    <Navigate
      to={`/mailbox/${encodeURIComponent(folder.id)}/email/${encodeURIComponent(emailId)}`}
      replace
    />
  )
}
