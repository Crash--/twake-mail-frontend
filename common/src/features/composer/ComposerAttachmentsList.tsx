import { Icon } from '@linagora/twake-icons'
import type { EmailBodyPart } from 'jmap-client-ts'
import { useMemo, useRef, useState, type ReactElement } from 'react'

import { UploadList, type UploadListItem } from '@/ds/UploadList/UploadList'
import { UploadPopup } from '@/ds/UploadList/UploadPopup'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { AttachmentPreviewDialog } from '@common/features/email/AttachmentPreviewDialog'
import { attachmentIcon } from '@common/features/email/attachmentIcon'
import {
  previewKind,
  type PreviewKind
} from '@common/features/email/attachmentPreview'
import { cleanFileName } from '@common/features/email/cleanFileName'
import { formatSize } from '@common/features/email/formatSize'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { saveBlob } from '@common/utils/saveBlob'

import type { ComposerAttachment } from './composerContent'
import type { ComposerAttachments } from './useComposerAttachments'

/** Files shown while the list is folded (tmail-flutter, mobile composer) */
export const FOLDED_ATTACHMENTS = 2

/** The upload list popup replaces the chips above this many uploads at once */
export const POPUP_UPLOADS = 9

const TEST_IDS = {
  list: 'composer-attachments',
  item: 'composer-attachment-item',
  open: 'composer-attachment-open-button',
  remove: 'composer-attachment-remove-button',
  retry: 'composer-attachment-retry-button',
  toggle: 'composer-attachments-toggle'
} as const

type PopupState = 'idle' | 'open' | 'dismissed'

interface Previewed {
  part: EmailBodyPart
  kind: PreviewKind
}

/** An uploaded file as the part of an email the preview dialog shows */
function asBodyPart(file: ComposerAttachment): EmailBodyPart {
  return {
    partId: null,
    blobId: file.blobId,
    size: file.size,
    headers: [],
    name: file.name,
    type: file.type,
    charset: file.charset ?? null,
    disposition: 'attachment',
    cid: null,
    language: null,
    location: null,
    subParts: null
  }
}

export interface ComposerAttachmentsListProps {
  files: ComposerAttachments
}

/**
 * The files of the message: chips with their state, folded when many; on
 * desktop and tablet, more than 9 uploads at once go to a popup list that
 * stays until they are all over (or the user hides it). An uploaded file
 * opens from its chip, as an attachment of a received email: previewed when
 * it can be, downloaded otherwise (tmail-flutter #4050).
 */
export function ComposerAttachmentsList({
  files
}: ComposerAttachmentsListProps): ReactElement {
  const { t, lang } = useI18n()
  const screen = useScreenSize()
  const uploading = files.attachments.filter(
    file => file.status === 'uploading'
  )
  const [popup, setPopup] = useState<PopupState>('idle')
  if (uploading.length === 0 && popup !== 'idle') setPopup('idle')
  if (uploading.length > POPUP_UPLOADS && popup === 'idle') setPopup('open')
  const isPopupShown = popup === 'open' && screen !== 'mobile'
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const { notify } = useNotify()
  const [previewed, setPreviewed] = useState<Previewed | null>(null)
  const opener = useRef<HTMLElement | null>(null)

  const items = useMemo<UploadListItem[]>(
    () =>
      files.attachments.map(file => {
        const name = cleanFileName(file.name) ?? t('email.attachment')
        const FileIcon = attachmentIcon(name, file.type)
        const thumbnailUrl = files.previews[file.id]
        return {
          id: file.id,
          name,
          size: formatSize(file.size, lang),
          status: file.status,
          progress: file.progress,
          icon: <Icon icon={FileIcon} size={20} />,
          openLabel:
            previewKind(file) === null
              ? t('email.download')
              : t('email.preview.open'),
          ...(thumbnailUrl === undefined ? {} : { thumbnailUrl })
        }
      }),
    [files.attachments, files.previews, lang, t]
  )
  const inline = isPopupShown
    ? items.filter(item => item.status !== 'uploading')
    : items

  const download = async (file: ComposerAttachment): Promise<void> => {
    const name = cleanFileName(file.name) ?? t('email.attachment')
    const blob = await client.download({
      accountId,
      blobId: file.blobId,
      name,
      type: file.type
    })
    saveBlob(blob, name)
  }

  const handleOpen = (id: string): void => {
    const file = files.attachments.find(item => item.id === id)
    if (file?.status !== 'done' || file.blobId === '') return
    const kind = previewKind(file)
    if (kind === null) {
      download(file).catch((error: unknown) => {
        console.error('[composer] Attachment download failed', error)
        notify({ message: t('email.downloadFailed'), severity: 'error' })
      })
      return
    }
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setPreviewed({ part: asBodyPart(file), kind })
  }

  const handleClosePreview = (): void => {
    setPreviewed(null)
    // The focus goes back to the chip that opened the preview
    const element = opener.current
    opener.current = null
    element?.focus()
  }

  const labels = {
    remove: (name: string) => t('composer.attachments.remove', { name }),
    retry: (name: string) => t('composer.attachments.retry', { name }),
    progress: (name: string) => t('composer.attachments.progress', { name }),
    failed: t('composer.attachments.failed'),
    done: t('composer.attachments.done')
  }

  return (
    <>
      <UploadList
        items={inline}
        labels={{
          ...labels,
          list: t('composer.attachments.list', { smart_count: inline.length }),
          showLess: t('composer.attachments.showLess'),
          showMore: count => t('composer.attachments.showMore', { count })
        }}
        onRemove={files.remove}
        onRetry={files.retry}
        onOpen={handleOpen}
        foldedCount={FOLDED_ATTACHMENTS}
        status={files.status}
        testIds={TEST_IDS}
      />
      {isPopupShown ? (
        <UploadPopup
          items={items.filter(item => item.status === 'uploading')}
          title={t('composer.attachments.uploadingTitle', {
            smart_count: uploading.length
          })}
          closeLabel={t('composer.attachments.hideUploads')}
          labels={labels}
          onRemove={files.remove}
          onRetry={files.retry}
          onClose={() => {
            setPopup('dismissed')
          }}
          testIds={{
            item: 'composer-upload-popup-item',
            remove: 'composer-upload-popup-remove-button',
            retry: 'composer-upload-popup-retry-button',
            popup: 'composer-upload-popup',
            close: 'composer-upload-popup-close-button'
          }}
        />
      ) : null}
      {previewed ? (
        <AttachmentPreviewDialog
          part={previewed.part}
          kind={previewed.kind}
          onClose={handleClosePreview}
        />
      ) : null}
    </>
  )
}
