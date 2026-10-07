import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  IDENTITY_SORT_ORDER_CAPABILITY,
  identitiesQueryOptions,
  type IdentitySummary
} from './queries'

/** The identities the user sends from, the default one first */
export function useIdentities(): UseQueryResult<IdentitySummary[]> {
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()
  return useQuery(
    identitiesQueryOptions(
      client,
      accountId,
      IDENTITY_SORT_ORDER_CAPABILITY in session.capabilities,
      session.username
    )
  )
}
