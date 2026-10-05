import {
  Attachment,
  Dots,
  Email as EmailIcon,
  EmailOpen,
  Icon,
  Star,
  StarOutline,
  Trash,
  WarningCircle
} from '@linagora/twake-icons'
import {
  Avatar,
  Checkbox,
  getInitials,
  IconButton,
  Tooltip,
  Typography,
  type VirtualizedTableColumn,
  type VirtualizedTableRow
} from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'
import { useHref, useNavigate } from 'react-router'

import { RowHoverActions } from '@/ds/RowHoverActions/RowHoverActions'
import { RowLine } from '@/ds/RowLine/RowLine'
import { RowLink } from '@/ds/RowLink/RowLink'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { StatusDot } from '@/ds/StatusDot/StatusDot'
import { useEmailViewReady } from '@common/features/email/useEmailViewReady'
import { prepareViewTransition } from '@/ds/ViewTransition/viewTransition'
import { formatAddressNames } from '@common/features/email/addresses'
import { isMarkedImportant } from '@common/features/email/importance'
import {
  DRAFT,
  FLAGGED,
  hasKeyword,
  SEEN
} from '@common/features/email/keywords'
import { useI18n } from '@common/i18n/useI18n'

import { LabelChips, labelsOfEmail } from '@common/features/labels/LabelChips'
import type { Label } from 'jmap-client-ts/linagora'
import { HighlightedText } from '@common/features/search/HighlightedText'

import type { ConversationOpenState } from './conversationTarget'
import { formatFullDate, formatListDate } from './formatListDate'
import type { EmailListItemData, EmailSnippet } from './queries'
import type { ThreadSummary } from './threadSummary'
import { useEmailSelectionContext } from './useEmailSelection'

/**
 * The columns of the email list, in their order: one per field on a wide
 * list (the actions share the cell of the date); `unread`, `message` (sender, date, subject, preview on four lines)
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
  | 'unread'
  | 'message'
  | 'compactActions'

/**
 * A row of the table: an email, its snippet in search results, and in a
 * list of conversations the summary of the conversation it stands for
 */
