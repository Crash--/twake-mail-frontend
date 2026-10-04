import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { emailQueryOptions, type EmailDetail } from './queries'

/** An email to read, null when it does not exist */
export function useEmail(emailId: string): UseQueryResult<EmailDetail | null> {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  return useQuery(emailQueryOptions(client, accountId, emailId))
}
