import {
  Attachment,
  Dots,
  Email as EmailIcon,
  EmailOpen,
  Icon,
  Star,
  StarOutline,
  Trash
} from '@linagora/twake-icons'
import {
  Checkbox,
  IconButton,
  Tooltip,
  Typography,
  type VirtualizedTableColumn,
  type VirtualizedTableRow
} from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'
import { useHref, useNavigate } from 'react-router'

import { RowHoverActions } from '@/ds/RowHoverActions/RowHoverActions'
import { RowLink } from '@/ds/RowLink/RowLink'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { StatusDot } from '@/ds/StatusDot/StatusDot'
import { formatAddressNames } from '@common/features/email/addresses'
import { FLAGGED, hasKeyword, SEEN } from '@common/features/email/keywords'
import { useI18n } from '@common/i18n/useI18n'

import { HighlightedText } from '@common/features/search/HighlightedText'

import { formatFullDate, formatListDate } from './formatListDate'
import type { EmailListItemData, EmailSnippet } from './queries'
import { useEmailSelectionContext } from './useEmailSelection'

/**
 * The columns of the email list, in their order: one per field on a wide
 * list; `unread`, `message` (sender, date, subject, preview on four lines)
 * and `compactActions` on a narrow one (phone, list beside an open email);
 * `select` (the selection checkbox) on both
 */
export type EmailColumnId =
  | 'select'
  | 'status'
  | 'sender'
  | 'subject'
  | 'attachment'
  | 'date'
  | 'actions'
  | 'unread'
  | 'message'
  | 'compactActions'

/** A row of the table: an email, and its snippet in search results */
export type EmailRowData = EmailListItemData & {
  snippet: EmailSnippet | null
  /** Emails of its conversation, in a list of conversations */
  threadSize: number | null
}

/** The rows of the table are the emails themselves */
export function isEmailRow(
  row: VirtualizedTableRow | undefined
): row is VirtualizedTableRow & EmailRowData {
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
  /** Path of the email of a row, opened by its link */
  getEmailPath: (emailId: string) => string
  /** Names of the mailboxes of an email, shown in search results */
  getMailboxNames?: (email: EmailListItemData) => string | null
  /** Shows the recipients instead of the sender (Sent, Drafts…) */
  showRecipients: boolean
  onToggleStar: (email: EmailListItemData) => void
  onToggleSeen: (email: EmailListItemData) => void
  /** To the Trash, or deleted forever (after a confirmation) */
  onRemove: (email: EmailListItemData) => void
  /** Whether removing deletes forever (Trash, Spam, Drafts) */
  deletesForever: boolean
  /** Opens the actions menu of the email under `element` */
  onOpenMenu: (email: EmailListItemData, element: HTMLElement) => void
  /** The email open beside the list, if any */
  openEmailId: string | null
  /** Set by `VirtualizedTable` for each cell */
  row?: VirtualizedTableRow
  column?: VirtualizedTableColumn
}

/**
 * A cell of the email list, rendered according to its column: unread marker
 * and star, sender, subject and preview (the link opening the email, whose
 * name says it all), attachment, date, and the actions shown on hover. The
 * compact columns gather the same content: the link holds the marker, the
 * sender, the date, the subject and two lines of preview; the star and the
 * read toggle are stacked beside it.
 */
