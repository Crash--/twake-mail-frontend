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
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { MessageHeader } from '@/ds/MessageHeader/MessageHeader'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { prepareViewTransition } from '@/ds/ViewTransition/viewTransition'
import { useDocumentTitle } from '@common/app/useDocumentTitle'
import type { EmailActionId } from '@common/features/emailActions/emailActionItems'
import { useShowsSenderPriority } from '@common/features/settings/serverSettings'
import { useThreadPreference } from '@common/features/settings/threadPreference'
import { ConversationView } from '@common/features/thread/ConversationView'
import { isOpenedFromList } from '@common/features/thread/conversationTarget'
import type { EmailListLocationState } from '@common/features/thread/EmailList'
import { formatFullDate } from '@common/features/thread/formatListDate'
import { EmailActionRequiredTag } from '@common/features/ai/EmailActionRequiredTag'
import { EmailLabels } from '@common/features/labels/EmailLabels'
import { useI18n } from '@common/i18n/useI18n'

import { AddressLine } from './AddressLine'
import { isMarkedImportant } from './importance'
import { ImportantMark } from './ImportantMark'
import { EmailMessageBody } from './EmailMessageBody'
import { EmailViewActions } from './EmailViewActions'
import { ReplyActions } from './ReplyActions'
import { SenderLine } from './SenderLine'
import type { EmailDetail } from './queries'
import { useEmail } from './useEmail'
import { useEmailViewShortcuts } from './useEmailViewShortcuts'
import { useMarkAsReadOnOpen } from './useMarkAsReadOnOpen'
import { useReadReceiptRequest } from './useReadReceiptRequest'

interface EmailContentProps {
  email: EmailDetail
  /** The folder it is open from, null from search results */
  mailboxId: string | null
  onBack: () => void
}

function EmailContent({
  email,
  mailboxId,
  onBack
}: EmailContentProps): ReactElement {
  const { t, lang } = useI18n()
  useMarkAsReadOnOpen(email)
  useReadReceiptRequest(email)
  const showsImportant = useShowsSenderPriority() && isMarkedImportant(email)
  const sender = email.from?.[0] ?? null
  const backLabel = t('common.back')
  useDocumentTitle(email.subject ?? '')
  const subjectRef = useRef<HTMLHeadingElement>(null)

  // The list the email replaces is gone: the focus moves to the subject,
  // where a screen reader starts reading the email
  useEffect(() => {
    subjectRef.current?.focus()
  }, [])

  // As tmail-flutter: an email marked unread is closed
  const handleAction = (id: EmailActionId): void => {
    if (id === 'mark-as-unread') onBack()
  }

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
        <EmailViewActions
          email={email}
          mailboxId={mailboxId}
          onAction={handleAction}
        />
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
        {showsImportant ? <ImportantMark showLabel /> : null}
        <EmailActionRequiredTag email={email} mailboxId={mailboxId ?? null} />
        <EmailLabels emails={[email]} mailboxId={mailboxId ?? null} />
        <MessageHeader
          className="u-mt-1"
          avatar={
            <Avatar>
              {getInitials(sender?.name ?? '', sender?.email ?? '')}
            </Avatar>
          }
          identity={
            <>
              <SenderLine sender={sender} data-testid="email-view-from" />
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
        <ReplyActions email={email} />
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
  const location = useLocation()
  const query = useEmail(emailId)
  const threadPreference = useThreadPreference()
  // The conversation stays once the email opened was deleted from it
  const [lastThreadId, setLastThreadId] = useState<string | null>(null)
  const loadedThreadId = query.data?.threadId ?? null
  if (loadedThreadId !== null && loadedThreadId !== lastThreadId) {
    setLastThreadId(loadedThreadId)
  }
  const threadId = loadedThreadId ?? lastThreadId
  useEmailViewShortcuts({
    emailId,
    email: query.data,
    mailboxId: mailboxId ?? null,
    backPath,
    // A conversation leaves once none of its messages is in the folder
    leavesWhenMoved: !threadPreference.isEnabled
  })

  const handleBack = (): void => {
    void navigate(backPath, {
      state: { focusEmailId: emailId } satisfies EmailListLocationState,
      viewTransition: prepareViewTransition('backward')
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

  // With the "Thread" setting, the email is shown in its conversation
  if (threadPreference.isEnabled && threadId !== null) {
    return (
      <ConversationView
        key={threadId}
        threadId={threadId}
        emailId={emailId}
        mailboxId={mailboxId ?? null}
        fromList={isOpenedFromList(location.state)}
        onBack={handleBack}
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

  // A new email starts with its own choices (remote content)
  return (
    <EmailContent
      key={query.data.id}
      email={query.data}
      mailboxId={mailboxId ?? null}
      onBack={handleBack}
    />
  )
}
