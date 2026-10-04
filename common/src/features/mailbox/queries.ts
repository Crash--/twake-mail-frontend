/**
 * Query keys of the mailbox feature.
 *
 * Convention (see AGENTS.md): each feature has a `queries.ts` that exports
 * a key factory and `queryOptions()` factories; the `useXxx` hooks live next
 * to it and only call `useQuery(xxxQueryOptions(...))`. Keys start with the
 * JMAP account id so that switching account never mixes caches.
 *
 * TODO(jmap-client-ts v2): add the options factories, e.g.
 *
 *   export function mailboxesQueryOptions(client: JmapClient, accountId: string) {
 *     return queryOptions({
 *       queryKey: mailboxKeys.list(accountId),
 *       queryFn: () => client.call('Mailbox/get', { accountId, ids: null })
 *     })
 *   }
 */
export const mailboxKeys = {
  all: (accountId: string): readonly ['mailbox', string] => [
    'mailbox',
    accountId
  ],
  list: (accountId: string): readonly ['mailbox', string, 'list'] => [
    ...mailboxKeys.all(accountId),
    'list'
  ],
  detail: (
    accountId: string,
    mailboxId: string
  ): readonly ['mailbox', string, 'detail', string] => [
    ...mailboxKeys.all(accountId),
    'detail',
    mailboxId
  ]
}
