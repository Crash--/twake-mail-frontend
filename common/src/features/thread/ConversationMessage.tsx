import { Icon } from '@linagora/twake-icons'
import { Skeleton, Typography } from '@linagora/twake-mui'
import type { EmailAddress } from 'jmap-client-ts'
import { useRef, useState, type ReactElement, type ReactNode } from 'react'

import {
  firstLetterOf,
  GradientAvatar
} from '@/ds/GradientAvatar/GradientAvatar'
import { Attachment } from '@/ds/FlutterIcons/FlutterIcons'
import { MessageHeader } from '@/ds/MessageHeader/MessageHeader'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { MessageThreadItem } from '@/ds/MessageThread/MessageThreadItem'
import { Indent } from '@/ds/Indent/Indent'
import { InlineGroup } from '@/ds/InlineGroup/InlineGroup'
import { MessageText } from '@/ds/MessageText/MessageText'
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
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import { CollapsedMessageActions } from './CollapsedMessageActions'
import { ConversationDraftActions } from './ConversationDraftActions'
import {
  formatFullDate,
  formatHeaderDate,
  formatListDate
} from './formatListDate'
import type { EmailListItemData } from './queries'
import { useRevealOnOpen } from './useRevealOnOpen'

function DetailAvatar({ detail }: { detail: EmailDetail }): ReactElement {
  const { t } = useI18n()
  const isDangerous = hasDangerWarning(useVisibleTwpWarnings(detail))
  return isDangerous ? (
    <WarningAvatarBadge
      component="span"
      size="s"
      label={t('email.twpWarning.dangerousMessage')}
      data-testid="conversation-message-danger-badge"
    />
  ) : (
    <SenderAvatar sender={detail.from?.[0] ?? null} />
  )
}

/** As tmail-flutter: the first letter on the gradient of the address */
function SenderAvatar({
  sender
}: {
  sender: EmailAddress | null
}): ReactElement {
  const name = sender?.name ?? ''
  const address = sender?.email ?? ''
  // tmail-flutter: 44 px on phones, 32 px elsewhere
  const isPhone = useScreenSize() === 'mobile'
  return (
    <GradientAvatar
      text={firstLetterOf(name === '' ? address : name)}
      colorKey={address}
      size={isPhone ? 44 : 32}
      fontSize={isPhone ? 20 : 18}
    />
  )
}

function ExpandedAvatar({
  emailId,
  sender
}: {
  emailId: string
  sender: EmailAddress | null
}): ReactElement {
  const query = useEmail(emailId)
  return query.data ? (
    <DetailAvatar detail={query.data} />
  ) : (
    <SenderAvatar sender={sender} />
  )
}

interface ExpandedBodyProps {
  detail: EmailDetail
  /** The folder the conversation is open from, null from search results */
  openedMailboxId: string | null
  onAction: (id: EmailActionId) => void
  onRemoteContentShown: () => void
}

const RECIPIENT_LINES: readonly {
  label: TranslationKey
  field: 'to' | 'cc' | 'bcc'
  testId: string
}[] = [
  { label: 'email.to', field: 'to', testId: 'conversation-message-to' },
  { label: 'email.cc', field: 'cc', testId: 'conversation-message-cc' },
  { label: 'email.bcc', field: 'bcc', testId: 'conversation-message-bcc' }
]

/**
 * Where the recipients of an expanded message go, as tmail-flutter: in the
 * column of the name (the avatar, 32 px, and 16 px; on a phone 44 and 16,
 * less the 4 px the body has more than the header), under the 28 px line of
 * the name rather than the avatar (11 px up), under the line of the date on
 * a phone
 */
function useRecipientsPlace(): { indent: number; pullUp: number } {
  return useScreenSize() === 'mobile'
    ? { indent: 56, pullUp: 0 }
    : { indent: 48, pullUp: 11 }
}

interface ExpandedSenderProps {
  emailId: string
  sender: EmailAddress | null
  openedMailboxId: string | null
  /** The date: after the sender, under it on a phone */
  date: ReactNode
}

