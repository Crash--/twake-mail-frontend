import { Box, Empty } from '@linagora/twake-mui'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { EmailOpen } from '@/ds/FlutterIcons/FlutterIcons'
import { EmailSubject } from '@/ds/EmailSubject/EmailSubject'
import {
  firstLetterOf,
  GradientAvatar
} from '@/ds/GradientAvatar/GradientAvatar'
import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { MessageHeader } from '@/ds/MessageHeader/MessageHeader'
import { WarningAvatarBadge } from '@/ds/WarningAvatarBadge/WarningAvatarBadge'
import { InlineGroup } from '@/ds/InlineGroup/InlineGroup'
import { ReadingPane } from '@/ds/ReadingPane/ReadingPane'
import { MessageText } from '@/ds/MessageText/MessageText'
import { prepareViewTransition } from '@/ds/ViewTransition/viewTransition'
import { useDocumentTitle } from '@common/app/DocumentTitleProvider'
import type { EmailActionId } from '@common/features/emailActions/emailActionItems'
import { useShowsSenderPriority } from '@common/features/settings/serverSettings'
import { useThreadPreference } from '@common/features/settings/threadPreference'
import { ConversationView } from '@common/features/thread/ConversationView'
import { isOpenedFromList } from '@common/features/thread/conversationTarget'
import type { EmailListLocationState } from '@common/features/thread/EmailList'
import {
  formatFullDate,
  formatHeaderDate
} from '@common/features/thread/formatListDate'
import { EmailActionRequiredTag } from '@common/features/ai/EmailActionRequiredTag'
import { EmailLabels } from '@common/features/labels/EmailLabels'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import { AddressLine } from './AddressLine'
import { isMarkedImportant } from './importance'
import { ImportantMark } from './ImportantMark'
import { EmailMessageBody } from './EmailMessageBody'
import { EmailViewActions } from './EmailViewActions'
import { ReadingLoadingView } from './ReadingLoadingView'
import { ReadingToolbar } from './ReadingToolbar'
import { ReplyActions } from './ReplyActions'
import { SenderLine } from './SenderLine'
import { hasDangerWarning } from './twpWarnings'
import { TwpWarningBanners, useVisibleTwpWarnings } from './TwpWarningBanners'
import type { EmailDetail } from './queries'
import { useEmail } from './useEmail'
import {
  useEmailViewShortcuts,
  type EmailViewNavigation
} from './useEmailViewShortcuts'
import { useMarkAsReadOnOpen } from './useMarkAsReadOnOpen'
import { useReadReceiptRequest } from './useReadReceiptRequest'
import { useUnsubscribe } from './useUnsubscribe'

interface EmailContentProps {
  email: EmailDetail
  /** The folder it is open from, null from search results */
  mailboxId: string | null
  onBack: () => void
  navigation: EmailViewNavigation
}

const RECIPIENT_LINES: readonly {
  label: TranslationKey
  field: 'to' | 'cc' | 'bcc'
  testId: string
}[] = [
  { label: 'email.to', field: 'to', testId: 'email-view-to' },
  { label: 'email.cc', field: 'cc', testId: 'email-view-cc' },
  { label: 'email.bcc', field: 'bcc', testId: 'email-view-bcc' }
]

function EmailContent({
  email,
  mailboxId,
  onBack,
  navigation
}: EmailContentProps): ReactElement {
  const { t, lang } = useI18n()
  const { canUnsubscribe, unsubscribe } = useUnsubscribe()
  useMarkAsReadOnOpen(email)
  useReadReceiptRequest(email)
  const showsImportant = useShowsSenderPriority() && isMarkedImportant(email)
  const sender = email.from?.[0] ?? null
  const isDangerous = hasDangerWarning(useVisibleTwpWarnings(email))
  useDocumentTitle(email.subject ?? '')
  const subjectRef = useRef<HTMLHeadingElement>(null)
  const [isRecipientsOpen, setIsRecipientsOpen] = useState(false)
  const recipientLines = RECIPIENT_LINES.map(line => ({
    ...line,
    addresses: email[line.field]
  })).filter(line => (line.addresses ?? []).length > 0)

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
    <ReadingPane data-testid="email-view">
      <ReadingToolbar onBack={onBack} navigation={navigation} />
      <Box className="u-ph-1 u-pt-1 u-flex-auto">
        <InlineGroup gap={2} align="center">
          <EmailSubject ref={subjectRef} data-testid="email-view-subject">
            {email.subject ?? ''}
          </EmailSubject>
          <EmailLabels
            emails={[email]}
            mailboxId={mailboxId ?? null}
            size="small"
            className=""
          />
        </InlineGroup>
        {showsImportant ? <ImportantMark showLabel /> : null}
        <EmailActionRequiredTag email={email} mailboxId={mailboxId ?? null} />
        <MessageHeader
          className="u-mt-1"
          avatar={
            isDangerous ? (
              <WarningAvatarBadge
                label={t('email.twpWarning.dangerousMessage')}
                data-testid="email-view-danger-badge"
              />
            ) : (
              <GradientAvatar
                text={firstLetterOf(
                  (sender?.name ?? '') === ''
                    ? (sender?.email ?? '')
                    : (sender?.name ?? '')
                )}
                colorKey={sender?.email ?? ''}
                fontSize={18}
              />
            )
          }
          identity={
            <>
              <SenderLine
                sender={sender}
                onUnsubscribe={
                  canUnsubscribe(email)
                    ? () => {
                        void unsubscribe(email, mailboxId)
                      }
                    : null
                }
                data-testid="email-view-from"
              >
                <MessageText variant="meta" data-testid="email-view-date">
                  <time
                    dateTime={email.receivedAt}
                    title={formatFullDate(email.receivedAt, lang)}
                  >
                    {formatHeaderDate(email.receivedAt, lang)}
                  </time>
                </MessageText>
              </SenderLine>
              <InlineGroup gap={2}>
                {recipientLines.map(({ label, addresses, testId }, index) => (
                  <AddressLine
                    key={testId}
                    label={label}
                    addresses={addresses}
                    isOpen={isRecipientsOpen}
                    onToggle={
                      index === recipientLines.length - 1
                        ? () => {
                            setIsRecipientsOpen(current => !current)
                          }
                        : null
                    }
                    data-testid={testId}
                  />
                ))}
              </InlineGroup>
            </>
          }
          actions={
            <EmailViewActions
              email={email}
              mailboxId={mailboxId}
              onAction={handleAction}
            />
          }
        />
        <TwpWarningBanners email={email} mailboxId={mailboxId} />
        <EmailMessageBody
          email={email}
          onRemoteContentShown={handleRemoteContentShown}
        />
      </Box>
      <ReplyActions email={email} />
    </ReadingPane>
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
  const navigation = useEmailViewShortcuts({
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

  if (query.isPending) return <ReadingLoadingView onBack={handleBack} />

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
        navigation={navigation}
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
      navigation={navigation}
    />
  )
}
