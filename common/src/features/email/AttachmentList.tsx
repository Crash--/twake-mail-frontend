import { Box, Typography } from '@linagora/twake-mui'
import type { EmailBodyPart } from 'jmap-client-ts'
import type { ReactElement } from 'react'

import { AttachmentChip } from '@/ds/AttachmentChip/AttachmentChip'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { saveBlob } from '@common/utils/saveBlob'

import { formatSize } from './formatSize'

export interface AttachmentListProps {
  attachments: readonly EmailBodyPart[]
}

/**
 * The attachments of an email: name and size, downloaded on click.
 */
export function AttachmentList({
  attachments
}: AttachmentListProps): ReactElement | null {
  const { t, lang } = useI18n()
  const client = useJmapClient()
  const { accountId } = useJmapSession()

  if (attachments.length === 0) return null

  const download = async (part: EmailBodyPart): Promise<void> => {
    if (!part.blobId) return
    const name = part.name ?? t('email.attachment')
    const blob = await client.download({
      accountId,
      blobId: part.blobId,
      name,
      type: part.type
    })
    saveBlob(blob, name)
  }

  return (
    <Box className="u-mt-1" data-testid="attachment-list">
      <Typography variant="subtitle2" className="u-mb-half">
        {t('email.attachments')}
      </Typography>
      <Box className="u-flex u-flex-wrap u-flex-items-center">
        {attachments.map((part, index) => {
          const name = part.name ?? t('email.attachment')
          const handleDownload = (): void => {
            download(part).catch((error: unknown) => {
              console.error('[email] Attachment download failed', error)
            })
          }
          return (
            <AttachmentChip
              key={part.partId ?? part.blobId ?? index}
              name={name}
              size={formatSize(part.size, lang)}
              downloadLabel={t('email.download')}
              onDownload={handleDownload}
              data-testid="attachment-item"
            />
          )
        })}
      </Box>
    </Box>
  )
}
