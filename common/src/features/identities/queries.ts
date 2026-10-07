import { queryOptions } from '@tanstack/react-query'
import type { Identity, JmapClient, PickProperties } from 'jmap-client-ts'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'

/** James extension giving identities a `sortOrder` (tmail-flutter sorts by it) */
export const IDENTITY_SORT_ORDER_CAPABILITY =
  LINAGORA_CAPABILITIES.jamesIdentitySortOrder

/** The identity properties the app reads */
export const IDENTITY_PROPERTIES = [
  'id',
  'name',
  'email',
  'replyTo',
  'bcc',
  'textSignature',
  'htmlSignature',
  'mayDelete',
  'sortOrder'
] as const

/** An identity; `sortOrder` is there when the server sorts identities */
export type IdentitySummary = PickProperties<
  Identity,
  Exclude<(typeof IDENTITY_PROPERTIES)[number], 'sortOrder'>
> &
  Pick<Identity, 'sortOrder'>

export type IdentityListKey = readonly ['identities', string, 'list']

export const identityKeys = {
  all: (accountId: string): readonly ['identities', string] => [
    'identities',
    accountId
  ],
  list: (accountId: string): IdentityListKey => [
    ...identityKeys.all(accountId),
    'list'
  ]
}

const LAST = Number.MAX_SAFE_INTEGER

function isOwnAddress(
  identity: IdentitySummary,
  ownEmail: string | null
): boolean {
  return (
    ownEmail !== null && identity.email.toLowerCase() === ownEmail.toLowerCase()
  )
}

/**
 * The identities in the order the user picks from: `sortOrder`, then the
 * identities the server made (they cannot be deleted), then the one sending
 * from the user's own address (`ownEmail`, the session username: a team
 * mailbox identity is server made too), then by name. The first one is the
 * default.
 */
export function sortIdentities(
  identities: readonly IdentitySummary[],
  ownEmail: string | null = null
): IdentitySummary[] {
  return [...identities].sort(
    (first, second) =>
      (first.sortOrder ?? LAST) - (second.sortOrder ?? LAST) ||
      Number(first.mayDelete) - Number(second.mayDelete) ||
      Number(isOwnAddress(second, ownEmail)) -
        Number(isOwnAddress(first, ownEmail)) ||
      first.name.localeCompare(second.name)
  )
}

/** The identities of the account (`Identity/get`), sorted */
export function identitiesQueryOptions(
  client: JmapClient,
  accountId: string,
  hasSortOrder: boolean,
  ownEmail: string
): QueryOptionsFor<IdentitySummary[], IdentityListKey> {
  // hasSortOrder and ownEmail come with the session, as the account does
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryKey: identityKeys.list(accountId),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'Identity/get',
        {
          accountId,
          ids: null,
          properties: hasSortOrder
            ? [...IDENTITY_PROPERTIES]
            : IDENTITY_PROPERTIES.filter(property => property !== 'sortOrder')
        },
        {
          signal,
          extraCapabilities: hasSortOrder
            ? [IDENTITY_SORT_ORDER_CAPABILITY]
            : []
        }
      )
      return sortIdentities(response.list, ownEmail)
    },
    staleTime: 5 * 60_000
  })
}
