import {
  Attachment,
  CircleFilled,
  Icon,
  Star,
  StarOutline
} from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  ListItemButton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { formatAddressNames } from '@common/features/email/addresses'
import { FLAGGED, hasKeyword, SEEN } from '@common/features/email/keywords'
import { useI18n } from '@common/i18n/useI18n'

import { formatFullDate, formatListDate } from './formatListDate'
import type { EmailListItemData } from './queries'

export interface EmailListItemProps {
  email: EmailListItemData
  mailboxId: string
  /** Shows the recipients instead of the sender (Sent, Drafts…) */
  showRecipients: boolean
  onToggleStar: (email: EmailListItemData) => void
}

/**
 * A row of the email list: unread marker, sender, subject and preview,
 * date, star. Opens the email on click.
 */
export function EmailListItem({
  email,
  mailboxId,
  showRecipients,
  onToggleStar
}: EmailListItemProps): ReactElement {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const isUnread = !hasKeyword(email, SEEN)
  const isStarred = hasKeyword(email, FLAGGED)
  const emphasis = isUnread ? 'u-fw-bold' : ''
  const starLabel = t(isStarred ? 'email.unstar' : 'email.star')

  const handleOpen = (): void => {
    void navigate(
      `/mailbox/${encodeURIComponent(mailboxId)}/email/${encodeURIComponent(email.id)}`
    )
  }

  const handleToggleStar = (): void => {
    onToggleStar(email)
  }

  return (
    <Box
      role="listitem"
      className="u-flex u-flex-items-center u-pr-half"
      data-testid="email-list-item"
      data-email-id={email.id}
      data-thread-id={email.threadId}
      data-unread={isUnread ? 'true' : undefined}
    >
      <ListItemButton
        onClick={handleOpen}
        className="u-flex-auto u-ov-hidden"
        gutters="disabled"
      >
        <Typography
          component="span"
          color="primary"
          className="u-flex u-flex-items-center u-flex-justify-center u-flex-shrink-0 u-w-2"
        >
          {isUnread ? (
            <Icon
              icon={CircleFilled}
              size={8}
              role="img"
              aria-label={t('email.unread')}
              data-testid="unread-status-icon"
            />
          ) : null}
        </Typography>
        <Typography
          noWrap
          className="u-w-5 u-flex-shrink-0 u-pr-1"
          data-testid="email-list-item-sender"
        >
          <span className={emphasis}>
            {formatAddressNames(showRecipients ? email.to : email.from)}
          </span>
        </Typography>
        <Typography noWrap component="div" className="u-flex-auto">
          <span className={emphasis} data-testid="email-list-item-subject">
            {email.subject ?? ''}
          </span>
          <Typography
            component="span"
            color="textSecondary"
            className="u-ml-half"
            data-testid="email-list-item-preview"
          >
            {email.preview}
          </Typography>
        </Typography>
        {email.hasAttachment ? (
          <Icon
            icon={Attachment}
            className="u-ml-half u-flex-shrink-0"
            role="img"
            aria-label={t('email.attachment')}
          />
        ) : null}
        <Typography
          variant="caption"
          color="textSecondary"
          className="u-ml-1 u-flex-shrink-0"
          data-testid="email-list-item-date"
        >
          <time
            className={emphasis}
            dateTime={email.receivedAt}
            title={formatFullDate(email.receivedAt, lang)}
          >
            {formatListDate(email.receivedAt, lang)}
          </time>
        </Typography>
      </ListItemButton>
      <Tooltip title={starLabel}>
        <IconButton
          size="small"
          color={isStarred ? 'warning' : 'default'}
          aria-label={starLabel}
          aria-pressed={isStarred}
          onClick={handleToggleStar}
          data-testid="email-list-item-star"
        >
          <Icon icon={isStarred ? Star : StarOutline} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
