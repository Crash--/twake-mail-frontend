import { queryOptions } from '@tanstack/react-query'
import type { JmapClient, Mailbox } from 'jmap-client-ts'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'

/**
 * Query keys and options of the mailbox feature.
 *
 * Convention (see AGENTS.md): each feature has a `queries.ts` that exports
 * a key factory and `queryOptions()` factories; the `useXxx` hooks live next
 * to it and only call `useQuery(xxxQueryOptions(...))`. Keys start with the
 * feature name and the JMAP account id, so that switching account never
 * mixes caches.
 */

/** The mailbox properties the app reads */
export const MAILBOX_PROPERTIES = [
  'id',
  'name',
  'parentId',
  'role',
  'sortOrder',
  'totalEmails',
  'unreadEmails',
  'myRights'
] as const

export type MailboxSummary = Pick<Mailbox, (typeof MAILBOX_PROPERTIES)[number]>

export type MailboxListKey = readonly ['mailbox', string, 'list']

export const mailboxKeys = {
  all: (accountId: string): readonly ['mailbox', string] => [
    'mailbox',
    accountId
  ],
  list: (accountId: string): MailboxListKey => [
    ...mailboxKeys.all(accountId),
    'list'
  ]
}

/** Every mailbox of the account (`Mailbox/get`), in no particular order */
export function mailboxesQueryOptions(
  client: JmapClient,
  accountId: string
): QueryOptionsFor<MailboxSummary[], MailboxListKey> {
  return queryOptions({
    queryKey: mailboxKeys.list(accountId),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'Mailbox/get',
        { accountId, ids: null, properties: [...MAILBOX_PROPERTIES] },
        { signal }
      )
      return response.list
    }
  })
}
