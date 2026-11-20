import type { QueryClient } from '@tanstack/react-query'
import type { JmapClient } from 'jmap-client-ts'

import { patchMailboxes } from '@common/features/mailbox/patchMailboxes'
import {
  mailboxesQueryOptions,
  normalizeMailbox,
  type MailboxListData
} from '@common/features/mailbox/queries'
import { fetchChanges } from '@common/features/push/fetchChanges'

/**
 * The folders as the server has them now, after one of our `Mailbox/set`:
 * `Mailbox/changes` since the state of the cached folders, with the
 * `Mailbox/get` of what changed (RFC 8620 section 5.2, as push does),
 * patched into the cache, instead of every folder again. Every folder only
 * when none is cached or the server cannot tell the changes.
 */
export async function syncMailboxes(
  client: JmapClient,
  queryClient: QueryClient,
  accountId: string
): Promise<MailboxListData> {
  const options = mailboxesQueryOptions(client, accountId)
  const cached = queryClient.getQueryData<MailboxListData>(options.queryKey)
  if (cached !== undefined) {
    const { mailbox: changes } = await fetchChanges(client, accountId, {
      mailboxSince: cached.state,
      emailSince: []
    })
    if (changes) {
      const patched = queryClient.setQueryData<MailboxListData>(
        options.queryKey,
        data =>
          data
            ? patchMailboxes(data, {
                changed: changes.changed.map(normalizeMailbox),
                destroyed: changes.destroyed,
                oldState: changes.sinceState,
                newState: changes.newState
              })
            : data
      )
      if (patched !== undefined) return patched
    }
  }
  return queryClient.query({ ...options, staleTime: 0 })
}
