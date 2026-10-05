import {
  Avatar,
  Box,
  getInitials,
  ListSkeleton,
  Typography
} from '@linagora/twake-mui'
import { useRef, type ReactElement } from 'react'

import { MessageHeader } from '@/ds/MessageHeader/MessageHeader'
import { MessageThreadItem } from '@/ds/MessageThread/MessageThreadItem'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { StatusDot } from '@/ds/StatusDot/StatusDot'
import { WarningAvatarBadge } from '@/ds/WarningAvatarBadge/WarningAvatarBadge'
import { AddressLine } from '@common/features/email/AddressLine'
import { formatAddressName } from '@common/features/email/addresses'
import { EmailMessageBody } from '@common/features/email/EmailMessageBody'
import { EmailViewActions } from '@common/features/email/EmailViewActions'
import { isMarkedImportant } from '@common/features/email/importance'
import { ImportantMark } from '@common/features/email/ImportantMark'
import { DRAFT, hasKeyword, SEEN } from '@common/features/email/keywords'
import { messageMailboxId } from '@common/features/email/messageMailbox'
import type { EmailDetail } from '@common/features/email/queries'
import { ReplyActions } from '@common/features/email/ReplyActions'
import { SenderLine } from '@common/features/email/SenderLine'
import {
  TwpWarningBanners,
  useVisibleTwpWarnings
} from '@common/features/email/TwpWarningBanners'
import { hasDangerWarning } from '@common/features/email/twpWarnings'
import { useEmail } from '@common/features/email/useEmail'
import { useReadReceiptRequest } from '@common/features/email/useReadReceiptRequest'
import { useUnsubscribe } from '@common/features/email/useUnsubscribe'
import type { EmailActionId } from '@common/features/emailActions/emailActionItems'
import { EmailActionRequiredTag } from '@common/features/ai/EmailActionRequiredTag'
import { EmailLabels } from '@common/features/labels/EmailLabels'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useShowsSenderPriority } from '@common/features/settings/serverSettings'
import { useI18n } from '@common/i18n/useI18n'

import { ConversationDraftActions } from './ConversationDraftActions'
import { formatFullDate, formatListDate } from './formatListDate'
import type { EmailListItemData } from './queries'
import { useRevealOnOpen } from './useRevealOnOpen'

function DetailAvatar({
  detail,
  initials
}: {
  detail: EmailDetail
  initials: string
}): ReactElement {
  const { t } = useI18n()
  const isDangerous = hasDangerWarning(useVisibleTwpWarnings(detail))
  return isDangerous ? (
    <WarningAvatarBadge
      size="s"
      label={t('email.twpWarning.dangerousMessage')}
      data-testid="conversation-message-danger-badge"
    />
  ) : (
    <Avatar component="span" size="s" aria-hidden="true">
      {initials}
    </Avatar>
  )
}

function ExpandedAvatar({
  emailId,
  initials
}: {
  emailId: string
  initials: string
}): ReactElement {
  const query = useEmail(emailId)
  return query.data ? (
    <DetailAvatar detail={query.data} initials={initials} />
  ) : (
    <Avatar component="span" size="s" aria-hidden="true">
      {initials}
    </Avatar>
  )
}

interface ExpandedBodyProps {
  detail: EmailDetail
  /** The folder the conversation is open from, null from search results */
  openedMailboxId: string | null
  onAction: (id: EmailActionId) => void
  onRemoteContentShown: () => void
}

/**
 * The content of an expanded message: its actions, sender (with the
 * address menu), recipients, labels, body and answers, as the single email
 * view has them, applying to this message only
 */
function ExpandedBody({
  detail,
  openedMailboxId,
  onAction,
  onRemoteContentShown
}: ExpandedBodyProps): ReactElement {
  const { t, lang } = useI18n()
  useReadReceiptRequest(detail)
  const { canUnsubscribe, unsubscribe } = useUnsubscribe()
  const { data: mailboxes = [] } = useMailboxes()
  const mailboxId = messageMailboxId(detail, openedMailboxId, mailboxes)
  const sender = detail.from?.[0] ?? null
  // A draft is not read but written: the composer edits it
  const isDraft = hasKeyword(detail, DRAFT)
  return (
    <>
      <Box className="u-flex u-flex-items-center u-flex-wrap">
        <SenderLine
          sender={sender}
          hasLabel
          onUnsubscribe={
            canUnsubscribe(detail)
              ? () => {
                  void unsubscribe(detail, mailboxId)
                }
              : null
          }
          data-testid="conversation-message-sender"
        />
        {isDraft ? null : (
          <EmailViewActions
            email={detail}
            mailboxId={mailboxId}
            onAction={onAction}
            variant="message"
            label={t('thread.messageActions', {
              name: sender === null ? '' : formatAddressName(sender),
              date: formatFullDate(detail.receivedAt, lang)
            })}
          />
        )}
      </Box>
      <AddressLine
        label="email.to"
        addresses={detail.to}
        data-testid="conversation-message-to"
      />
      <AddressLine
        label="email.cc"
        addresses={detail.cc}
        data-testid="conversation-message-cc"
      />
      <AddressLine
        label="email.bcc"
        addresses={detail.bcc}
        data-testid="conversation-message-bcc"
      />
      <EmailActionRequiredTag email={detail} mailboxId={mailboxId} />
      <EmailLabels emails={[detail]} mailboxId={mailboxId} />
      <TwpWarningBanners email={detail} mailboxId={mailboxId} />
      <EmailMessageBody
        email={detail}
        onRemoteContentShown={onRemoteContentShown}
      />
      {isDraft ? (
        <ConversationDraftActions
          draft={detail}
          mailboxId={mailboxId}
          onAction={onAction}
        />
      ) : (
        <ReplyActions email={detail} />
      )}
    </>
  )
}

