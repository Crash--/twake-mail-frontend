import { Box } from '@linagora/twake-mui'
import { useMemo, type ReactElement } from 'react'

import { MessageAlert } from '@/ds/MessageAlert/MessageAlert'
import { availableEmailActions } from '@common/features/emailActions/emailActionItems'
import { mayOnEmail } from '@common/features/emailActions/emailRights'
import { useEmailActions } from '@common/features/emailActions/useEmailActions'
import { useRunEmailAction } from '@common/features/emailActions/useRunEmailAction'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'

import { messageMailboxId } from './messageMailbox'
import { TWP_MESSAGE_HEADER } from './twpWarnings'
import {
  isTwpWarningDismissed,
  offersNotSpam,
  parseTwpWarnings,
  twpDismissKeyword,
  twpWarningCodeText,
  type TwpWarning
} from './twpWarnings'
import type { EmailDetail } from './queries'

/**
 * The warnings of an email the user has not dismissed, in header order
 * (the keyword `twp-warning-dismissed-<index>` keeps one dismissed)
 */
export function useVisibleTwpWarnings(email: EmailDetail): TwpWarning[] {
  const values = email[TWP_MESSAGE_HEADER]
  const keywords = email.keywords
  return useMemo(
    () =>
      parseTwpWarnings(values).filter(
        warning => !isTwpWarningDismissed({ keywords }, warning)
      ),
    [values, keywords]
  )
}

export interface TwpWarningBannersProps {
  email: EmailDetail
  /** The folder the email is open from, null from search results */
  mailboxId: string | null
  /** After "Not spam" moved the email */
  onAction?: (id: 'not-spam') => void
}

/**
 * One banner per warning the backend put on the email (`X-TWP-Message`),
 * between its header and its body. Known codes have a localized text, any
 * other warning shows the text of the server as plain text. Dismissing
 * sets a keyword, shown at once and put back when the server refuses it;
 * it needs the right to set keywords in the folder. An error-level warning
 * on an email in Spam offers "Not spam".
 */
export function TwpWarningBanners({
  email,
  mailboxId,
  onAction
}: TwpWarningBannersProps): ReactElement | null {
  const { t } = useI18n()
  const warnings = useVisibleTwpWarnings(email)
  const { data: mailboxes = [], isSuccess: hasMailboxes } = useMailboxes()
  const { run } = useEmailActions()
  const runAction = useRunEmailAction()
  const { notify } = useNotify()
  if (warnings.length === 0) return null

  const folderId = messageMailboxId(email, mailboxId, mailboxes)
  const folder = mailboxes.find(candidate => candidate.id === folderId) ?? null
  // Until the folders are known, their rights are not: nothing to click
  const canDismiss =
    hasMailboxes && mayOnEmail(email, 'maySetKeywords', mailboxes, folderId)
  const isInSpam = availableEmailActions([email], folder, mailboxes).some(
    item => item.id === 'not-spam'
  )

  const handleDismiss = (warning: TwpWarning): void => {
    void run({
      action: 'setKeyword',
      keyword: twpDismissKeyword(warning.index),
      emails: [email],
      mailboxId: folderId,
      silent: true
    }).then(done => {
      if (!done)
        notify({ message: t('common.unknownError'), severity: 'error' })
    })
  }

  const handleNotSpam = (): void => {
    void runAction('not-spam', [email], folderId).then(done => {
      if (done) onAction?.('not-spam')
    })
  }

  return (
    <Box className="u-mv-1" data-testid="twp-warnings">
      {warnings.map(warning => {
        const codeText = twpWarningCodeText(warning.code)
        return (
          <MessageAlert
            key={warning.index}
            className="u-mb-half"
            level={warning.level}
            levelLabel={t(`email.twpWarning.levels.${warning.level}`)}
            title={t(`email.twpWarning.titles.${warning.level}`)}
            description={codeText === null ? warning.text : t(codeText)}
            action={
              offersNotSpam(warning, isInSpam)
                ? {
                    label: t('email.twpWarning.notSpam'),
                    onClick: handleNotSpam,
                    'data-testid': `twp-warning-not-spam-${warning.index}`
                  }
                : undefined
            }
            dismiss={
              canDismiss
                ? {
                    label: t('common.dismiss'),
                    onClick: () => {
                      handleDismiss(warning)
                    },
                    'data-testid': `twp-warning-dismiss-${warning.index}`
                  }
                : undefined
            }
            data-testid={`twp-warning-${warning.index}`}
          />
        )
      })}
    </Box>
  )
}
