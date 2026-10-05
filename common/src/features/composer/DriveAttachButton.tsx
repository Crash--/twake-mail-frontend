import { Icon, ToTheCloud } from '@linagora/twake-icons'
import { Button, IconButton, Tooltip, Typography } from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement } from 'react'

import { FramedDialog } from '@/ds/FramedDialog/FramedDialog'
import type { DriveFile } from '@common/features/drive/driveIntent'
import {
  useDrivePicker,
  useDriveUrl
} from '@common/features/drive/useDrivePicker'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'

export interface DriveAttachButtonProps {
  /** Largest file that can be attached, null when the server sets none */
  maxFileSize: number | null
  /** Files to share by link: their cards go in the message, the focus after them */
  onLinks: (files: DriveFile[]) => void
  /** Files downloaded from Drive, to attach as any picked file */
  onAttach: (files: File[]) => void
}

/**
 * "Attach from Drive" (`TDRIVE_ENABLED`): the Twake Drive picker in a
 * dialog, where the user picks files and adds them as a link (a card in
 * the message) or as attachments (downloaded, then uploaded as any file,
 * with its progress). Nothing without a Drive for the user.
 */
export function DriveAttachButton({
  maxFileSize,
  onLinks,
  onAttach
}: DriveAttachButtonProps): ReactElement | null {
  const { t } = useI18n()
  const { notify } = useNotify()
  const driveUrl = useDriveUrl()
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Where the focus goes once the dialog is closed: the message after
  // inserted cards, the button otherwise
  const focusAfterCloseRef = useRef<'button' | 'message'>('button')

  const attach = async (files: DriveFile[]): Promise<void> => {
    const downloaded: File[] = []
    for (const file of files) {
      if (file.downloadLink === null) continue
      if (
        maxFileSize !== null &&
        file.size !== null &&
        file.size > maxFileSize
      ) {
        notify({
          message: t('composer.drive.tooLarge', { name: file.name }),
          severity: 'error'
        })
        continue
      }
      // A link with its own secret: no credentials of the app go with it
      const response = await fetch(file.downloadLink, { credentials: 'omit' })
      if (!response.ok) throw new Error(`Download failed: ${response.status}`)
      const content = await response.arrayBuffer()
      downloaded.push(
        new File([content], file.name, {
          type:
            file.mimeType ??
            response.headers.get('Content-Type') ??
            'application/octet-stream'
        })
      )
    }
    if (downloaded.length > 0) onAttach(downloaded)
  }

  const handleFiles = (files: DriveFile[]): void => {
    // As tmail-flutter: a sharing link wins over a download link
    const links = files.filter(file => file.sharingLink !== null)
    const toAttach = files.filter(
      file => file.sharingLink === null && file.downloadLink !== null
    )
    if (links.length > 0) {
      // Gives the focus to the message, after the cards
      onLinks(links)
      notify({
        message: t('composer.drive.linked', {
          smart_count: links.length,
          name: links[0]?.name ?? ''
        }),
        severity: 'success'
      })
    }
    if (toAttach.length > 0) {
      attach(toAttach).catch((error: unknown) => {
        console.warn('[drive] Cannot attach the files', error)
        notify({ message: t('composer.drive.attachFailed'), severity: 'error' })
      })
    }
    focusAfterCloseRef.current = links.length > 0 ? 'message' : 'button'
  }

  const picker = useDrivePicker(
    driveUrl,
    {
      linkLabel: t('composer.drive.addAsLink'),
      attachLabel: t('composer.drive.addAsAttachment'),
      maxFileSize,
      theme: 'light'
    },
    handleFiles
  )

  const isOpen = picker.state.status !== 'closed'
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (isOpen) {
      focusAfterCloseRef.current = 'button'
    } else if (wasOpenRef.current && focusAfterCloseRef.current === 'button') {
      buttonRef.current?.focus()
    }
    wasOpenRef.current = isOpen
  }, [isOpen])

  if (driveUrl === null) return null
  const { state } = picker

  return (
    <>
      <Tooltip title={t('composer.drive.attach')}>
        <IconButton
          ref={buttonRef}
          aria-label={t('composer.drive.attach')}
          aria-haspopup="dialog"
          size="medium"
          onClick={picker.open}
          className="u-ml-half"
          data-testid="composer-drive-button"
        >
          <Icon icon={ToTheCloud} size={20} aria-hidden="true" />
        </IconButton>
      </Tooltip>
      <FramedDialog
        open={isOpen}
        title={t('composer.drive.title')}
        src={state.status === 'open' ? state.intent.href : null}
        frameTitle={t('composer.drive.frameTitle')}
        isReady={state.status === 'open' && state.isReady}
        loadingLabel={t('composer.drive.loading')}
        closeLabel={t('common.close')}
        onClose={picker.close}
        showCloseButton={state.status === 'open' && state.showCloseButton}
        frameSize={state.status === 'open' ? state.size : null}
        frameRef={picker.frameRef}
        disableRestoreFocus
        message={
          state.status === 'failed' ? (
            <>
              <Typography>{t('composer.drive.error')}</Typography>
              <Button
                variant="outlined"
                color="inherit"
                onClick={picker.open}
                data-testid="drive-picker-retry-button"
              >
                {t('composer.drive.retry')}
              </Button>
            </>
          ) : undefined
        }
        data-testid="drive-picker-dialog"
        frameTestId="drive-picker-frame"
      />
    </>
  )
}
