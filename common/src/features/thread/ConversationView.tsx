import {
  Archive,
  Email as EmailIcon,
  EmailOpen,
  Icon,
  Left,
  Star,
  StarOutline,
  Trash,
  Warning
} from '@linagora/twake-icons'
import {
  Box,
  Empty,
  IconButton,
  ListSkeleton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { MessageThread } from '@/ds/MessageThread/MessageThread'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useDocumentTitle } from '@common/app/useDocumentTitle'
import { formatAddressName } from '@common/features/email/addresses'
import { FLAGGED, hasKeyword, SEEN } from '@common/features/email/keywords'
import { findMailboxIdByRole } from '@common/features/mailbox/mailboxTree'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import {
  useEmailActions,
  type EmailActionName
} from '@common/features/emailActions/useEmailActions'
import { EmailLabels } from '@common/features/labels/EmailLabels'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { ConversationMessage } from './ConversationMessage'
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

interface ConversationContentProps {
  emails: EmailListItemData[]
  openedId: string
  onBack: () => void
}

function ConversationContent({
  emails,
  openedId,
  onBack
}: ConversationContentProps): ReactElement {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(() =>
    initiallyExpanded(emails, openedId)
  )
  // The messages there when it opened: the others arrived since
  const [initialIds] = useState(() => new Set(emails.map(email => email.id)))
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

  // The list the conversation replaces is gone: the focus moves to its
  // subject, where a screen reader starts reading
  useEffect(() => {
    subjectRef.current?.focus()
  }, [])

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

  const backLabel = t('common.back')
  const readLabel = t(isRead ? 'email.markAsUnread' : 'email.markAsRead')
  const starLabel = t(isStarred ? 'email.unstar' : 'email.star')
  const lastSender = lastArrived?.from?.[0] ?? null

  return (
    <Box className="u-p-1" data-testid="conversation-view">
      <Box
        role="toolbar"
        aria-label={t('thread.actions')}
        className="u-flex u-flex-items-center u-mb-1"
      >
        <Tooltip title={backLabel}>
          <IconButton
            aria-label={backLabel}
            onClick={onBack}
            data-testid="email-view-back-button"
          >
            <Icon icon={Left} />
          </IconButton>
        </Tooltip>
        <Tooltip title={readLabel}>
          <IconButton
            aria-label={readLabel}
            onClick={handleToggleRead}
            data-testid="conversation-toggle-seen"
          >
            <Icon icon={isRead ? EmailIcon : EmailOpen} />
          </IconButton>
        </Tooltip>
        <Tooltip title={starLabel}>
          <IconButton
            aria-label={starLabel}
            aria-pressed={isStarred}
            color={isStarred ? 'warning' : 'default'}
            onClick={handleToggleStar}
            data-testid="conversation-toggle-star"
          >
            <Icon icon={isStarred ? Star : StarOutline} />
          </IconButton>
        </Tooltip>
        {moves.map(move => (
          <Tooltip key={move.action} title={move.label}>
            <IconButton
              aria-label={move.label}
              onClick={handleMove(move.action)}
              data-testid={move.testId}
            >
              <Icon icon={move.icon} />
            </IconButton>
          </Tooltip>
        ))}
      </Box>
      <Box className="u-ph-1">
        <Typography
          ref={subjectRef}
          variant="h3"
          component="h1"
          tabIndex={-1}
          className="u-breakword"
          data-testid="conversation-subject"
        >
          {subject}
        </Typography>
        <EmailLabels emails={emails} mailboxId={null} />
        <SecondaryText
          variant="body2"
          component="p"
          className="u-mb-1"
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
            onRemoteContentShown={handleFocusSubject}
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
    </Box>
  )
}

export interface ConversationViewProps {
  /** The email opened: the conversation is its thread */
  threadId: string
  emailId: string
  onBack: () => void
}

/**
 * An email shown with its whole conversation, when the "Thread" setting is
 * on (`Thread/get`, then the `Email/get` of its emails), the oldest first.
 * Unread messages, the last one and the one opened are expanded (and the
 * unread ones marked read, in one request), the others collapsed; a reply
 * arriving while it is open joins it collapsed (push) and is announced.
 */
export function ConversationView({
  threadId,
  emailId,
  onBack
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
    <ConversationContent emails={emails} openedId={emailId} onBack={onBack} />
  )
}
