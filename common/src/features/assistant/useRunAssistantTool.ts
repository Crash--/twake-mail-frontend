import { useCallback } from 'react'

import { useAuthService } from '@common/features/auth/AuthProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import type { ToolCall } from './assistant'
import {
  assistantToolsUrl,
  executeAssistantTool,
  type ToolCallOutcome
} from './assistantTools'

export function useRunAssistantTool(): (
  call: ToolCall
) => Promise<ToolCallOutcome> {
  const service = useAuthService()
  const { session } = useJmapSession()
  const url = assistantToolsUrl(session)
  return useCallback(
    async (call: ToolCall): Promise<ToolCallOutcome> => {
      const authorization = await service.getAuthorizationHeader()
      return executeAssistantTool(url, authorization, {
        id: crypto.randomUUID(),
        name: call.tool,
        arguments: call.params
      })
    },
    [service, url]
  )
}
