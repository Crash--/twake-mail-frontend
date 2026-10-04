import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { useParams } from 'react-router'

import { EmailList } from '@common/features/thread/EmailList'

/**
 * `/mailbox/:mailboxId`: the email list of a mailbox.
 */
export function MailboxPage(): ReactElement {
  const { mailboxId = '' } = useParams()

  return (
    <Box
      className="u-flex u-flex-column u-h-100"
      data-testid="mailbox-page"
      data-mailbox-id={mailboxId}
    >
      <EmailList key={mailboxId} mailboxId={mailboxId} />
    </Box>
  )
}
