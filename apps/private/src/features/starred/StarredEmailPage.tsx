import type { ReactElement } from 'react'
import { useParams } from 'react-router'

import { EmailView } from '@common/features/email/EmailView'
import { STARRED_PATH } from '@common/features/mailbox/StarredTreeItem'

/**
 * `/starred/email/:emailId`: a starred email; back goes to the starred list.
 */
export function StarredEmailPage(): ReactElement {
  const { emailId = '' } = useParams()

  return <EmailView key={emailId} emailId={emailId} backPath={STARRED_PATH} />
}
