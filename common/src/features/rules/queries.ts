import { queryOptions } from '@tanstack/react-query'
import type { JmapClient } from 'jmap-client-ts'
import type { Rule } from 'jmap-client-ts/linagora'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'

import { rulesForUpdate } from './rules'

export type RulesKey = readonly ['rules', string]

export const ruleKeys = {
  all: (accountId: string): RulesKey => ['rules', accountId]
}

/** The filtering rules of the account (`Filter/get`), in order */
export function rulesQueryOptions(
  client: JmapClient,
  accountId: string
): QueryOptionsFor<Rule[], RulesKey> {
  return queryOptions({
    queryKey: ruleKeys.all(accountId),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'Filter/get',
        { accountId, ids: ['singleton'] },
        { signal }
      )
      return response.list[0]?.rules ?? []
    }
  })
}

/** Replaces the rules of the account (`Filter/set`); false when refused */
export async function saveRules(
  client: JmapClient,
  accountId: string,
  rules: readonly Rule[]
): Promise<boolean> {
  const response = await client.call('Filter/set', {
    accountId,
    update: { singleton: rulesForUpdate(rules) }
  })
  return response.updated !== null && 'singleton' in response.updated
}
