import type { ReactElement } from 'react'
import { useParams } from 'react-router'

import { EmailView } from '@common/features/email/EmailView'
import { ACTION_REQUIRED_PATH } from '@common/features/mailbox/ActionRequiredTreeItem'

/**
 * `/action-required/email/:emailId`: an email needing an action; back goes
 * to the list.
 */
export function ActionRequiredEmailPage(): ReactElement {
  const { emailId = '' } = useParams()

  return (
    <EmailView
      key={emailId}
      emailId={emailId}
      backPath={ACTION_REQUIRED_PATH}
    />
  )
}
