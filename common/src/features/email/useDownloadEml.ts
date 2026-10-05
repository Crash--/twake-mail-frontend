import { useCallback } from 'react'

import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { saveBlob } from '@common/utils/saveBlob'

import { emlFileName } from './emlFileName'
import type { EmailDetail } from './queries'

/**
 * "Download message as EML" (tmail-flutter `downloadMessageAsEML`): the JMAP
 * blob of the email (RFC 5322 message), downloaded with the credentials of
 * the session and saved as `<subject>.eml`. Says so when it failed.
 */
export function useDownloadEml(): (
  email: Pick<EmailDetail, 'blobId' | 'subject'>
) => Promise<void> {
  const { t } = useI18n()
  const { notify } = useNotify()
  const client = useJmapClient()
  const { accountId } = useJmapSession()

  return useCallback(
    async ({ blobId, subject }): Promise<void> => {
      try {
        if (!blobId) throw new Error('Email without blob id')
        const name = emlFileName(subject, blobId)
        const blob = await client.download({
          accountId,
          blobId,
          name,
          type: 'application/octet-stream'
        })
        saveBlob(blob, name)
      } catch (error: unknown) {
        console.error('[email] Cannot download the message as EML', error)
        notify({
          message: t('emailActions.toast.downloadEmlFailed'),
          severity: 'error'
        })
      }
    },
    [t, notify, client, accountId]
  )
}
