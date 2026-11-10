import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { Icon } from '@/ds/Icon/Icon'
import { TransferDialog } from '@/ds/TransferDialog/TransferDialog'
import type { DriveUpload } from '@common/features/drive/useDriveUpload'
import { attachmentIcon } from '@common/features/email/attachmentIcon'
import { cleanFileName } from '@common/features/email/cleanFileName'
import { formatSize } from '@common/features/email/formatSize'
import { useI18n } from '@common/i18n/useI18n'

export interface DriveUploadDialogProps {
  upload: DriveUpload
  /** The size limit of the mail server the files went over */
  maxSize: number | null
}

/**
 * "Attaching file": the files too large for the mail server going to Twake
 * Drive, each with its progress and its cancel (Figma "Teammail 1.1"). The
 * frames of Drive stay hidden: it has no screen for this.
 */
export function DriveUploadDialog({
  upload: { files, setFrameContainer, cancel, cancelAll },
  maxSize
}: DriveUploadDialogProps): ReactElement {
  const { t, lang } = useI18n()
  const items = files.map(item => {
    const name = cleanFileName(item.file.name) ?? t('email.attachment')
    return {
      id: item.id,
      name,
      size: formatSize(item.file.size, lang),
      status: item.status,
      progress: item.progress,
      icon: <Icon icon={attachmentIcon(name, item.file.type)} size={20} />
    }
  })
  // One file at a time: the first one still uploading is under way
  const current = items.find(item => item.status === 'uploading')
  const hasFailed = items.some(item => item.status === 'failed')
  return (
    <>
      <Box ref={setFrameContainer} hidden />
      <TransferDialog
        open={items.length > 0}
        title={t('composer.driveUpload.title')}
        description={t('composer.driveUpload.description', {
          maxSize: formatSize(maxSize ?? 0, lang)
        })}
        items={items}
        labels={{
          remove: name => t('composer.driveUpload.cancelFile', { name }),
          retry: name => t('composer.attachments.retry', { name }),
          progress: name => t('composer.attachments.progress', { name }),
          failed: t('composer.attachments.failed'),
          done: t('composer.attachments.done')
        }}
        cancelLabel={
          current === undefined ? t('common.close') : t('common.cancel')
        }
        onCancel={cancelAll}
        onRemove={cancel}
        status={
          current === undefined
            ? ''
            : t('composer.attachments.progress', { name: current.name })
        }
        error={
          current === undefined && hasFailed
            ? t('composer.driveUpload.failed')
            : null
        }
        data-testid="drive-upload-dialog"
      />
    </>
  )
}