/**
 * As tmail-flutter, the first line of an expanded message, out of its
 * toggle: the name and address of the sender as the button of its card,
 * "Unsubscribe" once the message is loaded, then the date. Read in the
 * toggle already, the name and date are hidden from assistive technologies
 * here but for the button.
 */
function ExpandedSender({
  emailId,
  sender,
  openedMailboxId,
  date
}: ExpandedSenderProps): ReactElement {
  const query = useEmail(emailId)
  const { canUnsubscribe, unsubscribe } = useUnsubscribe()
  const { data: mailboxes = [] } = useMailboxes()
  const isPhone = useScreenSize() === 'mobile'
  const detail = query.data ?? null
  const shownDate = <span aria-hidden="true">{date}</span>
  return (
    <>
      <SenderLine
        sender={detail?.from?.[0] ?? sender}
        onUnsubscribe={
          detail !== null && canUnsubscribe(detail)
            ? () => {
                void unsubscribe(
                  detail,
                  messageMailboxId(detail, openedMailboxId, mailboxes)
                )
              }
            : null
        }
        data-testid="conversation-message-sender"
      >
        {isPhone ? null : shownDate}
      </SenderLine>
      {/* tmail-flutter: 5 px above and below the date (a line of 14), under
          the 28 px line of the name */}
      {isPhone ? (
        <Indent size={0} pullUp={-3}>
          {shownDate}
        </Indent>
      ) : null}
    </>
  )
}

/**
 * The content of an expanded message: its sender (with the address menu),
 * recipients, labels and body, as the single email view has them; the
 * answers are in the bar at the bottom of the conversation, and its actions
 * beside its header
 */
function ExpandedBody({
  detail,
  openedMailboxId,
  onAction,
  onRemoteContentShown
}: ExpandedBodyProps): ReactElement {
  useReadReceiptRequest(detail)
  const { data: mailboxes = [] } = useMailboxes()
  const mailboxId = messageMailboxId(detail, openedMailboxId, mailboxes)
  const { indent, pullUp } = useRecipientsPlace()
  // A draft is not read but written: the composer edits it
  const isDraft = hasKeyword(detail, DRAFT)
  const [isRecipientsOpen, setIsRecipientsOpen] = useState(false)
  const recipientLines = RECIPIENT_LINES.map(line => ({
    ...line,
    addresses: detail[line.field]
  })).filter(line => (line.addresses ?? []).length > 0)
  // As tmail-flutter: a chevron shows the addresses of several recipients
  const hasSeveralRecipients =
    recipientLines.reduce(
      (count, line) => count + (line.addresses?.length ?? 0),
      0
    ) > 1
  return (
    <>
      <Indent size={indent} pullUp={pullUp}>
        {/* As tmail-flutter: the names on one line, the addresses once
            the chevron is open */}
        <InlineGroup gap={0.5}>
          {recipientLines.map(({ label, addresses, testId }, index) => (
            <AddressLine
              key={testId}
              label={label}
              addresses={addresses}
              isOpen={isRecipientsOpen}
              onToggle={
                hasSeveralRecipients && index === recipientLines.length - 1
                  ? () => {
                      setIsRecipientsOpen(current => !current)
                    }
                  : null
              }
              data-testid={testId}
            />
          ))}
        </InlineGroup>
      </Indent>
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
      ) : null}
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
  const isPhone = useScreenSize() === 'mobile'
  // About the height of a short message (the line of its recipients, under
  // the name, and a short text), so that the ones below the one the
  // conversation opened on do not move when it loads; on a phone the
  // recipients are under the date rather than pulled up beside the avatar
  if (query.isPending) {
    return <Skeleton variant="rounded" height={isPhone ? 81 : 70} />
  }
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

interface MessageActionsProps {
  email: EmailListItemData
  isExpanded: boolean
  openedMailboxId: string | null
  onAction: (id: EmailActionId) => void
  label: string
}

