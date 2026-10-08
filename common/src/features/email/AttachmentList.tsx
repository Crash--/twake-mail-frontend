import type { EmailBodyPart } from 'jmap-client-ts'
import { useRef, useState, type ReactElement } from 'react'

import {
  AttachmentCard,
  AttachmentCardRow,
  AttachmentDownloadAll,
  AttachmentHeader,
  AttachmentListFrame,
  AttachmentTextButton,
  useElementWidth,
  visibleAttachmentCount
} from '@/ds/AttachmentCard/AttachmentCard'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useAuthService } from '@common/features/auth/AuthProvider'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { saveBlob } from '@common/utils/saveBlob'

import { AttachmentPreviewDialog } from './AttachmentPreviewDialog'
import { attachmentIcon } from './attachmentIcon'
import { cleanFileName } from './cleanFileName'
import { previewKind } from './attachmentPreview'
import {
  downloadAllBaseName,
  expandDownloadAllUrl,
  getDownloadAllEndpoint,
  isDownloadAllAvailable,
  isZipArchive
} from './downloadAll'
import { formatSize } from './formatSize'

const JMAP_ACCEPT = 'application/json; jmapVersion=rfc-8621'

export interface AttachmentListProps {
  attachments: readonly EmailBodyPart[]
  /** The email they belong to: "Download all" zips its attachments */
  emailId?: string
}

/**
 * The attachments of an email, as tmail-flutter: a header (count, total
 * size, "Download all" when the server offers it) over chips that preview
 * the file when it can be, and download it otherwise, with a download
 * button each. Collapsed, a desktop shows the chips that fit on one row and
 * a phone three, then "Show +N more"; expanded, all of them and "Hide N".
 */
export function AttachmentList({
  attachments,
  emailId
}: AttachmentListProps): ReactElement | null {
  const { t, lang } = useI18n()
  const client = useJmapClient()
  const authService = useAuthService()
  const { notify } = useNotify()
  const { accountId, session } = useJmapSession()
  const [isExpanded, setIsExpanded] = useState(false)
  const isPhone = useScreenSize() === 'mobile'
  const row = useElementWidth()
  const [previewed, setPreviewed] = useState<{
    part: EmailBodyPart
    kind: NonNullable<ReturnType<typeof previewKind>>
  } | null>(null)
  const opener = useRef<HTMLElement | null>(null)

  if (attachments.length === 0) return null

  const reportDownloadFailure = (error: unknown): void => {
    console.error('[email] Attachment download failed', error)
    notify({ message: t('email.downloadFailed'), severity: 'error' })
  }

  const download = async (part: EmailBodyPart): Promise<void> => {
    if (!part.blobId) return
    const name = cleanFileName(part.name) ?? t('email.attachment')
    const blob = await client.download({
      accountId,
      blobId: part.blobId,
      name,
      type: part.type
    })
    saveBlob(blob, name)
  }

  const fetchArchive = async (url: string): Promise<Response> => {
    const request = async (): Promise<Response> => {
      const authorization = await authService.getAuthorizationHeader()
      return fetch(url, {
        headers: {
          Accept: JMAP_ACCEPT,
          ...(authorization !== null ? { Authorization: authorization } : {})
        },
        referrerPolicy: 'no-referrer'
      })
    }
    const response = await request()
    if (response.status === 401 && (await authService.onUnauthorized())) {
      return request()
    }
    return response
  }

  const downloadAll = async (): Promise<void> => {
    const endpoint = getDownloadAllEndpoint(session, accountId)
    if (endpoint === null || emailId === undefined) return
    const baseName = downloadAllBaseName()
    const response = await fetchArchive(
      expandDownloadAllUrl(endpoint, { accountId, emailId, name: baseName })
    )
    if (!response.ok) throw new Error(`Download all: HTTP ${response.status}`)
    const bytes = await response.arrayBuffer()
    if (!isZipArchive(bytes)) {
      throw new Error(
        `Download all: not a zip archive (${response.headers.get('Content-Type') ?? 'no type'})`
      )
    }
    // The type is ours: the server may label the archive with any type
    const archive = new Blob([bytes], { type: 'application/zip' })
    saveBlob(archive, `${baseName}.zip`)
  }

  const totalSize = attachments.reduce((sum, part) => sum + part.size, 0)
  const canDownloadAll =
    emailId !== undefined &&
    isDownloadAllAvailable(session, accountId, attachments.length)
  const collapsedCount = visibleAttachmentCount(
    attachments.length,
    row.width,
    isPhone
  )
  // Hidden while collapsed: what "Hide N" brings back
  const collapsedHidden = attachments.length - collapsedCount
  const shown = isExpanded ? attachments : attachments.slice(0, collapsedCount)

  const handleDownloadAll = (): void => {
    downloadAll().catch(reportDownloadFailure)
  }
  const handleClose = (): void => {
    setPreviewed(null)
    // The dialog gives the focus back to the card that opened it
    const element = opener.current
    opener.current = null
    element?.focus()
  }

  const showMore =
    !isExpanded && collapsedHidden > 0 ? (
      <AttachmentTextButton
        label={t('email.attachmentsMore', { count: collapsedHidden })}
        onClick={() => {
          setIsExpanded(true)
        }}
        data-testid="attachment-show-more"
      />
    ) : null
  const showLess =
    isExpanded && collapsedHidden > 0 ? (
      <AttachmentTextButton
        label={t('email.attachmentsHide', { count: collapsedHidden })}
        onClick={() => {
          setIsExpanded(false)
        }}
        data-testid="attachment-show-less"
      />
    ) : null

  return (
    <AttachmentListFrame
      data-testid="attachment-list"
      header={
        <AttachmentHeader
          title={t('email.attachmentsTitle', {
            smart_count: attachments.length,
            size: formatSize(totalSize, lang)
          })}
          action={
            canDownloadAll ? (
              <AttachmentDownloadAll
                label={t('email.downloadAll')}
                onClick={handleDownloadAll}
                data-testid="download-all-attachments-button"
              />
            ) : null
          }
        />
      }
    >
      <AttachmentCardRow
        isColumn={isPhone}
        isExpanded={isExpanded}
        rowRef={row.ref}
      >
        {shown.map((part, index) => {
          const name = cleanFileName(part.name) ?? t('email.attachment')
          const kind = previewKind({ type: part.type, name: part.name })
          const FileIcon = attachmentIcon(name, part.type)
          const handleDownload = (): void => {
            download(part).catch(reportDownloadFailure)
          }
          const handleOpen = (): void => {
            if (kind === null) {
              handleDownload()
              return
            }
            opener.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null
            setPreviewed({ part, kind })
          }
          return (
            <AttachmentCard
              key={part.partId ?? part.blobId ?? index}
              name={name}
              size={formatSize(part.size, lang)}
              thumbnail={<FileIcon />}
              openLabel={
                kind === null ? t('email.download') : t('email.preview.open')
              }
              downloadLabel={t('email.download')}
              onOpen={handleOpen}
              onDownload={handleDownload}
              data-testid="attachment-item"
            />
          )
        })}
        {isPhone ? null : (showMore ?? showLess)}
      </AttachmentCardRow>
      {isPhone ? (showMore ?? showLess) : null}
      {previewed ? (
        <AttachmentPreviewDialog
          part={previewed.part}
          kind={previewed.kind}
          onClose={handleClose}
        />
      ) : null}
    </AttachmentListFrame>
  )
}
