import {
  Archive,
  Email as EmailIcon,
  EmailOpen,
  Star,
  StarOutline,
  Trash,
  Warning
} from '@linagora/twake-icons'
import { Box, Empty, ListSkeleton, Typography } from '@linagora/twake-mui'
import { useQuery } from '@tanstack/react-query'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from 'react'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { InlineGroup } from '@/ds/InlineGroup/InlineGroup'
import { MessageThread } from '@/ds/MessageThread/MessageThread'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { ReadingPane } from '@/ds/ReadingPane/ReadingPane'
import { useDocumentTitle } from '@common/app/useDocumentTitle'
import { formatAddressName } from '@common/features/email/addresses'
import { ReadingToolbar } from '@common/features/email/ReadingToolbar'
import type { EmailViewNavigation } from '@common/features/email/useEmailViewShortcuts'
import { FLAGGED, hasKeyword, SEEN } from '@common/features/email/keywords'
import { findMailboxIdByRole } from '@common/features/mailbox/mailboxTree'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import type { EmailActionId } from '@common/features/emailActions/emailActionItems'
import {
  useEmailActions,
  type EmailActionName
} from '@common/features/emailActions/useEmailActions'
import { EmailLabels } from '@common/features/labels/EmailLabels'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { ConversationMenu, type ConversationMenuItem } from './ConversationMenu'
import { ConversationMessage } from './ConversationMessage'
import { ConversationReplyBar } from './ConversationReplyBar'
import { pickTargetMessageId } from './conversationTarget'
import { conversationQueryOptions, type EmailListItemData } from './queries'
import { isOwnSentCopy } from './threadSummary'

/** Shown expanded when the conversation opens: unread, last, opened */
function initiallyExpanded(
  emails: readonly EmailListItemData[],
  openedId: string
): Set<string> {
  const expanded = new Set(
    emails.filter(email => !hasKeyword(email, SEEN)).map(email => email.id)
  )
  const last = emails[emails.length - 1]
  if (last) expanded.add(last.id)
  expanded.add(openedId)
  return expanded
}

const NO_NAVIGATION: EmailViewNavigation = {
  openPrevious: null,
  openNext: null
}

interface ConversationContentProps {
  emails: EmailListItemData[]
  openedId: string
  /** The folder it is open from, null from search results */
  mailboxId: string | null
  /** Opened from the row of a list, not from a result or a link */
  fromList: boolean
  onBack: () => void
  navigation?: EmailViewNavigation
}

