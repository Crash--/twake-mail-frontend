import { Email } from '@linagora/twake-icons'
import { Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { useParams } from 'react-router'

import { useI18n } from '@common/i18n/useI18n'

/**
 * `/mailbox/:mailboxId`: the email list of a mailbox.
 * TODO(jmap-client-ts v2): list the emails with Email/query + Email/get.
 */
export function MailboxPage(): ReactElement {
  const { t } = useI18n()
  const { mailboxId } = useParams()

  return (
    <Empty
      icon={Email}
      title={t('mailbox.empty')}
      data-testid="mailbox-page"
      data-mailbox-id={mailboxId}
    />
  )
}
