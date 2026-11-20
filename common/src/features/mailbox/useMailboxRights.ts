import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { mailboxRightsQueryOptions } from './queries'

/**
 * The rights of a mailbox (`rights`), kept in the cache and read again when
 * push reports the mailbox changed (`pushSync`); changing them reads them
 * afresh (`FolderActionsProvider`). Nothing is read for a null mailbox
 */
export function useMailboxRights(
  mailboxId: string | null
): UseQueryResult<Record<string, string[]>> {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  return useQuery({
    ...mailboxRightsQueryOptions(client, accountId, mailboxId ?? ''),
    enabled: mailboxId !== null
  })
}
