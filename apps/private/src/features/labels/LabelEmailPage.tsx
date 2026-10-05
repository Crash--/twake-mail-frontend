import type { ReactElement } from 'react'
import { useParams } from 'react-router'

import { EmailView } from '@common/features/email/EmailView'
import { labelPath } from '@common/features/labels/labelPaths'

/** `/label/:labelId/email/:emailId`: an email of a label; back goes to them */
export function LabelEmailPage(): ReactElement {
  const { labelId = '', emailId = '' } = useParams()

  return (
    <EmailView key={emailId} emailId={emailId} backPath={labelPath(labelId)} />
  )
}
