import {
  useInfiniteQuery,
  type UseInfiniteQueryResult
} from '@tanstack/react-query'

import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { emailListQueryOptions, type EmailListData } from './queries'

/** The emails of a mailbox, most recent first, loaded page by page */
export function useEmailList(
  mailboxId: string
): UseInfiniteQueryResult<EmailListData> {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  return useInfiniteQuery(emailListQueryOptions(client, accountId, mailboxId))
}
