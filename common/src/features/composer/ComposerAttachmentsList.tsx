import { getFileTypeIcon, Icon } from '@linagora/twake-icons'
import { useMemo, useState, type ReactElement } from 'react'

import { UploadList, type UploadListItem } from '@/ds/UploadList/UploadList'
import { UploadPopup } from '@/ds/UploadList/UploadPopup'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { formatSize } from '@common/features/email/formatSize'
import { useI18n } from '@common/i18n/useI18n'

import type { ComposerAttachments } from './useComposerAttachments'

/** Files shown while the list is folded (tmail-flutter, mobile composer) */
export const FOLDED_ATTACHMENTS = 2

/** The upload list popup replaces the chips above this many uploads at once */
export const POPUP_UPLOADS = 9

const TEST_IDS = {
  list: 'composer-attachments',
  item: 'composer-attachment-item',
  remove: 'composer-attachment-remove-button',
  retry: 'composer-attachment-retry-button',
  toggle: 'composer-attachments-toggle'
} as const

type PopupState = 'idle' | 'open' | 'dismissed'

export interface ComposerAttachmentsListProps {
  files: ComposerAttachments
}

/**
 * The files of the message: chips with their state, folded when many; on
 * desktop and tablet, more than 9 uploads at once go to a popup list that
 * stays until they are all over (or the user hides it).
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

  const items = useMemo<UploadListItem[]>(
    () =>
      files.attachments.map(file => {
        const FileIcon = getFileTypeIcon(file.name, file.type)
        const thumbnailUrl = files.previews[file.id]
        return {
          id: file.id,
          name: file.name,
          size: formatSize(file.size, lang),
          status: file.status,
          progress: file.progress,
          icon: <Icon icon={FileIcon} size={20} />,
          ...(thumbnailUrl === undefined ? {} : { thumbnailUrl })
        }
      }),
    [files.attachments, files.previews, lang]
  )
  const inline = isPopupShown
    ? items.filter(item => item.status !== 'uploading')
    : items

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
    </>
  )
}
