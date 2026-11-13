import type { Sdk } from '@linagora/twake-sdk'
import { queryOptions } from '@tanstack/react-query'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'
import type { AuthServiceBase } from '@common/features/auth/types'

import { fetchAssistantTools, type AssistantTool } from './assistantTools'

export type AssistantToolsKey = readonly ['assistant', string, 'tools', string]

export type AssistantInstalledKey = readonly ['assistant', string, 'installed']

export const ASSISTANT_APP_SLUG = 'assistant'

export const assistantKeys = {
  tools: (accountId: string, url: string): AssistantToolsKey => [
    'assistant',
    accountId,
    'tools',
    url
  ],
  installed: (accountId: string): AssistantInstalledKey => [
    'assistant',
    accountId,
    'installed'
  ]
}

export function assistantToolsQueryOptions(
  auth: Pick<AuthServiceBase, 'getAuthorizationHeader'>,
  accountId: string,
  url: string
): QueryOptionsFor<AssistantTool[], AssistantToolsKey> {
  return queryOptions({
    queryKey: assistantKeys.tools(accountId, url),
    queryFn: async ({ signal }) => {
      const authorization = await auth.getAuthorizationHeader()
      return fetchAssistantTools(url, authorization, { signal })
    },
    staleTime: Infinity
  })
}

export function assistantInstalledQueryOptions(
  sdk: Pick<Sdk, 'getAppURL'>,
  accountId: string
): QueryOptionsFor<boolean, AssistantInstalledKey> {
  return queryOptions({
    queryKey: assistantKeys.installed(accountId),
    queryFn: async () => (await sdk.getAppURL(ASSISTANT_APP_SLUG)) !== null,
    staleTime: Infinity
  })
}