export type EmailRowData = EmailListItemData & {
  snippet: EmailSnippet | null
  thread: ThreadSummary | null
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
  /**
   * Navigation state of the link: a conversation opened from a list opens
   * on its first unread message
   */
  openState?: ConversationOpenState
  /** Names of the mailboxes of an email, shown in search results */
  getMailboxNames?: (email: EmailListItemData) => string | null
  /** Shows the recipients instead of the sender (Sent, Drafts…) */
  showRecipients: boolean
  /** On a conversation, these act on all its emails */
  onToggleStar: (email: EmailRowData) => void
  onToggleSeen: (email: EmailRowData) => void
  /** To the Trash, or deleted forever (after a confirmation) */
  onRemove: (email: EmailListItemData) => void
  /** Whether removing deletes forever (Trash, Spam, Drafts) */
  deletesForever: boolean
  /** Opens the actions menu of the email under `element` */
  onOpenMenu: (email: EmailListItemData, element: HTMLElement) => void
  /** The email open beside the list, if any */
  openEmailId: string | null
  /** Opens a draft (`$draft`) in the composer instead of reading it */
  onOpenDraft?: (email: EmailListItemData) => void
  /** In the Templates folder: opens the template in the composer */
  onOpenTemplate?: (email: EmailListItemData) => void
  /**
   * Marks the emails their sender set important (the "Sender-set important
   * flag" preference of tmail-flutter, on by default)
   */
  showImportant?: boolean
  /** The labels of the account, shown on the emails that have them */
  labels?: readonly Label[]
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
  openState,
  getMailboxNames,
  showRecipients,
  onToggleStar,
  onToggleSeen,
  onRemove,
  deletesForever,
  onOpenMenu,
  openEmailId,
  onOpenDraft,
  onOpenTemplate,
  showImportant = true,
  labels = [],
  row,
  column
}: EmailCellProps): ReactElement | null {
  const { t, lang } = useI18n()
  const selection = useEmailSelectionContext()
  const navigate = useNavigate()
  const ensureEmailViewReady = useEmailViewReady()
  const path = isEmailRow(row) ? getEmailPath(row.id) : ''
  const href = useHref(path)

  if (!isEmailRow(row) || !column) return null
  const email = row
  const { thread } = email
  // A conversation takes the state of all its emails
  const isUnread = thread?.isUnread ?? !hasKeyword(email, SEEN)
  const isStarred = thread?.isStarred ?? hasKeyword(email, FLAGGED)
  const hasAttachment = thread?.hasAttachment ?? email.hasAttachment
  const isImportant = showImportant && isMarkedImportant(email)
  // As tmail-flutter: a conversation row shows the labels of the email that
  // represents it. To show the union of its emails (issue #110), pass
  // `thread.members` here instead of `email`.
  const emailLabels = labelsOfEmail(labels, email)
  const labelChips = (max: number): ReactElement | null =>
    emailLabels.length === 0 ? null : (
      <LabelChips
        labels={emailLabels}
        max={max}
        nowrap
        className="u-flex-shrink-0 u-mr-half"
      />
    )
  const emphasis = isUnread ? 'u-fw-bold' : ''
  // Its participants ("Alice, Bob, Me") rather than the last sender
  const correspondents =
    thread !== null && !showRecipients
      ? thread.participants.join(', ')
      : formatAddressNames(showRecipients ? email.to : email.from)

  // Decorative: the name of the sender is the text next to it
  const avatarAddress = (showRecipients ? email.to : email.from)?.[0] ?? null
  const avatar = (
    <Avatar
      component="span"
      size={20}
      aria-hidden="true"
      className="u-mr-half u-flex-shrink-0"
      data-testid="email-list-item-avatar"
    >
      {getInitials(avatarAddress?.name ?? '', avatarAddress?.email ?? '')}
    </Avatar>
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
    if (onOpenTemplate) {
      onOpenTemplate(email)
      return
    }
    if (onOpenDraft && hasKeyword(email, DRAFT)) {
      onOpenDraft(email)
      return
    }
    // The transition ends on the email, not on its skeleton
    void ensureEmailViewReady(email.id, email.threadId).then(isReady => {
      void navigate(path, {
        state: openState,
        viewTransition: isReady && prepareViewTransition('forward')
      })
    })
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
  const threadSize = thread !== null && thread.count > 1 ? thread.count : null
  const threadCount =
    threadSize === null ? null : (
      <SecondaryText
        component="span"
        className="u-flex-shrink-0 u-ml-half"
        data-testid="email-list-item-thread-count"
      >
        <span aria-hidden="true">{`(${threadSize})`}</span>
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
  // Said in the name of the row link: the icon shows it to the eye
  const importantIcon = isImportant ? (
    <Icon
      icon={WarningCircle}
      aria-hidden="true"
      className="u-mr-half u-flex-shrink-0"
      data-testid="important-flag-icon"
    />
  ) : null
  const attachmentIcon = hasAttachment ? (
    <Icon icon={Attachment} role="img" aria-label={t('email.attachment')} />
  ) : null

  switch (column.id as EmailColumnId) {
    case 'select':
      return <span className="u-flex u-flex-justify-center">{checkbox}</span>
    case 'status':
      return (
        <span className="u-flex u-flex-items-center">
          {starButton}
          <span className="u-flex u-flex-justify-center u-flex-shrink-0 u-w-1">
            {unreadDot}
          </span>
        </span>
      )
    case 'sender':
      return (
        // The names take the ellipsis, the number of messages stays in view
        <span className="u-flex u-flex-items-center">
          {avatar}
          <Typography
            component="span"
            noWrap
            className="u-db"
            data-testid="email-list-item-sender"
          >
            <span className={emphasis}>{correspondents}</span>
          </Typography>
          {threadSize === null ? null : (
            <SecondaryText
              component="span"
              className="u-flex-shrink-0 u-ml-half"
              aria-hidden="true"
              data-testid="email-list-item-thread-count"
            >
              {`(${threadSize})`}
            </SecondaryText>
          )}
        </span>
      )
    case 'subject': {
      // Read before the subject: what the other cells show to the eye
      const context = [
        isUnread ? t('email.unread') : null,
        isStarred ? t('email.starred') : null,
        isImportant ? t('email.important') : null,
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
          <RowLine
            leading={
              <>
                {importantIcon}
                {labelChips(1)}
              </>
            }
            primary={
              <span className={emphasis} data-testid="email-list-item-subject">
                {subject}
              </span>
            }
            secondary={
              <SecondaryText data-testid="email-list-item-preview">
                {preview}
              </SecondaryText>
            }
            trailing={mailboxLabel}
          />
        </RowLink>
      )
    }
    case 'attachment':
      return attachmentIcon
    case 'date':
      return (
        <RowHoverActions replaces={date}>
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
        isStarred ? t('email.starred') : null,
        isImportant ? t('email.important') : null
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
            {importantIcon}
            <Typography component="span" noWrap className="u-db u-flex-auto">
              <span className={emphasis} data-testid="email-list-item-subject">
                {subject}
              </span>
            </Typography>
            <span className="u-ml-half u-flex">{labelChips(1)}</span>
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
