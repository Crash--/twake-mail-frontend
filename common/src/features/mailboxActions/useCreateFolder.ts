import { useQueryClient } from '@tanstack/react-query'
import { assertSetSucceeded } from 'jmap-client-ts'
import { useCallback } from 'react'

import {
  mailboxesQueryOptions,
  type MailboxSummary
} from '@common/features/mailbox/queries'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

/**
 * Creates a folder under `parentId` (null: the top level) and says so;
 * resolves to it once the folders are fetched again, null when it failed
 */
export type CreateFolder = (
  name: string,
  parentId: string | null
) => Promise<MailboxSummary | null>

/** Creates a folder with `Mailbox/set`, as tmail-flutter */
export function useCreateFolder(): CreateFolder {
  const { t } = useI18n()
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const queryClient = useQueryClient()
  const { notify } = useNotify()

  return useCallback(
    async (name, parentId) => {
      try {
        const response = await client.call('Mailbox/set', {
          accountId,
          create: { folder: { name, parentId, isSubscribed: true } }
        })
        assertSetSucceeded(response)
        const id = response.created?.folder?.id
        notify({
          message: t('folders.create.success', { folderName: name }),
          severity: 'success'
        })
        // The folder must be known before the app shows or picks it
        const data = await queryClient
          .query({ ...mailboxesQueryOptions(client, accountId), staleTime: 0 })
          .catch(() => null)
        return data?.list.find(mailbox => mailbox.id === id) ?? null
      } catch (error: unknown) {
        console.error('[mailbox] Cannot create the folder', error)
        notify({ message: t('folders.create.failure'), severity: 'error' })
        return null
      }
    },
    [client, accountId, queryClient, notify, t]
  )
}
