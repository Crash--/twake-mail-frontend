import { Alert, Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useI18n } from '@common/i18n/useI18n'

import { useEmptyFolder } from './useEmptyFolder'

export interface EmptyFolderBannerProps {
  mailbox: MailboxSummary
}

/**
 * Above the list of the Trash (with emails or subfolders) and of Spam (with
 * emails), as tmail-flutter: a warning and the button emptying the folder.
 */
export function EmptyFolderBanner({
  mailbox
}: EmptyFolderBannerProps): ReactElement | null {
  const { t } = useI18n()
  const emptyFolder = useEmptyFolder()
  const { data: mailboxes = [] } = useMailboxes()
  const isTrash = mailbox.role === 'trash'
  const hasSubfolders = mailboxes.some(
    candidate => candidate.parentId === mailbox.id
  )
  const isShown =
    (isTrash && (mailbox.totalEmails > 0 || hasSubfolders)) ||
    (mailbox.role === 'junk' && mailbox.totalEmails > 0)
  if (!isShown) return null

  const handleEmpty = (): void => {
    void emptyFolder(mailbox)
  }

  return (
    <Alert
      severity="warning"
      // Part of the screen, not an event: no live announcement
      role="note"
      className="u-m-half"
      action={
        <Button
          color="inherit"
          size="small"
          onClick={handleEmpty}
          data-testid="empty-trash-banner-button"
        >
          {t(
            isTrash
              ? 'emptyFolder.emptyTrashNow'
              : 'emptyFolder.deleteAllSpamNow'
          )}
        </Button>
      }
      data-testid="empty-trash-banner"
    >
      {t(isTrash ? 'emptyFolder.trashBanner' : 'emptyFolder.spamBanner')}
    </Alert>
  )
}
