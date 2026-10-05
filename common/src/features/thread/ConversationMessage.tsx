import {
  Avatar,
  getInitials,
  ListSkeleton,
  Typography
} from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { MessageHeader } from '@/ds/MessageHeader/MessageHeader'
import { MessageThreadItem } from '@/ds/MessageThread/MessageThreadItem'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { StatusDot } from '@/ds/StatusDot/StatusDot'
import { AddressLine } from '@common/features/email/AddressLine'
import { formatAddressName } from '@common/features/email/addresses'
import { isMarkedImportant } from '@common/features/email/importance'
import { ImportantMark } from '@common/features/email/ImportantMark'
import { EmailMessageBody } from '@common/features/email/EmailMessageBody'
import { hasKeyword, SEEN } from '@common/features/email/keywords'
import type { EmailDetail } from '@common/features/email/queries'
import { ReplyActions } from '@common/features/email/ReplyActions'
import { useEmail } from '@common/features/email/useEmail'
import { useI18n } from '@common/i18n/useI18n'

import { formatFullDate, formatListDate } from './formatListDate'
import type { EmailListItemData } from './queries'

interface ExpandedBodyProps {
  detail: EmailDetail
  onRemoteContentShown: () => void
}

/** The content of an expanded message */
function ExpandedBody({
  detail,
  onRemoteContentShown
}: ExpandedBodyProps): ReactElement {
  return (
    <>
      <AddressLine
        label="email.cc"
        addresses={detail.cc}
        data-testid="conversation-message-cc"
      />
      <EmailMessageBody
        email={detail}
        onRemoteContentShown={onRemoteContentShown}
      />
      <ReplyActions email={detail} />
    </>
  )
}

interface MessageContentProps {
  emailId: string
  onRemoteContentShown: () => void
}

function MessageContent({
  emailId,
  onRemoteContentShown
}: MessageContentProps): ReactElement | null {
  const query = useEmail(emailId)
  if (query.isPending) return <ListSkeleton count={3} />
  if (query.data === null || query.data === undefined) return null
  return (
    <ExpandedBody
      key={query.data.id}
      detail={query.data}
      onRemoteContentShown={onRemoteContentShown}
    />
  )
}

export interface ConversationMessageProps {
  email: EmailListItemData
  isExpanded: boolean
  onToggle: (emailId: string) => void
  /** Where the focus goes once the remote content banner went away */
  onRemoteContentShown: () => void
}

/**
 * A message of a conversation. Collapsed: sender, date and one line of
 * preview, bold and marked when unread. Expanded: sender with address,
 * recipients, date, then the message itself.
 */
export function ConversationMessage({
  email,
  isExpanded,
  onToggle,
  onRemoteContentShown
}: ConversationMessageProps): ReactElement {
  const { t, lang } = useI18n()
  const sender = email.from?.[0] ?? null
  const isUnread = !hasKeyword(email, SEEN)
  const emphasis = isUnread ? 'u-fw-bold' : ''

  const header = (
    <MessageHeader
      component="span"
      avatar={
        <Avatar component="span" size="s" aria-hidden="true">
          {getInitials(sender?.name ?? '', sender?.email ?? '')}
        </Avatar>
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
            {isMarkedImportant(email) ? <ImportantMark /> : null}
            <span className={emphasis}>
              {sender ? formatAddressName(sender) : ''}
            </span>
            {isExpanded && sender?.name ? (
              <SecondaryText component="span">{` <${sender.email}>`}</SecondaryText>
            ) : null}
          </Typography>
          {isExpanded ? (
            <SecondaryText
              variant="body2"
              component="span"
              className="u-db"
              data-testid="conversation-message-to"
            >
              {`${t('email.to')}: ${(email.to ?? []).map(formatAddressName).join(', ')}`}
            </SecondaryText>
          ) : (
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
    >
      <MessageContent
        emailId={email.id}
        onRemoteContentShown={onRemoteContentShown}
      />
    </MessageThreadItem>
  )
}
