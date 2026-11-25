import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { NoticeBanner } from '@/ds/NoticeBanner/NoticeBanner'
import { useFocusFallback } from '@/ds/useFocusFallback/useFocusFallback'
import { useFolderActions } from '@common/features/mailboxActions/FolderActionsProvider'
import {
  findTeamFolderId,
  isPersonalMailbox,
  isTeamMailbox
} from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import {
  isSpamReportIntervalElapsed,
  useSpamReportPreference
} from '@common/features/settings/spamReportPreference'
import { useI18n } from '@common/i18n/useI18n'

/** The names a Spam folder of a team mailbox goes by: it has no role */
const TEAM_SPAM_NAMES: readonly string[] = ['spam', 'junk']

/**
 * The Spam of the account the list shows: the user's own for a personal
 * folder or a search, the one of the team mailbox for a team folder (none by
 * default: James creates no Spam there), none for a folder shared by another
 * user, whose Spam the user does not see
 */
function findSpamOfAccount(
  mailboxes: readonly MailboxSummary[],
  mailbox: MailboxSummary | null
): MailboxSummary | null {
  if (mailbox === null || isPersonalMailbox(mailbox)) {
    return (
      mailboxes.find(
        candidate => isPersonalMailbox(candidate) && candidate.role === 'junk'
      ) ?? null
    )
  }
  if (!isTeamMailbox(mailbox)) return null
  const spamId =
    TEAM_SPAM_NAMES.map(name =>
      findTeamFolderId(mailboxes, mailbox.id, name)
    ).find(id => id !== null) ?? null
  return mailboxes.find(candidate => candidate.id === spamId) ?? null
}

export interface SpamReportBannerProps {
  /** The folder the list shows, null from search results */
  mailbox: MailboxSummary | null
}

/**
 * Above the lists, the unread emails of the Spam of the account they show, as tmail-flutter's spam
 * report: not in Spam itself, not within 24 hours of its dismissal, of
 * the view of Spam or of its last display (it stays until the list is
 * left), and unless turned off in Settings > Preferences.
 * "View" opens Spam; closing it hides it for 24 hours and marks Spam as read.
 */
export function SpamReportBanner({
  mailbox
}: SpamReportBannerProps): ReactElement | null {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { data: mailboxes = [] } = useMailboxes()
  const folderActions = useFolderActions()
  const { isEnabled, lastDismissedAt, lastShownAt, dismiss, markShown } =
    useSpamReportPreference()
  const focusFallbackRef = useFocusFallback<HTMLDivElement>()
  // When the list showed: the delay is checked then, as at a refresh in tmail-flutter
  const [now] = useState(() => Date.now())
  // Shown at most once a day: a display recorded by this very banner keeps it
  const [isDueSinceLastShown] = useState(() =>
    isSpamReportIntervalElapsed(lastShownAt, now)
  )
  const spam = findSpamOfAccount(mailboxes, mailbox)
  const unread = spam?.unreadEmails ?? 0
  const isShown =
    isEnabled &&
    spam !== null &&
    spam.id !== mailbox?.id &&
    unread > 0 &&
    isDueSinceLastShown &&
    isSpamReportIntervalElapsed(lastDismissedAt, now)

  const isShownRecordedRef = useRef(false)
  useEffect(() => {
    if (isShown && !isShownRecordedRef.current) {
      isShownRecordedRef.current = true
      markShown()
    }
  }, [isShown, markShown])

  // All read (in Spam, elsewhere) while the banner shows: nothing to remind
  // for 24 hours, as tmail-flutter. The Spam of another account (the list
  // moved to a team mailbox) read already is no such reading.
  const spamId = spam?.id ?? null
  const shownSpamIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (
      shownSpamIdRef.current !== null &&
      shownSpamIdRef.current === spamId &&
      isEnabled &&
      unread === 0
    ) {
      dismiss()
    }
    shownSpamIdRef.current = isShown ? spamId : null
  }, [isShown, isEnabled, spamId, unread, dismiss])

  if (!isShown) return null

  // As tmail-flutter: the close button also marks Spam as read
  const handleClose = (): void => {
    dismiss()
    if (spam.myRights.maySetSeen) folderActions.run('mark-as-read', spam)
  }

  const handleView = (): void => {
    dismiss()
    void navigate(`/mailbox/${encodeURIComponent(spam.id)}`)
  }

  return (
    <NoticeBanner
      ref={focusFallbackRef}
      // A live region: the banner comes when the mail arrives
      role="status"
      className="u-m-half"
      actions={[
        {
          label: t('spamReport.view'),
          onClick: handleView,
          'data-testid': 'spam-report-banner-view'
        }
      ]}
      dismiss={{
        label: t('spamReport.dismiss'),
        onClick: handleClose,
        'data-testid': 'spam-report-banner-dismiss'
      }}
      data-testid="spam-report-banner"
    >
      {t('spamReport.banner', { smart_count: unread })}
    </NoticeBanner>
  )
}
