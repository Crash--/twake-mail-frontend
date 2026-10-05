import { useCallback } from 'react'

import { useComposer } from '@common/features/composer/ComposerProvider'
import type { EmailActionId } from '@common/features/emailActions/emailActionItems'
import { useRunEmailAction } from '@common/features/emailActions/useRunEmailAction'

import type { EmailDetail } from './queries'
import { useDownloadEml } from './useDownloadEml'
import { usePrintEmail } from './usePrintEmail'
import { useUnsubscribe } from './useUnsubscribe'

/**
 * The actions that need the whole email, which an open email has (Print,
 * Download as EML, Unsubscribe) and the ones that open it in a composer
 * (Edit as new), then the common ones. Resolves to whether the email
 * changed.
 */
export function useRunViewedEmailAction(): (
  id: EmailActionId,
  email: EmailDetail,
  mailboxId: string | null
) => Promise<boolean> {
  const runAction = useRunEmailAction()
  const { openComposer } = useComposer()
  const printEmail = usePrintEmail()
  const downloadEml = useDownloadEml()
  const { unsubscribe } = useUnsubscribe()

  return useCallback(
    async (id, email, mailboxId) => {
      switch (id) {
        case 'print':
          await printEmail(email)
          return false
        case 'download-eml':
          await downloadEml(email)
          return false
        case 'unsubscribe':
          await unsubscribe(email, mailboxId)
          return false
        case 'edit-as-new':
          openComposer({ editAsNewEmailId: email.id })
          return false
        default:
          return runAction(id, [email], mailboxId)
      }
    },
    [runAction, openComposer, printEmail, downloadEml, unsubscribe]
  )
}

/** The actions of `SINGLE_EMAIL_ACTIONS` an open email can offer */
export function viewedEmailExtras(
  email: Pick<EmailDetail, 'blobId'>,
  canUnsubscribe: boolean
): EmailActionId[] {
  return [
    ...(canUnsubscribe ? (['unsubscribe'] as const) : []),
    'print',
    ...(email.blobId ? (['download-eml'] as const) : []),
    'edit-as-new'
  ]
}