interface MessageContentProps {
  emailId: string
  openedMailboxId: string | null
  onAction: (id: EmailActionId) => void
  onRemoteContentShown: () => void
}

function MessageContent({
  emailId,
  openedMailboxId,
  onAction,
  onRemoteContentShown
}: MessageContentProps): ReactElement | null {
  const query = useEmail(emailId)
  if (query.isPending) return <ListSkeleton count={3} />
  if (query.data === null || query.data === undefined) return null
  return (
    <ExpandedBody
      key={query.data.id}
      detail={query.data}
      openedMailboxId={openedMailboxId}
      onAction={onAction}
      onRemoteContentShown={onRemoteContentShown}
    />
  )
}

export interface ConversationMessageProps {
  email: EmailListItemData
  isExpanded: boolean
  onToggle: (emailId: string) => void
  /** The folder the conversation is open from, null from search results */
  openedMailboxId: string | null
  /** After an action of the message changed it */
  onAction: (emailId: string, id: EmailActionId) => void
  /** Where the focus goes once the remote content banner went away */
  onRemoteContentShown: () => void
  /** The message the conversation opened on: scrolled to and focused */
  isTarget?: boolean
  /** Id of the subject and count of the conversation, read with the target */
  describedById?: string
}

/**
 * A message of a conversation. Collapsed: sender, date and one line of
 * preview, bold and marked when unread. Expanded: the message itself, with
 * the actions of the single email view. Marked unread, it collapses and its
 * header keeps the focus.
 */
export function ConversationMessage({
  email,
  isExpanded,
  onToggle,
  openedMailboxId,
  onAction,
  onRemoteContentShown,
  isTarget = false,
  describedById = ''
}: ConversationMessageProps): ReactElement {
  const { t, lang } = useI18n()
  const toggleRef = useRef<HTMLButtonElement>(null)
  useRevealOnOpen(toggleRef, isTarget, describedById)
  const sender = email.from?.[0] ?? null
  const initials = getInitials(sender?.name ?? '', sender?.email ?? '')
  const isUnread = !hasKeyword(email, SEEN)
  const isDraft = hasKeyword(email, DRAFT)
  const emphasis = isUnread ? 'u-fw-bold' : ''
  const showsImportant = useShowsSenderPriority() && isMarkedImportant(email)

  const handleAction = (id: EmailActionId): void => {
    onAction(email.id, id)
    // The actions went away with the message: its header keeps the focus
    if (id === 'mark-as-unread') toggleRef.current?.focus()
  }

  const header = (
    <MessageHeader
      component="span"
      avatar={
        isExpanded ? (
          <ExpandedAvatar emailId={email.id} initials={initials} />
        ) : (
          <Avatar component="span" size="s" aria-hidden="true">
            {initials}
          </Avatar>
        )
      }
      identity={
        <>
          <Typography
            component="span"
            className="u-db"
            data-testid="conversation-message-from"
          >
            {isUnread ? (
              <span className="u-dib u-mr-half">
                <StatusDot
                  label={t('email.unread')}
                  data-testid="conversation-message-unread"
                />
              </span>
            ) : null}
            {showsImportant ? <ImportantMark /> : null}
            {isDraft ? (
              <Typography
                component="span"
                color="error"
                className="u-mr-half"
                data-testid="conversation-message-draft"
              >
                {t('thread.draft.marker')}
              </Typography>
            ) : null}
            <span className={emphasis}>
              {sender ? formatAddressName(sender) : ''}
            </span>
          </Typography>
          {isExpanded ? null : (
            <SecondaryText
              variant="body2"
              component="span"
              noWrap
              className="u-db"
              data-testid="conversation-message-preview"
            >
              <span className={emphasis}>{email.preview}</span>
            </SecondaryText>
          )}
        </>
      }
      date={
        <SecondaryText variant="caption" component="span" noWrap>
          <time
            dateTime={email.receivedAt}
            title={formatFullDate(email.receivedAt, lang)}
          >
            {isExpanded
              ? formatFullDate(email.receivedAt, lang)
              : formatListDate(email.receivedAt, lang)}
          </time>
        </SecondaryText>
      }
    />
  )

  return (
    <MessageThreadItem
      isExpanded={isExpanded}
      onToggle={() => {
        onToggle(email.id)
      }}
      header={header}
      data-testid="conversation-message"
      toggleTestId="conversation-message-toggle"
      toggleRef={toggleRef}
    >
      <MessageContent
        emailId={email.id}
        openedMailboxId={openedMailboxId}
        onAction={handleAction}
        onRemoteContentShown={onRemoteContentShown}
      />
    </MessageThreadItem>
  )
}
