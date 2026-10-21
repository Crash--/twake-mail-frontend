import { queryOptions } from '@tanstack/react-query'
import type { JmapClient } from 'jmap-client-ts'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'
import type { Delegation } from '@common/jmap/methodCapabilities'

export type { Delegation }

export type DelegationsKey = readonly [
  'delegation',
  string,
  'delegates' | 'delegatedAccounts'
]

/**
 * Always the user's own account: a delegate may not read nor change the
 * delegations of the mailbox delegated to them (the server refuses it)
 */
export const delegationKeys = {
  all: (ownAccountId: string): readonly ['delegation', string] => [
    'delegation',
    ownAccountId
  ],
  delegates: (ownAccountId: string): DelegationsKey => [
    'delegation',
    ownAccountId,
    'delegates'
  ],
  delegatedAccounts: (ownAccountId: string): DelegationsKey => [
    'delegation',
    ownAccountId,
    'delegatedAccounts'
  ]
}

function byUsername(left: Delegation, right: Delegation): number {
  return left.username.localeCompare(right.username)
}

/** The people the user gave access to their mailbox (`Delegate/get`) */
export function delegatesQueryOptions(
  client: JmapClient,
  ownAccountId: string
): QueryOptionsFor<Delegation[], DelegationsKey> {
  return queryOptions({
    queryKey: delegationKeys.delegates(ownAccountId),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'Delegate/get',
        { accountId: ownAccountId, ids: null },
        { signal }
      )
      return [...response.list].sort(byUsername)
    }
  })
}

/** The mailboxes delegated to the user (`DelegatedAccount/get`) */
export function delegatedAccountsQueryOptions(
  client: JmapClient,
  ownAccountId: string
): QueryOptionsFor<Delegation[], DelegationsKey> {
  return queryOptions({
    queryKey: delegationKeys.delegatedAccounts(ownAccountId),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'DelegatedAccount/get',
        { accountId: ownAccountId, ids: null },
        { signal }
      )
      return [...response.list].sort(byUsername)
    }
  })
}

/**
 * Gives these people access to the user's mailbox (`Delegate/set`
 * create): the addresses the server refused
 */
export async function addDelegates(
  client: JmapClient,
  ownAccountId: string,
  usernames: readonly string[]
): Promise<string[]> {
  const create = Object.fromEntries(
    usernames.map((username, index) => [`d${index}`, { username }])
  )
  const response = await client.call('Delegate/set', {
    accountId: ownAccountId,
    create
  })
  return usernames.filter(
    (_, index) => response.created?.[`d${index}`] === undefined
  )
}

/** Takes their access back from a delegate (`Delegate/set` destroy) */
export async function removeDelegate(
  client: JmapClient,
  ownAccountId: string,
  id: string
): Promise<boolean> {
  const response = await client.call('Delegate/set', {
    accountId: ownAccountId,
    destroy: [id]
  })
  return response.destroyed?.includes(id) ?? false
}

/**
 * Gives up the access to a mailbox delegated to the user
 * (`DelegatedAccount/set` destroy)
 */
export async function removeDelegatedAccount(
  client: JmapClient,
  ownAccountId: string,
  id: string
): Promise<boolean> {
  const response = await client.call('DelegatedAccount/set', {
    accountId: ownAccountId,
    destroy: [id]
  })
  return response.destroyed?.includes(id) ?? false
}

/**
 * The user leaves the team mailbox of this address
 * (`TeamMailbox/revokeAccess`): whether they did
 */
export async function leaveTeamMailbox(
  client: JmapClient,
  ownAccountId: string,
  address: string
): Promise<boolean> {
  const response = await client.call('TeamMailbox/revokeAccess', {
    accountId: ownAccountId,
    ids: [address]
  })
  return response.revoked?.includes(address) ?? false
}
