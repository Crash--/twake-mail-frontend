import { Box } from '@linagora/twake-mui'
import { useMemo, useRef, type ReactElement, type RefObject } from 'react'

import { MessageAlert } from '@/ds/MessageAlert/MessageAlert'
import { availableEmailActions } from '@common/features/emailActions/emailActionItems'
import { mayOnEmail } from '@common/features/emailActions/emailRights'
import { useEmailActions } from '@common/features/emailActions/useEmailActions'
import { useRunEmailAction } from '@common/features/emailActions/useRunEmailAction'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useOnlineStatus } from '@common/features/network/useOnlineStatus'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'

import {
  CALENDAR_SENDER_MISMATCH_HEADER,
  parseCalendarSenderMismatch
} from './calendarSenderMismatch'
import { messageMailboxId } from './messageMailbox'
import {
  SUSPICIOUS_DISPLAY_NAME_HEADER,
  SUSPICIOUS_DOMAIN_HEADER,
  TWP_MESSAGE_HEADER
} from './twpWarnings'
import {
  isTwpWarningDismissed,
  offersNotSpam,
  parseTwpWarnings,
  twpDismissKeyword,
  twpWarningMessage,
  withSuspiciousSender,
  type TwpWarning
} from './twpWarnings'
import type { EmailDetail } from './queries'

/**
 * The warnings of an email the user has not dismissed, in header order
 * (the keyword `twp-warning-dismissed-<index>` keeps one dismissed)
 */
export function useVisibleTwpWarnings(email: EmailDetail): TwpWarning[] {
  const values = email[TWP_MESSAGE_HEADER]
  const displayNameFlag = email[SUSPICIOUS_DISPLAY_NAME_HEADER]
  const domainFlag = email[SUSPICIOUS_DOMAIN_HEADER]
  const keywords = email.keywords
  return useMemo(
    () =>
      withSuspiciousSender(parseTwpWarnings(values), [
        displayNameFlag,
        domainFlag
      ]).filter(warning => !isTwpWarningDismissed({ keywords }, warning)),
    [values, displayNameFlag, domainFlag, keywords]
  )
}

export interface TwpWarningBannersProps {
  email: EmailDetail
  /** The folder the email is open from, null from search results */
  mailboxId: string | null
  /** After "Not spam" moved the email */
  onAction?: (id: 'not-spam') => void
  /**
   * The message (its subject or header): takes the focus when the last
   * banner is dismissed, the focused Dismiss button going with it
   */
  focusTargetAfterLast: RefObject<HTMLElement | null>
}

/**
 * The warning whose Dismiss button takes the focus when `dismissed` goes:
 * the next one, the previous one after the last, null when it was alone
 */
function neighbourOf(
  warnings: TwpWarning[],
  dismissed: TwpWarning
): TwpWarning | null {
  const position = warnings.findIndex(
    warning => warning.index === dismissed.index
  )
  return warnings[position + 1] ?? warnings[position - 1] ?? null
}

/**
 * One banner per warning the backend put on the email (`X-TWP-Message`),
 * between its header and its body. Known codes have a localized text, any
 * other warning shows the text of the server as plain text
 * (`calendar-sender-mismatch` names the addresses of
 * `X-Twake-Calendar-Sender-Mismatch`). Dismissing
 * sets a keyword, shown at once and put back when the server refuses it;
 * it needs the right to set keywords in the folder and is disabled offline,
 * as in tmail-flutter. An error-level warning
 * on an email in Spam offers "Not spam". The focus never falls on the
 * page when a banner goes: it moves to the Dismiss button of a remaining
 * banner, or to the message after the last one, and back to the banner
 * when the server refuses the dismissal.
 */
export function TwpWarningBanners({
  email,
  mailboxId,
  onAction,
  focusTargetAfterLast
}: TwpWarningBannersProps): ReactElement | null {
  const { t } = useI18n()
  const warnings = useVisibleTwpWarnings(email)
  const { data: mailboxes = [], isSuccess: hasMailboxes } = useMailboxes()
  const { run } = useEmailActions()
  const runAction = useRunEmailAction()
  const { notify } = useNotify()
  const isOnline = useOnlineStatus()
  const mismatchValue = email[CALENDAR_SENDER_MISMATCH_HEADER]
  const mismatch = useMemo(
    () => parseCalendarSenderMismatch(mismatchValue),
    [mismatchValue]
  )
  // The Dismiss buttons by warning index
  const dismissButtons = useRef(new Map<number, HTMLButtonElement>())
  // A refused dismissal whose banner, once back, takes the focus back
  const refocusOnReturn = useRef<number | null>(null)
  if (warnings.length === 0) return null

  const folderId = messageMailboxId(email, mailboxId, mailboxes)
  const folder = mailboxes.find(candidate => candidate.id === folderId) ?? null
  // Until the folders are known, their rights are not: nothing to click
  const canDismiss =
    hasMailboxes && mayOnEmail(email, 'maySetKeywords', mailboxes, folderId)
  const isInSpam = availableEmailActions([email], folder, mailboxes).some(
    item => item.id === 'not-spam'
  )

  const moveFocusAway = (dismissed: TwpWarning): HTMLElement | null => {
    const neighbour = neighbourOf(warnings, dismissed)
    const target =
      neighbour === null
        ? focusTargetAfterLast.current
        : (dismissButtons.current.get(neighbour.index) ?? null)
    target?.focus()
    return target
  }

  /** Back on the Dismiss button of a refused dismissal, unless the user moved on */
  const refocusRefused = (
    warning: TwpWarning,
    movedTo: HTMLElement | null
  ): void => {
    const focused = document.activeElement
    if (focused !== movedTo && focused !== document.body) return
    const button = dismissButtons.current.get(warning.index)
    if (button === undefined) refocusOnReturn.current = warning.index
    else button.focus()
  }

  const handleDismiss = (warning: TwpWarning): void => {
    const movedTo = moveFocusAway(warning)
    void run({
      action: 'setKeyword',
      keyword: twpDismissKeyword(warning.index),
      emails: [email],
      mailboxId: folderId,
      silent: true
    }).then(done => {
      if (done) return
      refocusRefused(warning, movedTo)
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
        const message = twpWarningMessage(warning.code, mismatch)
        return (
          <MessageAlert
            key={warning.index}
            className="u-mb-half"
            level={warning.level}
            levelLabel={t(`email.twpWarning.levels.${warning.level}`)}
            title={t(`email.twpWarning.titles.${warning.level}`)}
            description={
              message === null ? warning.text : t(message.key, message.options)
            }
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
                    disabled: !isOnline,
                    onClick: () => {
                      handleDismiss(warning)
                    },
                    'data-testid': `twp-warning-dismiss-${warning.index}`
                  }
                : undefined
            }
            dismissRef={(button: HTMLButtonElement | null) => {
              if (button === null) dismissButtons.current.delete(warning.index)
              else {
                dismissButtons.current.set(warning.index, button)
                if (refocusOnReturn.current === warning.index) {
                  refocusOnReturn.current = null
                  button.focus()
                }
              }
            }}
            data-testid={`twp-warning-${warning.index}`}
          />
        )
      })}
    </Box>
  )
}
