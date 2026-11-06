import { useCallback } from 'react'

import { useAuthService } from '@common/features/auth/AuthProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import type { CapabilityCall } from './assistant'
import {
  assistantToolsUrl,
  executeAssistantTool,
  type ToolCallOutcome
} from './assistantTools'

export function useRunAssistantTool(): (
  call: CapabilityCall
) => Promise<ToolCallOutcome> {
  const service = useAuthService()
  const { session } = useJmapSession()
  const url = assistantToolsUrl(session)
  return useCallback(
    async (call: CapabilityCall): Promise<ToolCallOutcome> => {
      const authorization = await service.getAuthorizationHeader()
      return executeAssistantTool(url, authorization, {
        id: crypto.randomUUID(),
        name: call.capability,
        arguments: call.params
      })
    },
    [service, url]
  )
}
