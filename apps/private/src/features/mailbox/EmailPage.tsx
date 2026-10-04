import type { ReactElement } from 'react'
import { useParams } from 'react-router'

import { EmailView } from '@common/features/email/EmailView'

/**
 * `/mailbox/:mailboxId/email/:emailId`: an email of a mailbox.
 */
export function EmailPage(): ReactElement {
  const { mailboxId = '', emailId = '' } = useParams()

  return (
    <EmailView
      key={emailId}
      emailId={emailId}
      mailboxId={mailboxId}
      backPath={`/mailbox/${encodeURIComponent(mailboxId)}`}
    />
  )
}
