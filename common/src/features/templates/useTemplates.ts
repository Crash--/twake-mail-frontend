import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { templatesQueryOptions, type TemplateSummary } from './queries'

/** The templates of the Templates folders, read while `enabled` (the picker is open) */
export function useTemplates(
  mailboxIds: readonly string[],
  enabled: boolean
): UseQueryResult<TemplateSummary[]> {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  return useQuery({
    ...templatesQueryOptions(client, accountId, mailboxIds),
    enabled
  })
}