export function EmailCell({
  getEmailPath,
  getMailboxNames,
  showRecipients,
  onToggleStar,
  onToggleSeen,
  onRemove,
  deletesForever,
  onOpenMenu,
  openEmailId,
  row,
  column
}: EmailCellProps): ReactElement | null {
  const { t, lang } = useI18n()
  const selection = useEmailSelectionContext()
  const navigate = useNavigate()
  const path = isEmailRow(row) ? getEmailPath(row.id) : ''
  const href = useHref(path)

  if (!isEmailRow(row) || !column) return null
  const email = row
  const isUnread = !hasKeyword(email, SEEN)
  const isStarred = hasKeyword(email, FLAGGED)
  const emphasis = isUnread ? 'u-fw-bold' : ''
  const correspondents = formatAddressNames(
    showRecipients ? email.to : email.from
  )

  const starLabel = t(isStarred ? 'email.unstar' : 'email.star')
  const handleToggleStar = (): void => {
    onToggleStar(email)
  }
  const starButton = (
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
  )
  const seenLabel = t(isUnread ? 'email.markAsRead' : 'email.markAsUnread')
  const handleToggleSeen = (): void => {
    onToggleSeen(email)
  }
  const seenButton = (
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
  )
  const removeLabel = t(
    deletesForever
      ? 'emailActions.menu.deletePermanently'
      : 'emailActions.menu.moveToTrash'
  )
  const handleRemove = (): void => {
    onRemove(email)
  }
  const removeButton = (
    <Tooltip title={removeLabel}>
      <IconButton
        size="small"
        aria-label={removeLabel}
        onClick={handleRemove}
        data-testid="email-list-item-remove"
      >
        <Icon icon={Trash} />
      </IconButton>
    </Tooltip>
  )
  const moreLabel = t('emailActions.menu.label')
  const handleOpenMenu = (event: MouseEvent<HTMLButtonElement>): void => {
    onOpenMenu(email, event.currentTarget)
  }
  const moreButton = (
    <Tooltip title={moreLabel}>
      <IconButton
        size="small"
        aria-label={moreLabel}
        aria-haspopup="menu"
        onClick={handleOpenMenu}
        data-testid="email-list-item-more"
      >
        <Icon icon={Dots} />
      </IconButton>
    </Tooltip>
  )
  const isSelected = selection?.isSelected(email.id) ?? false
  const handleSelect = (event: MouseEvent<HTMLButtonElement>): void => {
    selection?.toggle(email.id, event.shiftKey)
  }
  const checkbox =
    selection === null ? null : (
      <Checkbox
        size="small"
        checked={isSelected}
        onClick={handleSelect}
        slotProps={{
          input: {
            'aria-label': t('thread.selection.select', {
              subject: email.subject ?? ''
            })
          }
        }}
        data-testid="email-list-item-checkbox"
      />
    )
  const unreadDot = isUnread ? (
    <StatusDot label={t('email.unread')} data-testid="unread-status-icon" />
  ) : null
  const handleNavigate = (): void => {
    void navigate(path)
  }
  const date = (
    <SecondaryText variant="caption" noWrap data-testid="email-list-item-date">
      <time
        className={emphasis}
        dateTime={email.receivedAt}
        title={formatFullDate(email.receivedAt, lang)}
      >
        {formatListDate(email.receivedAt, lang)}
      </time>
    </SecondaryText>
  )
  const subject = (
    <HighlightedText
      text={email.subject ?? ''}
      snippet={email.snippet?.subject ?? null}
    />
  )
  const preview = (
    <HighlightedText
      text={email.preview}
      snippet={email.snippet?.preview ?? null}
    />
  )
  const mailboxNames = getMailboxNames?.(email) ?? null
  const threadSize =
    email.threadSize !== null && email.threadSize > 1 ? email.threadSize : null
  const threadCount =
    threadSize === null ? null : (
      <SecondaryText
        component="span"
        className="u-flex-shrink-0 u-ml-half"
        data-testid="email-list-item-thread-count"
      >
        <span aria-hidden="true">{threadSize}</span>
        <span className="u-visuallyhidden">
          {t('thread.messageCount', { smart_count: threadSize })}
        </span>
      </SecondaryText>
    )
  const mailboxLabel =
    mailboxNames === null ? null : (
      <SecondaryText
        variant="caption"
        noWrap
        className="u-flex-shrink-0 u-ml-half"
        data-testid="email-list-item-mailbox"
      >
        {t('search.inMailbox', { name: mailboxNames })}
      </SecondaryText>
    )
  const attachmentIcon = email.hasAttachment ? (
    <Icon icon={Attachment} role="img" aria-label={t('email.attachment')} />
  ) : null

  switch (column.id as EmailColumnId) {
    case 'select':
      return <span className="u-flex u-flex-justify-center">{checkbox}</span>
    case 'status':
      return (
        <span className="u-flex u-flex-items-center">
          <span className="u-flex u-flex-justify-center u-flex-shrink-0 u-w-1">
            {unreadDot}
          </span>
          {starButton}
        </span>
      )
    case 'sender':
      return (
        <Typography noWrap data-testid="email-list-item-sender">
          <span className={emphasis}>{correspondents}</span>
          {threadSize === null ? null : (
            <SecondaryText
              component="span"
              className="u-ml-half"
              aria-hidden="true"
              data-testid="email-list-item-thread-count"
            >
              {threadSize}
            </SecondaryText>
          )}
        </Typography>
      )
    case 'subject': {
      // Read before the subject: what the other cells show to the eye
      const context = [
        isUnread ? t('email.unread') : null,
        isStarred ? t('email.starred') : null,
        correspondents,
        threadSize === null
          ? null
          : t('thread.messageCount', { smart_count: threadSize })
      ].filter(part => part !== null && part !== '')
      return (
        <RowLink
          href={href}
          onNavigate={handleNavigate}
          current={email.id === openEmailId}
        >
          <span className="u-visuallyhidden">{`${context.join(', ')}, `}</span>
          <span className={emphasis} data-testid="email-list-item-subject">
            {subject}
          </span>
          <SecondaryText
            className="u-ml-half"
            data-testid="email-list-item-preview"
          >
            {preview}
          </SecondaryText>
          {mailboxLabel}
        </RowLink>
      )
    }
    case 'attachment':
      return attachmentIcon
    case 'date':
      return date
    case 'actions':
      return (
        <RowHoverActions>
          {seenButton}
          {removeButton}
          {moreButton}
        </RowHoverActions>
      )
    case 'unread':
      return <span className="u-flex u-flex-justify-center">{unreadDot}</span>
    case 'message': {
      // Read before the content of the link: what the other cells show
      const states = [
        isUnread ? t('email.unread') : null,
        isStarred ? t('email.starred') : null
      ].filter(state => state !== null)
      return (
        <RowLink
          href={href}
          onNavigate={handleNavigate}
          current={email.id === openEmailId}
          multiline
        >
          {states.length > 0 ? (
            <span className="u-visuallyhidden">{`${states.join(', ')}, `}</span>
          ) : null}
          <span className="u-flex u-flex-items-center">
            <Typography
              component="span"
              noWrap
              className="u-db u-flex-auto"
              data-testid="email-list-item-sender"
            >
              <span className={emphasis}>{correspondents}</span>
            </Typography>
            {threadCount}
            {attachmentIcon === null ? null : (
              <span className="u-flex u-flex-shrink-0 u-ml-half">
                {attachmentIcon}
              </span>
            )}
            <span className="u-flex-shrink-0 u-ml-half">{date}</span>
          </span>
          <span className="u-flex u-flex-items-center">
            <Typography component="span" noWrap className="u-db u-flex-auto">
              <span className={emphasis} data-testid="email-list-item-subject">
                {subject}
              </span>
            </Typography>
            {mailboxLabel}
          </span>
          <SecondaryText
            variant="body2"
            lines={2}
            data-testid="email-list-item-preview"
          >
            {preview}
          </SecondaryText>
        </RowLink>
      )
    }
    case 'compactActions':
      return (
        // The other actions: from the selection toolbar, or a long press
        // (the context menu of the row)
        <span className="u-flex u-flex-column u-flex-items-center">
          {starButton}
          <RowHoverActions>{seenButton}</RowHoverActions>
        </span>
      )
    default:
      return null
  }
}
