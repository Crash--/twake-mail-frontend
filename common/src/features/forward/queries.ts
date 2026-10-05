import { queryOptions } from '@tanstack/react-query'
import type { JmapClient } from 'jmap-client-ts'
import type { Forward } from 'jmap-client-ts/linagora'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'

export type ForwardKey = readonly ['forward', string]

export const forwardKeys = {
  all: (accountId: string): ForwardKey => ['forward', accountId]
}

const NO_FORWARD: Forward = { id: 'singleton', localCopy: true, forwards: [] }

/** Where the emails of the account are forwarded (`Forward/get`) */
export function forwardQueryOptions(
  client: JmapClient,
  accountId: string
): QueryOptionsFor<Forward, ForwardKey> {
  return queryOptions({
    queryKey: forwardKeys.all(accountId),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'Forward/get',
        { accountId, ids: ['singleton'] },
        { signal }
      )
      return response.list[0] ?? NO_FORWARD
    }
  })
}

/**
 * Changes the forwarding (`Forward/set`); false when refused. Both
 * properties go every time: tmail-backend refuses a patch without
 * `localCopy`.
 */
export async function updateForward(
  client: JmapClient,
  accountId: string,
  change: Pick<Forward, 'forwards' | 'localCopy'>
): Promise<boolean> {
  const response = await client.call('Forward/set', {
    accountId,
    update: { singleton: change }
  })
  return response.updated !== null && 'singleton' in response.updated
}

/** The domain of an address, lower case */
export function domainOf(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase()
}
