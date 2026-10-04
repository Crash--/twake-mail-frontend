import { EmailOpen, Icon, Left } from '@linagora/twake-icons'
import {
  Avatar,
  Box,
  Empty,
  getInitials,
  IconButton,
  ListSkeleton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { MessageHeader } from '@/ds/MessageHeader/MessageHeader'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useDocumentTitle } from '@common/app/useDocumentTitle'
import { useThreadPreference } from '@common/features/settings/threadPreference'
import { ConversationView } from '@common/features/thread/ConversationView'
import type { EmailListLocationState } from '@common/features/thread/EmailList'
import { formatFullDate } from '@common/features/thread/formatListDate'
import { useI18n } from '@common/i18n/useI18n'

import { AddressLine } from './AddressLine'
import { formatAddressName } from './addresses'
import { EmailMessageBody } from './EmailMessageBody'
import type { EmailDetail } from './queries'
import { useEmail } from './useEmail'
import { useEmailViewShortcuts } from './useEmailViewShortcuts'
import { useMarkAsReadOnOpen } from './useMarkAsReadOnOpen'

interface EmailContentProps {
  email: EmailDetail
  onBack: () => void
}

function EmailContent({ email, onBack }: EmailContentProps): ReactElement {
  const { t, lang } = useI18n()
  useMarkAsReadOnOpen(email)
  const sender = email.from?.[0] ?? null
  const backLabel = t('common.back')
  useDocumentTitle(email.subject ?? '')
  const subjectRef = useRef<HTMLHeadingElement>(null)

  // The list the email replaces is gone: the focus moves to the subject,
  // where a screen reader starts reading the email
  useEffect(() => {
    subjectRef.current?.focus()
  }, [])

  // The banner goes away with its buttons: the focus goes back to the email
  const handleRemoteContentShown = (): void => {
    subjectRef.current?.focus()
  }

  return (
    <Box className="u-p-1" data-testid="email-view">
      <Box className="u-flex u-flex-items-center u-mb-1">
        <Tooltip title={backLabel}>
          <IconButton
            aria-label={backLabel}
            onClick={onBack}
            data-testid="email-view-back-button"
          >
            <Icon icon={Left} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box className="u-ph-1">
        <Typography
          ref={subjectRef}
          variant="h3"
          component="h1"
          tabIndex={-1}
          className="u-breakword"
          data-testid="email-view-subject"
        >
          {email.subject ?? ''}
        </Typography>
        <MessageHeader
          className="u-mt-1"
          avatar={
            <Avatar>
              {getInitials(sender?.name ?? '', sender?.email ?? '')}
            </Avatar>
          }
          identity={
            <>
              <Typography data-testid="email-view-from">
                {sender ? (
                  <>
                    <span className="u-fw-bold">
                      {formatAddressName(sender)}
                    </span>
                    {sender.name ? (
                      <SecondaryText>{` <${sender.email}>`}</SecondaryText>
                    ) : null}
                  </>
                ) : null}
              </Typography>
              <AddressLine
                label="email.to"
                addresses={email.to}
                data-testid="email-view-to"
              />
              <AddressLine
                label="email.cc"
                addresses={email.cc}
                data-testid="email-view-cc"
              />
              <AddressLine
                label="email.bcc"
                addresses={email.bcc}
                data-testid="email-view-bcc"
              />
            </>
          }
          date={
            <SecondaryText variant="caption" data-testid="email-view-date">
              <time dateTime={email.receivedAt}>
                {formatFullDate(email.receivedAt, lang)}
              </time>
            </SecondaryText>
          }
        />
        <EmailMessageBody
          email={email}
          onRemoteContentShown={handleRemoteContentShown}
        />
      </Box>
    </Box>
  )
}

export interface EmailViewProps {
  emailId: string
  /** The list the back button returns to: a mailbox, search results */
  backPath: string
  /** The folder the email is open from; absent from search results */
  mailboxId?: string
}

/**
 * An opened email: headers, attachments and body, or its whole
 * conversation when the "Thread" setting is on. Replaces the list, as in
 * tmail-flutter on desktop; the back button returns to the list.
 */
export function EmailView({
  emailId,
  backPath,
  mailboxId
}: EmailViewProps): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const query = useEmail(emailId)
  useEmailViewShortcuts({
    emailId,
    email: query.data,
    mailboxId: mailboxId ?? null,
    backPath
  })
  const threadPreference = useThreadPreference()

  const handleBack = (): void => {
    void navigate(backPath, {
      state: { focusEmailId: emailId } satisfies EmailListLocationState
    })
  }

  if (query.isPending) {
    return (
      <Box className="u-p-2" data-testid="email-view-loading">
        <ListSkeleton count={4} hasSecondary />
      </Box>
    )
  }

  if (query.isError) {
    const handleRetry = (): void => {
      void query.refetch()
    }
    return (
      <ErrorScreen
        title={t('common.errorOccurred')}
        actionLabel={t('common.retry')}
        onAction={handleRetry}
        data-testid="email-view-error"
      />
    )
  }

  if (query.data === null) {
    return (
      <Empty
        icon={EmailOpen}
        title={t('email.notFound')}
        data-testid="email-not-found"
      />
    )
  }

  // With the "Thread" setting, the email is shown in its conversation
  if (threadPreference.isEnabled) {
    return (
      <ConversationView
        key={query.data.threadId}
        threadId={query.data.threadId}
        emailId={query.data.id}
        onBack={handleBack}
      />
    )
  }

  // A new email starts with its own choices (remote content)
  return (
    <EmailContent key={query.data.id} email={query.data} onBack={handleBack} />
  )
}
