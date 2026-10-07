import type { ReactElement, ReactNode } from 'react'

import { useEmail } from '@common/features/email/useEmail'
import { DefaultMailboxRedirect } from '@common/features/mailbox/DefaultMailboxRedirect'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'

import { useTeamMailboxRoot } from './TeamMailboxEmbedContext'
import { isInTeamMailbox } from './teamMailbox'

export interface RequireTeamMailboxEmailProps {
  emailId: string
  children: ReactNode
}

/** Whether one of the folders of the email belongs to the team mailbox */
function hasTeamFolder(
  mailboxIds: Readonly<Record<string, boolean>>,
  mailboxes: readonly MailboxSummary[],
  root: MailboxSummary
): boolean {
  return mailboxes.some(
    mailbox => mailboxIds[mailbox.id] === true && isInTeamMailbox(mailbox, root)
  )
}

/**
 * Renders an email, or, in the facade of a team mailbox, goes to its Inbox
 * when the email is in none of its folders: the facade never shows a
 * personal email, whatever the id in the URL. In the webmail, and while the
 * email loads, the children render (and show the loading or missing email).
 */
export function RequireTeamMailboxEmail({
  emailId,
  children
}: RequireTeamMailboxEmailProps): ReactElement {
  const teamRoot = useTeamMailboxRoot()
  const mailboxes = useMailboxes()
  const email = useEmail(emailId)

  if (
    teamRoot !== null &&
    mailboxes.data !== undefined &&
    email.data !== undefined &&
    email.data !== null &&
    !hasTeamFolder(email.data.mailboxIds, mailboxes.data, teamRoot)
  ) {
    return <DefaultMailboxRedirect />
  }
  return <>{children}</>
}
