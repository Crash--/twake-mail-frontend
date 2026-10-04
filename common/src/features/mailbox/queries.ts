import { queryOptions } from '@tanstack/react-query'
import type { JmapClient, Mailbox, PickProperties } from 'jmap-client-ts'

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
  'myRights',
  'isSubscribed',
  'namespace'
] as const

export type MailboxSummary = PickProperties<
  Mailbox,
  (typeof MAILBOX_PROPERTIES)[number]
>

/**
 * A mailbox as the app reads it: James leaves out the properties without a
 * value (`role` of a personal folder, `namespace` without the shares
 * extension), which the app reads as null; a mailbox without
 * `isSubscribed` is subscribed.
 */
type OftenLeftOut = 'role' | 'parentId' | 'namespace' | 'isSubscribed'

/** A mailbox as James may send it */
export type RawMailbox = Omit<MailboxSummary, OftenLeftOut> &
  Partial<Pick<MailboxSummary, OftenLeftOut>>

export function normalizeMailbox(mailbox: RawMailbox): MailboxSummary {
  return {
    ...mailbox,
    role: mailbox.role ?? null,
    parentId: mailbox.parentId ?? null,
    namespace: mailbox.namespace ?? null,
    isSubscribed: mailbox.isSubscribed ?? true
  }
}

/** Every mailbox of the account, and the `Mailbox` state they are up to date with */
export interface MailboxListData {
  state: string
  list: MailboxSummary[]
}

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

/**
 * Every mailbox of the account (`Mailbox/get`), in no particular order, with
 * their state: push patches them from `Mailbox/changes` (`features/push/`)
 */
export function mailboxesQueryOptions(
  client: JmapClient,
  accountId: string
): QueryOptionsFor<MailboxListData, MailboxListKey> {
  return queryOptions({
    queryKey: mailboxKeys.list(accountId),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'Mailbox/get',
        { accountId, ids: null, properties: [...MAILBOX_PROPERTIES] },
        { signal }
      )
      return {
        state: response.state,
        list: response.list.map(normalizeMailbox)
      }
    }
  })
}
