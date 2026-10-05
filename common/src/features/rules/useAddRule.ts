import { useQueryClient } from '@tanstack/react-query'
import type { Rule } from 'jmap-client-ts/linagora'
import { useCallback } from 'react'

import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { ruleKeys, rulesQueryOptions, saveRules } from './queries'

/**
 * Adds a rule at the top of the rules of the account, from the ones the
 * server has now (the list is replaced as a whole by `Filter/set`), and
 * tells so. Resolves false when the server refused it.
 */
export function useAddRule(): (rule: Rule) => Promise<boolean> {
  const { t } = useI18n()
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const queryClient = useQueryClient()
  const { notify } = useNotify()

  return useCallback(
    async (rule: Rule): Promise<boolean> => {
      const current = await queryClient.query({
        ...rulesQueryOptions(client, accountId),
        staleTime: 0
      })
      const isSaved = await saveRules(client, accountId, [rule, ...current])
      await queryClient.invalidateQueries({ queryKey: ruleKeys.all(accountId) })
      if (isSaved) {
        notify({ message: t('rules.toasts.created'), severity: 'success' })
      }
      return isSaved
    },
    [client, accountId, queryClient, notify, t]
  )
}