function ConversationContent({
  emails,
  openedId,
  mailboxId,
  fromList,
  onBack,
  navigation = NO_NAVIGATION
}: ConversationContentProps): ReactElement {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(() =>
    initiallyExpanded(emails, openedId)
  )
  // The messages there when it opened: the others arrived since
  const [initialIds] = useState(() => new Set(emails.map(email => email.id)))
  // The message the conversation opens on: scrolled to, focused
  const [targetId] = useState(() =>
    pickTargetMessageId(emails, openedId, fromList)
  )
  // Read with the header of the target: the subject and the count, not the labels
  const headerId = useId()
  const subjectId = `${headerId}-subject`
  const countId = `${headerId}-count`
  const subjectRef = useRef<HTMLHeadingElement>(null)
  const { run } = useEmailActions()
  const subject = emails[emails.length - 1]?.subject ?? ''
  useDocumentTitle(subject)
  const arrived = emails.filter(email => !initialIds.has(email.id))
  const lastArrived = arrived[arrived.length - 1] ?? null
  const isRead = emails.every(email => hasKeyword(email, SEEN))
  const isStarred = emails.every(email => hasKeyword(email, FLAGGED))

  // The unread messages are expanded, hence read: in one request. The ref
  // keeps the effect, run twice in development, from sending it twice
  const hasMarkedRef = useRef(false)
  useEffect(() => {
    if (hasMarkedRef.current) return
    hasMarkedRef.current = true
    const unread = emails.filter(
      email => expanded.has(email.id) && !hasKeyword(email, SEEN)
    )
    if (unread.length > 0) {
      void run({
        action: 'markAsRead',
        emails: unread,
        mailboxId: null,
        silent: true
      })
    }
    // Once, when the conversation opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once none of its messages is left in the folder (moved by the actions of
  // a message, or by another client), back to the list; a message moved
  // elsewhere stays in the conversation with its new folder
  const isInMailbox =
    mailboxId === null || emails.some(email => mailboxId in email.mailboxIds)
  const wasInMailboxRef = useRef(isInMailbox)
  useEffect(() => {
    if (isInMailbox) {
      wasInMailboxRef.current = true
    } else if (wasInMailboxRef.current) {
      wasInMailboxRef.current = false
      onBack()
    }
  }, [isInMailbox, onBack])

  const handleToggle = (emailId: string): void => {
    const email = emails.find(candidate => candidate.id === emailId)
    // Expanding an unread message reads it
    if (email && !expanded.has(emailId) && !hasKeyword(email, SEEN)) {
      void run({
        action: 'markAsRead',
        emails: [email],
        mailboxId: null,
        silent: true
      })
    }
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(emailId)) {
        next.delete(emailId)
      } else {
        next.add(emailId)
      }
      return next
    })
  }

  const handleFocusSubject = (): void => {
    subjectRef.current?.focus()
  }

  // A message marked unread collapses, as the conversation does; a message
  // deleted forever leaves it, the focus goes back to the subject
  const handleMessageAction = (emailId: string, id: EmailActionId): void => {
    if (id === 'mark-as-unread') {
      setExpanded(current => {
        const next = new Set(current)
        next.delete(emailId)
        return next
      })
    }
    if (id === 'delete-permanently') handleFocusSubject()
  }

  // The actions apply to every message of the conversation (tmail-flutter
  // ADR 0068), with the toasts, undo and retry of the email actions
  const runOnAll = (action: EmailActionName): void => {
    void run({ action, emails, mailboxId: null })
  }

  // Marked unread, it collapses, as in tmail-flutter: the messages are left
  // to read again
  const handleToggleRead = (): void => {
    if (isRead) setExpanded(new Set())
    runOnAll(isRead ? 'markAsUnread' : 'markAsRead')
  }

  const handleToggleStar = (): void => {
    runOnAll(isStarred ? 'unstar' : 'star')
  }

  // The conversation leaves the folder: back to the list
  const handleMove = (action: EmailActionName) => (): void => {
    // Leaves once, not again when the messages leave the folder
    wasInMailboxRef.current = false
    runOnAll(action)
    onBack()
  }

  const moves: {
    action: EmailActionName
    label: string
    icon: typeof Archive
    testId: string
  }[] = [
    {
      action: 'archive',
      label: t('thread.archive'),
      icon: Archive,
      testId: 'conversation-archive'
    },
    {
      action: 'moveToTrash',
      label: t('thread.moveToTrash'),
      icon: Trash,
      testId: 'conversation-move-to-trash'
    },
    {
      action: 'markAsSpam',
      label: t('thread.markAsSpam'),
      icon: Warning,
      testId: 'conversation-mark-as-spam'
    }
  ]

  const readLabel = t(isRead ? 'email.markAsUnread' : 'email.markAsRead')
  const starLabel = t(isStarred ? 'email.unstar' : 'email.star')
  const menuItems: ConversationMenuItem[] = [
    {
      id: 'toggle-seen',
      label: readLabel,
      icon: isRead ? EmailIcon : EmailOpen,
      onSelect: handleToggleRead,
      'data-testid': 'conversation-toggle-seen'
    },
    {
      id: 'toggle-star',
      label: starLabel,
      icon: isStarred ? Star : StarOutline,
      onSelect: handleToggleStar,
      'data-testid': 'conversation-toggle-star'
    },
    ...moves.map(move => ({
      id: move.action,
      label: move.label,
      icon: move.icon,
      onSelect: handleMove(move.action),
      'data-testid': move.testId
    }))
  ]
  const lastSender = lastArrived?.from?.[0] ?? null

  return (
    <ReadingPane data-testid="conversation-view">
      {/* Stays in view over a long conversation */}
      <ReadingToolbar
        onBack={onBack}
        navigation={navigation}
        label={t('thread.actions')}
        data-testid="conversation-toolbar"
      >
        <ConversationMenu items={menuItems} />
      </ReadingToolbar>
      <Box
        className="u-ph-1 u-pt-1 u-pb-half"
        data-testid="conversation-header"
      >
        <InlineGroup gap={2} align="center">
          <Typography
            ref={subjectRef}
            id={subjectId}
            variant="h4"
            component="h1"
            tabIndex={-1}
            className="u-breakword"
            data-testid="conversation-subject"
          >
            {subject}
          </Typography>
          <EmailLabels
            emails={emails}
            mailboxId={null}
            size="small"
            className=""
          />
        </InlineGroup>
        <SecondaryText
          variant="body2"
          component="p"
          id={countId}
          className="u-visuallyhidden"
          data-testid="conversation-count"
        >
          {t('thread.messageCount', { smart_count: emails.length })}
        </SecondaryText>
      </Box>
      <MessageThread label={t('thread.messages')} data-testid="conversation">
        {emails.map(email => (
          <ConversationMessage
            key={email.id}
            email={email}
            isExpanded={expanded.has(email.id)}
            onToggle={handleToggle}
            openedMailboxId={mailboxId}
            onAction={handleMessageAction}
            onRemoteContentShown={handleFocusSubject}
            isTarget={email.id === targetId}
            describedById={`${subjectId} ${countId}`}
          />
        ))}
      </MessageThread>
      {/* Always mounted: a live region only announces changes */}
      <Box
        role="status"
        className="u-visuallyhidden"
        data-testid="conversation-announcement"
      >
        {lastArrived === null ? null : (
          <span key={lastArrived.id}>
            {t('thread.newMessage', {
              name: lastSender === null ? '' : formatAddressName(lastSender)
            })}
          </span>
        )}
      </Box>
      <ConversationReplyBar emails={emails} />
    </ReadingPane>
  )
}

