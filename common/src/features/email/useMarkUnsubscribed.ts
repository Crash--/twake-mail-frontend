import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { findCachedEmail } from '@common/features/emailActions/optimisticEmailChanges'
import type { TargetEmail } from '@common/features/emailActions/planEmailChanges'
import { useEmailActions } from '@common/features/emailActions/useEmailActions'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

/**
 * Sets the `$unsubscribe` keyword of an email (from the cache, else read
 * from the server) and says so; resolves to whether it is set
 */
export function useMarkUnsubscribed(): (
  emailId: string,
  mailboxId: string | null
) => Promise<boolean> {
  const { t } = useI18n()
  const { notify } = useNotify()
  const { run } = useEmailActions()
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const queryClient = useQueryClient()

  return useCallback(
    async (emailId, mailboxId) => {
      let target: TargetEmail | null = findCachedEmail(
        queryClient,
        accountId,
        emailId
      )
      if (target === null) {
        try {
          const response = await client.call('Email/get', {
            accountId,
            ids: [emailId],
            properties: ['id', 'mailboxIds', 'keywords']
          })
          target = response.list[0] ?? null
        } catch (error: unknown) {
          console.error('[email] Cannot read the email to unsubscribe', error)
        }
      }
      if (target === null) return false
      const done = await run({
        action: 'markUnsubscribed',
        emails: [target],
        mailboxId,
        silent: true
      })
      if (done) notify({ message: t('unsubscribe.done'), severity: 'success' })
      return done
    },
    [client, accountId, queryClient, run, notify, t]
  )
}
