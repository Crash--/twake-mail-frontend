import { EmailOpen } from '@linagora/twake-icons'
import { Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { useParams } from 'react-router'

import { useI18n } from '@common/i18n/useI18n'

/**
 * `/mailbox/:mailboxId/email/:emailId`: an email of a mailbox.
 * TODO(jmap-client-ts v2): fetch it with Email/get.
 */
export function EmailPage(): ReactElement {
  const { t } = useI18n()
  const { mailboxId, emailId } = useParams()

  return (
    <Empty
      icon={EmailOpen}
      title={t('email.placeholder')}
      data-testid="email-page"
      data-mailbox-id={mailboxId}
      data-email-id={emailId}
    />
  )
}
