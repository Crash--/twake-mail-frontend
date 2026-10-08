import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { useOutlet, useParams } from 'react-router'

import { DetailPlaceholder } from '@/ds/DetailPlaceholder/DetailPlaceholder'
import { ListDetailLayout } from '@/ds/ListDetailLayout/ListDetailLayout'
import { RequireKnownMailbox } from '@common/features/mailbox/RequireKnownMailbox'
import { EmailList } from '@common/features/thread/EmailList'
import { useI18n } from '@common/i18n/useI18n'

/**
 * `/mailbox/:mailboxId`: the email list of a mailbox, and the email opened
 * from it (the nested `email/:emailId` route), instead of the list or beside
 * it depending on the screen.
 */
export function MailboxPage(): ReactElement {
  const { t } = useI18n()
  const { mailboxId = '' } = useParams()
  const email = useOutlet()

  return (
    <RequireKnownMailbox mailboxId={mailboxId}>
      <Box
        className="u-flex u-flex-column u-h-100"
        data-testid="mailbox-page"
        data-mailbox-id={mailboxId}
      >
        <ListDetailLayout
          list={<EmailList key={mailboxId} mailboxId={mailboxId} />}
          detail={email}
          placeholder={
            <DetailPlaceholder
              title={t('email.noneSelected')}
              data-testid="email-view-empty"
            />
          }
        />
      </Box>
    </RequireKnownMailbox>
  )
}
