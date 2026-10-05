import { Cross, Icon } from '@linagora/twake-icons'
import { Alert, Button, IconButton } from '@linagora/twake-mui'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import {
  isSpamReportIntervalElapsed,
  useSpamReportPreference
} from '@common/features/settings/spamReportPreference'
import { useI18n } from '@common/i18n/useI18n'

export interface SpamReportBannerProps {
  /** The folder the list shows, null from search results */
  mailbox: MailboxSummary | null
}

/**
 * Above the lists, the unread emails of Spam, as tmail-flutter's spam
 * report: not in Spam itself, not within 24 hours of its dismissal or of
 * the view of Spam, and unless turned off in Settings > Preferences.
 * "View" opens Spam; closing it hides it for 24 hours.
 */
export function SpamReportBanner({
  mailbox
}: SpamReportBannerProps): ReactElement | null {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { data: mailboxes = [] } = useMailboxes()
  const { isEnabled, lastDismissedAt, dismiss } = useSpamReportPreference()
  // When the list showed: the delay is checked then, as at a refresh in tmail-flutter
  const [now] = useState(() => Date.now())
  const spam = mailboxes.find(candidate => candidate.role === 'junk') ?? null
  const unread = spam?.unreadEmails ?? 0
  const isShown =
    isEnabled &&
    spam !== null &&
    spam.id !== mailbox?.id &&
    unread > 0 &&
    isSpamReportIntervalElapsed(lastDismissedAt, now)

  // All read (in Spam, elsewhere) while the banner shows: nothing to remind
  // for 24 hours, as tmail-flutter
  const wasShownRef = useRef(false)
  useEffect(() => {
    if (wasShownRef.current && isEnabled && spam !== null && unread === 0) {
      dismiss()
    }
    wasShownRef.current = isShown
  }, [isShown, isEnabled, spam, unread, dismiss])

  if (!isShown) return null

  const handleView = (): void => {
    dismiss()
    void navigate(`/mailbox/${encodeURIComponent(spam.id)}`)
  }

  return (
    <Alert
      severity="info"
      // A live region: the banner comes when the mail arrives
      role="status"
      className="u-m-half"
      action={
        <>
          <Button
            color="inherit"
            size="small"
            onClick={handleView}
            data-testid="spam-report-banner-view"
          >
            {t('spamReport.view')}
          </Button>
          <IconButton
            color="inherit"
            size="small"
            aria-label={t('spamReport.dismiss')}
            onClick={dismiss}
            data-testid="spam-report-banner-dismiss"
          >
            <Icon icon={Cross} size={16} aria-hidden="true" />
          </IconButton>
        </>
      }
      data-testid="spam-report-banner"
    >
      {t('spamReport.banner', { smart_count: unread })}
    </Alert>
  )
}
