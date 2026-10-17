import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useAppConfig } from '@common/config/AppConfigProvider'
import { useAuthService } from '@common/features/auth/AuthProvider'
import { ecosystemQueryOptions } from '@common/features/ecosystem/ecosystem'

import {
  BUILT_IN_PROMPTS,
  readScribePromptUrl,
  scribePromptsQueryOptions,
  type ScribePrompts
} from './scribePrompts'

/**
 * Loads the prompts of the assistant, as tmail-flutter: the ones at the
 * `scribePromptUrl` of the ecosystem document of the server, kept in the
 * cache; the built-in ones when the server gives none, or they fail to load.
 */
export function useScribePrompts(): () => Promise<ScribePrompts> {
  const queryClient = useQueryClient()
  const authService = useAuthService()
  const ecosystemUrl = useAppConfig()?.ecosystemUrl ?? null

  return useCallback(async (): Promise<ScribePrompts> => {
    if (ecosystemUrl === null) return BUILT_IN_PROMPTS
    try {
      const ecosystem = await queryClient.query(
        ecosystemQueryOptions(ecosystemUrl, authService)
      )
      const url = readScribePromptUrl(ecosystem.scribePromptUrl)
      if (url === null) return BUILT_IN_PROMPTS
      return await queryClient.query(scribePromptsQueryOptions(url))
    } catch (error: unknown) {
      console.warn('[scribe] Using the built-in prompts', error)
      return BUILT_IN_PROMPTS
    }
  }, [queryClient, authService, ecosystemUrl])
}
