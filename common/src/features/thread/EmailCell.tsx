import {
  Attachment,
  EmailNotification,
  EmailOpen,
  FolderMoveto,
  Icon,
  Openwith,
  Reply,
  Star,
  StarOutline,
  Trash,
  WarningCircle
} from '@linagora/twake-icons'
import {
  Tooltip,
  Typography,
  type VirtualizedTableColumn,
  type VirtualizedTableRow
} from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'
import { useHref, useNavigate } from 'react-router'

import {
  firstLetterOf,
  GradientAvatar
} from '@/ds/GradientAvatar/GradientAvatar'
import { IconAction } from '@/ds/IconAction/IconAction'
import { MoreVerticalIcon } from '@/ds/ListIcons/ListIcons'
import { MailboxTag } from '@/ds/MailboxTag/MailboxTag'
import { ForwardIcon } from '@/ds/ReplyIcons/ReplyIcons'
import { RowCheckbox } from '@/ds/RowCheckbox/RowCheckbox'
import { RowDate } from '@/ds/RowDate/RowDate'
import { RowHoverActions } from '@/ds/RowHoverActions/RowHoverActions'
import { RowLine } from '@/ds/RowLine/RowLine'
import { RowLink } from '@/ds/RowLink/RowLink'
import { RowSender } from '@/ds/RowSender/RowSender'
import { RowStateSlot } from '@/ds/RowStateSlot/RowStateSlot'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { StatusDot } from '@/ds/StatusDot/StatusDot'
import { useEmailViewReady } from '@common/features/email/useEmailViewReady'
import { prepareViewTransition } from '@/ds/ViewTransition/viewTransition'
import { formatAddressNames } from '@common/features/email/addresses'
import { isMarkedImportant } from '@common/features/email/importance'
import {
  ANSWERED,
  DRAFT,
  FLAGGED,
  FORWARDED,
  hasKeyword,
  NEEDS_ACTION,
  SEEN
} from '@common/features/email/keywords'
import { useI18n } from '@common/i18n/useI18n'

import { ActionRequiredTag } from '@common/features/ai/ActionRequiredTag'
import { LabelChips, labelsOfEmail } from '@common/features/labels/LabelChips'
import type { Label } from 'jmap-client-ts/linagora'
import { HighlightedText } from '@common/features/search/HighlightedText'

import type { ConversationOpenState } from './conversationTarget'
import { ACTION_SIZE } from './emailListGeometry'
import { formatFullDate, formatListDate } from './formatListDate'
import type { EmailListItemData, EmailSnippet } from './queries'
import type { ThreadSummary } from './threadSummary'
import { useEmailSelectionContext } from './useEmailSelection'

/** The attachment icon of a wide row (`steelGray200`) */
const ATTACHMENT_ICON_COLOR = '#AEB7C2'

/**
 * The columns of the email list, in their order, as tmail-flutter: `lead`
 * (selection, star, answered or forwarded, unread), `sender` (avatar and
 * name), `subject` and `trailing` (attachment and date, replaced by the
 * actions on hover) on a wide list; `select`, `unread`, `message`
 * (sender, date, subject, preview on four lines) and `compactActions` on a
 * narrow one (phone, list beside an open email)
 */
