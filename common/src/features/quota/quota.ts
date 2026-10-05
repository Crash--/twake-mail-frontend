import {
  queryOptions,
  useQuery,
  type UseQueryResult
} from '@tanstack/react-query'
import { CAPABILITIES, type JmapClient, type Quota } from 'jmap-client-ts'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

/** The storage quota of the account, as tmail-flutter reads it */
export interface StorageQuota {
  used: number
  limit: number
  /** Reached: past the server's warning limit */
  isWarning: boolean
  /** Reached: full */
  isFull: boolean
}

export type QuotaKey = readonly ['quota', string]

export const quotaKeys = {
  all: (accountId: string): QuotaKey => ['quota', accountId]
}

/**
 * The storage quota among the quotas of the account: the first in octets
 * (tmail-flutter); null without one, or without a limit
 */
export function storageQuota(quotas: readonly Quota[]): StorageQuota | null {
  const quota = quotas.find(candidate => candidate.resourceType === 'octets')
  if (!quota || quota.hardLimit <= 0) return null
  return {
    used: quota.used,
    limit: quota.hardLimit,
    isWarning:
      quota.used >= quota.hardLimit ||
      (quota.warnLimit !== null &&
        quota.warnLimit !== undefined &&
        quota.used >= quota.warnLimit),
    isFull: quota.used >= quota.hardLimit
  }
}

/** The storage quota of the account (`Quota/get`, RFC 9425) */
export function quotaQueryOptions(
  client: JmapClient,
  accountId: string
): QueryOptionsFor<StorageQuota | null, QuotaKey> {
  return queryOptions({
    queryKey: quotaKeys.all(accountId),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'Quota/get',
        { accountId, ids: null },
        { signal }
      )
      return storageQuota(response.list)
    }
  })
}

/** Whether the server tells the quotas */
export function useHasQuota(): boolean {
  const { session } = useJmapSession()
  return CAPABILITIES.quota in session.capabilities
}

/** The storage quota, when the server tells it */
export function useStorageQuota(): UseQueryResult<StorageQuota | null> {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  return useQuery({
    ...quotaQueryOptions(client, accountId),
    enabled: useHasQuota()
  })
}