export interface ConversationViewProps {
  /** The email opened: the conversation is its thread */
  threadId: string
  emailId: string
  /** The folder it is open from; absent from search results */
  mailboxId?: string | null
  /**
   * Opened from the row of a list: it opens on the first unread message,
   * otherwise the latest. Otherwise (search result, link) on `emailId`.
   */
  fromList?: boolean
  onBack: () => void
  /** The previous and next email of the folder, for the toolbar */
  navigation?: EmailViewNavigation
}

/**
 * An email shown with its whole conversation, when the "Thread" setting is
 * on (`Thread/get`, then the `Email/get` of its emails), the oldest first.
 * Unread messages, the last one and the one opened are expanded (and the
 * unread ones marked read, in one request), the others collapsed; a reply
 * arriving while it is open joins it collapsed (push) and is announced.
 * It opens scrolled to, and focused on, the header of the message to read.
 */
export function ConversationView({
  threadId,
  emailId,
  mailboxId = null,
  fromList = false,
  onBack,
  navigation = NO_NAVIGATION
}: ConversationViewProps): ReactElement {
  const { t } = useI18n()
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()
  const query = useQuery(conversationQueryOptions(client, accountId, threadId))
  const mailboxes = useMailboxes()
  const sentId = findMailboxIdByRole(mailboxes.data ?? [], 'sent')
  const emails = useMemo(
    () =>
      (query.data?.emails ?? []).filter(
        email =>
          email.id === emailId ||
          !isOwnSentCopy(email, sentId, session.username)
      ),
    [query.data, emailId, sentId, session.username]
  )

  // Its last message deleted, the conversation is gone: back to the list
  const hasEmails = emails.length > 0
  const hadEmailsRef = useRef(false)
  useEffect(() => {
    if (hasEmails) {
      hadEmailsRef.current = true
    } else if (hadEmailsRef.current) {
      hadEmailsRef.current = false
      onBack()
    }
  }, [hasEmails, onBack])

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
  if (emails.length === 0) {
    return (
      <Empty
        icon={EmailOpen}
        title={t('thread.empty')}
        data-testid="email-not-found"
      />
    )
  }
  return (
    <ConversationContent
      emails={emails}
      openedId={emailId}
      mailboxId={mailboxId}
      fromList={fromList}
      onBack={onBack}
      navigation={navigation}
    />
  )
}
