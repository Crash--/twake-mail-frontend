import {
  Attachment,
  Email as EmailIcon,
  EmailOpen,
  Icon,
  Star,
  StarOutline
} from '@linagora/twake-icons'
import {
  IconButton,
  Tooltip,
  Typography,
  type VirtualizedTableColumn,
  type VirtualizedTableRow
} from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { useHref, useNavigate } from 'react-router'

import { RowHoverActions } from '@/ds/RowHoverActions/RowHoverActions'
import { RowLink } from '@/ds/RowLink/RowLink'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { StatusDot } from '@/ds/StatusDot/StatusDot'
import { formatAddressNames } from '@common/features/email/addresses'
import { FLAGGED, hasKeyword, SEEN } from '@common/features/email/keywords'
import { useI18n } from '@common/i18n/useI18n'

import { formatFullDate, formatListDate } from './formatListDate'
import type { EmailListItemData } from './queries'

/** The columns of the email list, in their order */
export type EmailColumnId =
  'status' | 'sender' | 'subject' | 'attachment' | 'date' | 'actions'

/** The rows of the table are the emails themselves */
export function isEmailRow(
  row: VirtualizedTableRow | undefined
): row is VirtualizedTableRow & EmailListItemData {
  return (
    row !== undefined &&
    typeof row.id === 'string' &&
    typeof row.threadId === 'string' &&
    typeof row.receivedAt === 'string' &&
    typeof row.keywords === 'object' &&
    row.keywords !== null
  )
}

export function emailPath(mailboxId: string, emailId: string): string {
  return `/mailbox/${encodeURIComponent(mailboxId)}/email/${encodeURIComponent(emailId)}`
}

export interface EmailCellProps {
  mailboxId: string
  /** Shows the recipients instead of the sender (Sent, Drafts…) */
  showRecipients: boolean
  onToggleStar: (email: EmailListItemData) => void
  onToggleSeen: (email: EmailListItemData) => void
  /** Set by `VirtualizedTable` for each cell */
  row?: VirtualizedTableRow
  column?: VirtualizedTableColumn
}

/**
 * A cell of the email list, rendered according to its column: unread marker
 * and star, sender, subject and preview (the link opening the email, whose
 * name says it all), attachment, date, and the actions shown on hover.
 */
export function EmailCell({
  mailboxId,
  showRecipients,
  onToggleStar,
  onToggleSeen,
  row,
  column
}: EmailCellProps): ReactElement | null {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const path = isEmailRow(row) ? emailPath(mailboxId, row.id) : ''
  const href = useHref(path)

  if (!isEmailRow(row) || !column) return null
  const email = row
  const isUnread = !hasKeyword(email, SEEN)
  const isStarred = hasKeyword(email, FLAGGED)
  const emphasis = isUnread ? 'u-fw-bold' : ''
  const correspondents = formatAddressNames(
    showRecipients ? email.to : email.from
  )

  switch (column.id as EmailColumnId) {
    case 'status': {
      const starLabel = t(isStarred ? 'email.unstar' : 'email.star')
      const handleToggleStar = (): void => {
        onToggleStar(email)
      }
      return (
        <span className="u-flex u-flex-items-center">
          <span className="u-flex u-flex-justify-center u-flex-shrink-0 u-w-1">
            {isUnread ? (
              <StatusDot
                label={t('email.unread')}
                data-testid="unread-status-icon"
              />
            ) : null}
          </span>
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
        </span>
      )
    }
    case 'sender':
      return (
        <Typography noWrap data-testid="email-list-item-sender">
          <span className={emphasis}>{correspondents}</span>
        </Typography>
      )
    case 'subject': {
      // Read before the subject: what the other cells show to the eye
      const context = [
        isUnread ? t('email.unread') : null,
        isStarred ? t('email.starred') : null,
        correspondents
      ].filter(part => part !== null && part !== '')
      const handleNavigate = (): void => {
        void navigate(path)
      }
      return (
        <RowLink href={href} onNavigate={handleNavigate}>
          <span className="u-visuallyhidden">{`${context.join(', ')}, `}</span>
          <span className={emphasis} data-testid="email-list-item-subject">
            {email.subject ?? ''}
          </span>
          <SecondaryText
            className="u-ml-half"
            data-testid="email-list-item-preview"
          >
            {email.preview}
          </SecondaryText>
        </RowLink>
      )
    }
    case 'attachment':
      return email.hasAttachment ? (
        <Icon icon={Attachment} role="img" aria-label={t('email.attachment')} />
      ) : null
    case 'date':
      return (
        <SecondaryText
          variant="caption"
          noWrap
          data-testid="email-list-item-date"
        >
          <time
            className={emphasis}
            dateTime={email.receivedAt}
            title={formatFullDate(email.receivedAt, lang)}
          >
            {formatListDate(email.receivedAt, lang)}
          </time>
        </SecondaryText>
      )
    case 'actions': {
      const seenLabel = t(isUnread ? 'email.markAsRead' : 'email.markAsUnread')
      const handleToggleSeen = (): void => {
        onToggleSeen(email)
      }
      return (
        <RowHoverActions>
          <Tooltip title={seenLabel}>
            <IconButton
              size="small"
              aria-label={seenLabel}
              onClick={handleToggleSeen}
              data-testid="email-list-item-toggle-seen"
            >
              <Icon icon={isUnread ? EmailOpen : EmailIcon} />
            </IconButton>
          </Tooltip>
        </RowHoverActions>
      )
    }
    default:
      return null
  }
}
