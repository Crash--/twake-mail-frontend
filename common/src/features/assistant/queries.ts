import { queryOptions } from '@tanstack/react-query'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'
import type { AuthServiceBase } from '@common/features/auth/types'

import { fetchAssistantTools, type AssistantTool } from './assistantTools'

export type AssistantToolsKey = readonly ['assistant', string, 'tools', string]

export const assistantKeys = {
  tools: (accountId: string, url: string): AssistantToolsKey => [
    'assistant',
    accountId,
    'tools',
    url
  ]
}

export function assistantToolsQueryOptions(
  auth: Pick<AuthServiceBase, 'getAuthorizationHeader'>,
  accountId: string,
  url: string
): QueryOptionsFor<AssistantTool[] | null, AssistantToolsKey> {
  return queryOptions({
    queryKey: assistantKeys.tools(accountId, url),
    queryFn: async ({ signal }) => {
      const authorization = await auth.getAuthorizationHeader()
      const result = await fetchAssistantTools(url, authorization, { signal })
      return result.ok ? result.value : null
    },
    staleTime: Infinity
  })
}