export type EmailColumnId =
  | 'lead'
  | 'select'
  | 'sender'
  | 'subject'
  | 'trailing'
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
  /** Asks for a folder, then moves the email (or its selection) there */
  onMove: (email: EmailListItemData) => void
  /** The email open beside the list, if any */
  openEmailId: string | null
  /** Opens a draft (`$draft`) in the composer instead of reading it */
  onOpenDraft?: (email: EmailListItemData) => void
  /** Opens a template in the composer (the emails of `templateMailboxIds`) */
  onOpenTemplate?: (email: EmailListItemData) => void
  /**
   * The Templates folders: an email filed in one is a template, wherever the
   * list comes from (a search finds them too); left out, every row is one
   */
  templateMailboxIds?: ReadonlySet<string>
  /**
   * Marks the emails their sender set important (the "Sender-set important
   * flag" preference of tmail-flutter, on by default)
   */
  showImportant?: boolean
  /** The labels of the account, shown on the emails that have them */
  labels?: readonly Label[]
  /**
   * Tags the emails with the `needs-action` keyword "Action required" (the
   * AI feature of tmail-flutter, on when the server offers it)
   */
  showActionRequired?: boolean
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
  onMove,
  openEmailId,
  onOpenDraft,
  onOpenTemplate: openTemplate,
  templateMailboxIds,
  showImportant = true,
  labels = [],
  showActionRequired = false,
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
  const isActionRequired = showActionRequired && hasKeyword(email, NEEDS_ACTION)
  const labelChips = (max: number): ReactElement | null =>
    emailLabels.length === 0 && !isActionRequired ? null : (
      <>
        {isActionRequired ? (
          <span className="u-flex-shrink-0 u-mr-half">
            <ActionRequiredTag maxLength={16} size="small" />
          </span>
        ) : null}
        <LabelChips
          labels={emailLabels}
          max={max}
          size="small"
          nowrap
          className="u-flex-shrink-0 u-mr-half"
        />
      </>
    )
  const emphasis = isUnread ? 'u-fw-bold' : ''
  // Its participants ("Alice, Bob, Me") rather than the last sender
  const correspondents =
    thread !== null && !showRecipients
      ? thread.participants.join(', ')
      : formatAddressNames(showRecipients ? email.to : email.from)

  // Decorative: the name of the sender is the text next to it. As
  // tmail-flutter: the first letter of the name on the gradient of the address
  const avatarAddress = (showRecipients ? email.to : email.from)?.[0] ?? null
  const avatarName = avatarAddress?.name ?? ''
  const avatarEmail = avatarAddress?.email ?? ''
  const avatar = (
    <GradientAvatar
      text={firstLetterOf(avatarName === '' ? avatarEmail : avatarName)}
      colorKey={avatarEmail}
      data-testid="email-list-item-avatar"
    />
  )
  // A toggle keeps its name: aria-pressed carries the state
  const starLabel = t('email.starred')
  const handleToggleStar = (): void => {
    onToggleStar(email)
  }
  const starButton = (
    <IconAction
      label={starLabel}
      icon={isStarred ? Star : StarOutline}
      tone={isStarred ? 'starred' : 'muted'}
      aria-pressed={isStarred}
      onClick={handleToggleStar}
      data-testid="email-list-item-star"
    />
  )
  // As tmail-flutter: the star of a wide row is a bare 20 px icon
  const wideStarButton = (
    <IconAction
      label={starLabel}
      icon={isStarred ? Star : StarOutline}
      tone={isStarred ? 'starred' : 'muted'}
      size={20}
      aria-pressed={isStarred}
      onClick={handleToggleStar}
      data-testid="email-list-item-star"
    />
  )
  const isDraft = hasKeyword(email, DRAFT)
  const onOpenTemplate =
    openTemplate !== undefined &&
    (templateMailboxIds === undefined ||
      Object.keys(email.mailboxIds).some(id => templateMailboxIds.has(id)))
      ? openTemplate
      : undefined
  // As tmail-flutter: whether the email was answered or forwarded, an icon
  // named by its tooltip in a slot kept empty otherwise
  const isAnswered = email.keywords[ANSWERED] === true
  const isForwarded = email.keywords[FORWARDED] === true
  const answeredLabel = isAnswered
    ? t(isForwarded ? 'email.repliedAndForwarded' : 'email.replied')
    : isForwarded
      ? t('email.forwardedState')
      : null
  const answeredState =
    answeredLabel === null ? null : (
      <Tooltip title={answeredLabel}>
        <span
          role="img"
          aria-label={answeredLabel}
          className="u-flex"
          data-testid="email-list-item-answered"
        >
          {isAnswered ? (
            <Icon icon={Reply} size={16} aria-hidden="true" />
          ) : (
            <ForwardIcon size={16} />
          )}
        </span>
      </Tooltip>
    )
  const seenLabel = t(isUnread ? 'email.markAsRead' : 'email.markAsUnread')
  const handleToggleSeen = (): void => {
    onToggleSeen(email)
  }
  const seenButton = (
    <IconAction
      label={seenLabel}
      icon={isUnread ? EmailOpen : EmailNotification}
      onClick={handleToggleSeen}
      tone="steel"
      iconSize={16}
      size={ACTION_SIZE}
      data-testid="email-list-item-toggle-seen"
    />
  )
  const openLabel = t('thread.row.openInNewTab')
  // The email in a tab of its own, beside the list: same route as the row
  const handleOpenInNewTab = (): void => {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
  const openButton =
    isDraft || onOpenTemplate ? null : (
      <IconAction
        label={openLabel}
        icon={Openwith}
        onClick={handleOpenInNewTab}
        tone="steel"
        iconSize={16}
        size={ACTION_SIZE}
        data-testid="email-list-item-open-in-new-tab"
      />
    )
  const moveLabel = t('emailActions.menu.moveMessage')
  const handleMove = (): void => {
    onMove(email)
  }
  const moveButton = (
    <IconAction
      label={moveLabel}
      icon={FolderMoveto}
      onClick={handleMove}
      tone="steel"
      iconSize={16}
      size={ACTION_SIZE}
      data-testid="email-list-item-move"
    />
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
    <IconAction
      label={removeLabel}
      icon={Trash}
      onClick={handleRemove}
      tone="steel"
      iconSize={16}
      size={ACTION_SIZE}
      data-testid="email-list-item-remove"
    />
  )
  const moreLabel = t('emailActions.menu.label')
  const handleOpenMenu = (event: MouseEvent<HTMLElement>): void => {
    onOpenMenu(email, event.currentTarget)
  }
  const moreButton = (
    <IconAction
      label={moreLabel}
      icon={MoreVerticalIcon}
      aria-haspopup="menu"
      onClick={handleOpenMenu}
      tone="steel"
      iconSize={16}
      size={ACTION_SIZE}
      data-testid="email-list-item-more"
    />
  )
  const isSelected = selection?.isSelected(email.id) ?? false
  const handleSelect = (event: MouseEvent<HTMLElement>): void => {
    selection?.toggle(email.id, event.shiftKey)
  }
  const checkbox =
    selection === null ? null : (
      <RowCheckbox
        checked={isSelected}
        onClick={handleSelect}
        label={t('thread.selection.select', { subject: email.subject ?? '' })}
        data-testid="email-list-item-checkbox"
      />
    )
  const unreadDot = isUnread ? (
    <StatusDot label={t('email.unread')} data-testid="unread-status-icon" />
  ) : null
  // The frame stays when the email is read: the names line up
  const framedDot = (
    <StatusDot
      label={isUnread ? t('email.unread') : null}
      framed
      data-testid="unread-status-icon"
    />
  )
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
  const wideDate = (
    <RowDate isStrong={isUnread} data-testid="email-list-item-date">
      <time
        dateTime={email.receivedAt}
        title={formatFullDate(email.receivedAt, lang)}
      >
        {formatListDate(email.receivedAt, lang)}
      </time>
    </RowDate>
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
  // As tmail-flutter: the folder of a search result in a pill
  const mailboxLabel =
    mailboxNames === null ? null : (
      <MailboxTag
        name={mailboxNames}
        label={t('search.inMailbox', { name: mailboxNames })}
        data-testid="email-list-item-mailbox"
      />
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

  // As tmail-flutter: 8 px after the folder, the date 8 px after it
  const wideAttachment = hasAttachment ? (
    <span className="u-flex u-flex-shrink-0 u-ml-half">
      {/* As tmail-flutter: 16 px, light steel grey */}
      <Icon
        icon={Attachment}
        size={16}
        color={ATTACHMENT_ICON_COLOR}
        role="img"
        aria-label={t('email.attachment')}
      />
    </span>
  ) : null

  switch (column.id as EmailColumnId) {
    case 'select':
      return <span className="u-flex u-flex-justify-center">{checkbox}</span>
    case 'lead':
      return (
        <span className="u-flex u-flex-items-center">
          {checkbox}
          {wideStarButton}
          <RowStateSlot>{answeredState}</RowStateSlot>
          <RowStateSlot>{framedDot}</RowStateSlot>
        </span>
      )
    case 'sender':
      return (
        // The names take the ellipsis, the number of messages stays in view
        <RowSender
          avatar={avatar}
          isStrong={isUnread}
          trailing={
            threadSize === null ? null : (
              <SecondaryText
                component="span"
                className="u-flex-shrink-0 u-ml-half"
                aria-hidden="true"
                data-testid="email-list-item-thread-count"
              >
                {`(${threadSize})`}
              </SecondaryText>
            )
          }
          data-testid="email-list-item-sender"
        >
          {correspondents}
        </RowSender>
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
            isStrong={isUnread}
            leading={
              importantIcon === null &&
              emailLabels.length === 0 &&
              !isActionRequired ? null : (
                <>
                  {importantIcon}
                  {labelChips(1)}
                </>
              )
            }
            primary={
              <span data-testid="email-list-item-subject">{subject}</span>
            }
            secondary={
              <span data-testid="email-list-item-preview">{preview}</span>
            }
          />
        </RowLink>
      )
    }
    case 'trailing':
      return (
        <RowHoverActions
          replaces={
            <>
              {/* As tmail-flutter: the folder right before the attachment */}
              {mailboxLabel}
              {wideAttachment}
              {wideDate}
            </>
          }
        >
          {/* As tmail-flutter: 16 px before the edge of the row */}
          <span className="u-flex u-flex-items-center u-pr-1">
            {openButton}
            {seenButton}
            {moveButton}
            {removeButton}
            {moreButton}
          </span>
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
            {mailboxLabel}
          </span>
          {/* As the design and tmail-flutter: the labels end the preview line */}
          <span className="u-flex u-flex-items-end">
            <SecondaryText
              variant="body2"
              lines={2}
              className="u-flex-auto"
              data-testid="email-list-item-preview"
            >
              {preview}
            </SecondaryText>
            <span className="u-flex u-ml-half u-flex-shrink-0">
              {labelChips(1)}
            </span>
          </span>
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