function ExpandedMessageActions({
  email,
  openedMailboxId,
  onAction,
  label
}: Omit<MessageActionsProps, 'isExpanded'>): ReactElement {
  const { data: mailboxes = [] } = useMailboxes()
  const query = useEmail(email.id)
  // The row's own actions until the message is loaded: the same buttons
  if (query.data === null || query.data === undefined) {
    return (
      <CollapsedMessageActions
        email={email}
        openedMailboxId={openedMailboxId}
        onAction={onAction}
        label={label}
        isExpanded
      />
    )
  }
  return (
    <EmailViewActions
      email={query.data}
      mailboxId={messageMailboxId(query.data, openedMailboxId, mailboxes)}
      onAction={onAction}
      variant="message"
      label={label}
    />
  )
}

/**
 * The actions beside the header of a message: the ones of the open email
 * (with Print, Download as EML, Unsubscribe in "More") once it is
 * expanded, else the ones a list row knows enough to run
 */
function MessageActions({
  isExpanded,
  ...props
}: MessageActionsProps): ReactElement {
  return isExpanded ? (
    <ExpandedMessageActions {...props} />
  ) : (
    <CollapsedMessageActions {...props} />
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
  const isUnread = !hasKeyword(email, SEEN)
  const isDraft = hasKeyword(email, DRAFT)
  const emphasis = isUnread ? 'u-fw-bold' : ''
  const showsImportant = useShowsSenderPriority() && isMarkedImportant(email)
  const headerDate = formatHeaderDate(email.receivedAt, lang)

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
          <ExpandedAvatar emailId={email.id} sender={sender} />
        ) : (
          <SenderAvatar sender={sender} />
        )
      }
      identity={
        <>
          <InlineGroup
            component="span"
            gap={1}
            data-testid="conversation-message-from"
          >
            {isUnread ? (
              <StatusDot
                label={t('email.unread')}
                data-testid="conversation-message-unread"
              />
            ) : null}
            {showsImportant ? <ImportantMark /> : null}
            {isDraft ? (
              <Typography
                component="span"
                color="error"
                data-testid="conversation-message-draft"
              >
                {t('thread.draft.marker')}
              </Typography>
            ) : null}
            {isExpanded ? (
              // Read as the name of the toggle; shown after it, as the button
              // of the card of the sender, then the date
              <span className="u-visuallyhidden">
                {`${sender ? formatAddressName(sender) : ''} ${headerDate}`}
              </span>
            ) : (
              <>
                <MessageText variant="compactName" className={emphasis}>
                  {sender ? formatAddressName(sender) : ''}
                </MessageText>
                {email.hasAttachment ? (
                  <Icon
                    icon={Attachment}
                    size={16}
                    aria-label={t('email.attachment')}
                  />
                ) : null}
                <MessageText variant="compact">
                  <time
                    dateTime={email.receivedAt}
                    title={formatFullDate(email.receivedAt, lang)}
                  >
                    {formatListDate(email.receivedAt, lang)}
                  </time>
                </MessageText>
              </>
            )}
          </InlineGroup>
          {isExpanded ? null : (
            <MessageText
              variant="compact"
              noWrap
              className="u-db"
              data-testid="conversation-message-preview"
            >
              <span className={emphasis}>{email.preview}</span>
            </MessageText>
          )}
        </>
      }
    />
  )

  const headerEnd = isExpanded ? (
    <ExpandedSender
      emailId={email.id}
      sender={sender}
      openedMailboxId={openedMailboxId}
      date={
        <MessageText variant="meta">
          <time
            dateTime={email.receivedAt}
            title={formatFullDate(email.receivedAt, lang)}
          >
            {headerDate}
          </time>
        </MessageText>
      }
    />
  ) : null

  const actionsLabel = t('thread.messageActions', {
    name: sender === null ? '' : formatAddressName(sender),
    date: formatFullDate(email.receivedAt, lang)
  })

  return (
    <MessageThreadItem
      isExpanded={isExpanded}
      onToggle={() => {
        onToggle(email.id)
      }}
      header={header}
      headerEnd={headerEnd}
      actions={
        isDraft ? null : (
          <MessageActions
            email={email}
            isExpanded={isExpanded}
            openedMailboxId={openedMailboxId}
            onAction={handleAction}
            label={actionsLabel}
          />
        )
      }
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
