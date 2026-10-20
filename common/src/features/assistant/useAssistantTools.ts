import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { useAuthService } from '@common/features/auth/AuthProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { assistantToolsUrl, type AssistantTool } from './assistantTools'
import { assistantToolsQueryOptions } from './queries'

/** The tools of tmail-backend for the assistant, null when it offers none */
export function useAssistantTools(): UseQueryResult<AssistantTool[] | null> {
  const service = useAuthService()
  const { session, accountId } = useJmapSession()
  return useQuery(
    assistantToolsQueryOptions(service, accountId, assistantToolsUrl(session))
  )
}
