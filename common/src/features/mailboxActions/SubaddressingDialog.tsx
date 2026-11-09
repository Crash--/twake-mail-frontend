import { Icon, Copy } from '@linagora/twake-icons'
import {
  Button,
  ConfirmDialog,
  IconButton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

export interface SubaddressingDialogProps {
  /** The name of the folder, as the tree shows it */
  folderName: string
  /** Its sub-address, `user+Folder@domain` */
  address: string
  onCopy: () => void
  onAllow: () => void
  onClose: () => void
}

/**
 * Asks before allowing sub-addressing on a folder, as tmail-flutter: anyone
 * will be able to send mail straight into it, at the address shown, which
 * can be copied from here
 */
export function SubaddressingDialog({
  folderName,
  address,
  onCopy,
  onAllow,
  onClose
}: SubaddressingDialogProps): ReactElement {
  const { t } = useI18n()
  const messageId = useId()

  return (
    <ConfirmDialog
      open
      title={t('folders.menu.allowSubaddressing')}
      content={
        <div id={messageId}>
          <Typography component="p">
            {t('folders.subaddressing.confirm', { nameMailbox: folderName })}
          </Typography>
          <span className="u-flex u-flex-items-center u-flex-justify-center u-mt-1">
            <Typography
              component="span"
              className="u-ellipsis"
              data-testid="subaddressing-address"
            >
              {address}
            </Typography>
            <Tooltip
              title={t('folders.menu.copySubaddress')}
              disableInteractive
            >
              <IconButton
                aria-label={t('folders.menu.copySubaddress')}
                onClick={onCopy}
                data-testid="subaddressing-copy-button"
              >
                <Icon icon={Copy} />
              </IconButton>
            </Tooltip>
          </span>
        </div>
      }
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            autoFocus
            onClick={onAllow}
            data-testid="subaddressing-allow-button"
          >
            {t('folders.subaddressing.allow')}
          </Button>
        </>
      }
      onClose={onClose}
      aria-describedby={messageId}
      data-testid="subaddressing-dialog"
    />
  )
}
