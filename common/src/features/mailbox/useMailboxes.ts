import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  mailboxesQueryOptions,
  type MailboxListData,
  type MailboxSummary
} from './queries'

function selectList(data: MailboxListData): MailboxSummary[] {
  return data.list
}

/** The mailboxes of the signed-in user */
export function useMailboxes(): UseQueryResult<MailboxSummary[]> {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  return useQuery({
    ...mailboxesQueryOptions(client, accountId),
    select: selectList
  })
}
