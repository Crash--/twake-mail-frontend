import { Attachment, Download, Icon } from '@linagora/twake-icons'
import { Box, Button, Typography } from '@linagora/twake-mui'
import type { EmailBodyPart } from 'jmap-client-ts'
import { useRef, useState, type ReactElement } from 'react'

import {
  AttachmentCard,
  AttachmentCardRow,
  AttachmentMoreCard
} from '@/ds/AttachmentCard/AttachmentCard'
import { useAuthService } from '@common/features/auth/AuthProvider'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { saveBlob } from '@common/utils/saveBlob'

import { AttachmentPreviewDialog } from './AttachmentPreviewDialog'
import { attachmentIcon } from './attachmentIcon'
import { previewKind } from './attachmentPreview'
import {
  downloadAllBaseName,
  expandDownloadAllUrl,
  getDownloadAllEndpoint,
  isDownloadAllAvailable
} from './downloadAll'
import { formatSize } from './formatSize'

/** Cards shown before "+N more" */
export const COLLAPSED_ATTACHMENT_COUNT = 3

const JMAP_ACCEPT = 'application/json; jmapVersion=rfc-8621'

export interface AttachmentListProps {
  attachments: readonly EmailBodyPart[]
  /** The email they belong to: "Download all" zips its attachments */
  emailId?: string
}

/**
 * The attachments of an email: a header (count, total size, "Download all"
 * when the server offers it) over cards that preview the file when it can
 * be, and download it otherwise; the download action of each card is always
 * there.
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
    const name = part.name ?? t('email.attachment')
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
    // The type is ours: whatever the server says, the blob is an archive
    const archive = new Blob([await response.arrayBuffer()], {
      type: 'application/zip'
    })
    saveBlob(archive, `${baseName}.zip`)
  }

  const totalSize = attachments.reduce((sum, part) => sum + part.size, 0)
  const canDownloadAll =
    emailId !== undefined &&
    isDownloadAllAvailable(session, accountId, attachments.length)
  const hiddenCount = isExpanded
    ? 0
    : Math.max(attachments.length - COLLAPSED_ATTACHMENT_COUNT, 0)
  const shown = isExpanded
    ? attachments
    : attachments.slice(0, COLLAPSED_ATTACHMENT_COUNT)

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

  return (
    <Box className="u-mt-1" data-testid="attachment-list">
      <Box className="u-flex u-flex-items-center u-mb-half">
        <Icon icon={Attachment} aria-hidden="true" />
        <Typography
          variant="body2"
          color="text.secondary"
          component="h3"
          className="u-ml-half u-mr-1"
        >
          {t('email.attachmentsTitle', {
            smart_count: attachments.length,
            size: formatSize(totalSize, lang)
          })}
        </Typography>
        {canDownloadAll ? (
          <Button
            size="small"
            endIcon={<Icon icon={Download} aria-hidden="true" />}
            onClick={handleDownloadAll}
            data-testid="download-all-attachments-button"
          >
            {t('email.downloadAll')}
          </Button>
        ) : null}
      </Box>
      <AttachmentCardRow>
        {shown.map((part, index) => {
          const name = part.name ?? t('email.attachment')
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
        {hiddenCount > 0 ? (
          <AttachmentMoreCard
            label={t('email.attachmentsMore', { count: hiddenCount })}
            onClick={() => {
              setIsExpanded(true)
            }}
            data-testid="attachment-show-more"
          />
        ) : null}
      </AttachmentCardRow>
      {isExpanded && attachments.length > COLLAPSED_ATTACHMENT_COUNT ? (
        <Button
          size="small"
          className="u-mt-half"
          onClick={() => {
            setIsExpanded(false)
          }}
          data-testid="attachment-show-less"
        >
          {t('email.attachmentsHide', {
            count: attachments.length - COLLAPSED_ATTACHMENT_COUNT
          })}
        </Button>
      ) : null}
      {previewed ? (
        <AttachmentPreviewDialog
          part={previewed.part}
          kind={previewed.kind}
          onClose={handleClose}
        />
      ) : null}
    </Box>
  )
}
