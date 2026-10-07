import type { ReactElement } from 'react'
import { useParams } from 'react-router'

import { EmailView } from '@common/features/email/EmailView'
import { RequireTeamMailboxEmail } from '@common/features/teamMailboxEmbed/RequireTeamMailboxEmail'

/**
 * `/mailbox/:mailboxId/email/:emailId`: an email of a mailbox. In the
 * facade of a team mailbox, only an email of that team mailbox.
 */
export function EmailPage(): ReactElement {
  const { mailboxId = '', emailId = '' } = useParams()

  return (
    <RequireTeamMailboxEmail emailId={emailId}>
      <EmailView
        key={emailId}
        emailId={emailId}
        mailboxId={mailboxId}
        backPath={`/mailbox/${encodeURIComponent(mailboxId)}`}
      />
    </RequireTeamMailboxEmail>
  )
}
