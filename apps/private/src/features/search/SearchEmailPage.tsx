import type { ReactElement } from 'react'
import { useLocation, useParams } from 'react-router'

import { EmailView } from '@common/features/email/EmailView'

/**
 * `/search/email/:emailId?…`: a search result; back goes to the results.
 */
export function SearchEmailPage(): ReactElement {
  const { emailId = '' } = useParams()
  const { search } = useLocation()

  return (
    <EmailView key={emailId} emailId={emailId} backPath={`/search${search}`} />
  )
}
