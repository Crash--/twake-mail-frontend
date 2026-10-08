import {
  Archive,
  Dots,
  FolderMoveto,
  Reply,
  Star,
  StarOutline,
  Trash
} from '@linagora/twake-icons'
import { Box } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import { IconAction } from '@/ds/IconAction/IconAction'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import {
  availableEmailActions,
  type EmailActionId
} from '@common/features/emailActions/emailActionItems'
import { EmailActionsMenu } from '@common/features/emailActions/EmailActionsMenu'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useLabelsAvailable } from '@common/features/labels/queries'
import { useI18n } from '@common/i18n/useI18n'

import { FLAGGED, hasKeyword } from './keywords'
import type { EmailDetail } from './queries'
import { useReplyOptions } from './useReplyOptions'
import {
  useRunViewedEmailAction,
  viewedEmailExtras
} from './useRunViewedEmailAction'
import { useUnsubscribe } from './useUnsubscribe'

/**
 * The actions shown as buttons, from the tablet size, between "Reply" and
 * "More" (the star and the delete button are the same in both): "Move" for
 * an email, "Archive" for a message of a conversation
 */
const MOVES: Record<EmailViewActionsVariant, EmailActionId> = {
  email: 'move',
  // As tmail-flutter's header, on every message
  message: 'move'
}

/** The delete button: the folder offers one of these, never both */
const DELETIONS: readonly EmailActionId[] = [
  'move-to-trash',
  'delete-permanently'
]

/** An open email, or an expanded message of a conversation */
export type EmailViewActionsVariant = 'email' | 'message'

export interface EmailViewActionsProps {
  email: EmailDetail
  /** The folder the email is open from, null from search results */
  mailboxId: string | null
  /** After an action changed the email: the single view closes on unread */
  onAction: (id: EmailActionId) => void
  /** Fewer buttons for a message of a conversation */
  variant?: EmailViewActionsVariant
  /**
   * Names the group of actions, e.g. with the sender and date of a message
   * among others
   */
  label?: string
}

/**
 * The actions of an open email, in its header, or of a message of a
 * conversation: reply, move, star and delete as
 * icon buttons (the star and "More" only on phones), and every action in
 * "More". An email leaving the folder closes the view
 * (`useEmailViewShortcuts`).
 */
export function EmailViewActions({
  email,
  mailboxId,
  onAction,
  variant = 'email',
  label
}: EmailViewActionsProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const { data: mailboxes = [] } = useMailboxes()
  const canLabel = useLabelsAvailable()
  const runAction = useRunViewedEmailAction()
  const { canUnsubscribe } = useUnsubscribe()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const replies = useReplyOptions(email)
  const mailbox =
    mailboxes.find(candidate => candidate.id === mailboxId) ?? null
  const items = availableEmailActions([email], mailbox, mailboxes, {
    canLabel,
    extras: viewedEmailExtras(email, canUnsubscribe(email))
  })
  const move = items.find(item => item.id === MOVES[variant])
  const deletion = items.find(item => DELETIONS.includes(item.id))
  const isStarred = hasKeyword(email, FLAGGED)
  // A toggle keeps its name: aria-pressed carries the state
  const starLabel = t('email.starred')
  const moreLabel = t('emailActions.menu.more')
  const replyLabel = t('emailActions.reply.reply')

  const handleRun = (id: EmailActionId): void => {
    void runAction(id, email, mailboxId).then(done => {
      if (done) onAction(id)
    })
  }

  return (
    <Box
      role={label === undefined ? undefined : 'group'}
      aria-label={label}
      className="u-flex u-flex-items-center u-flex-justify-end"
      data-testid="email-view-actions"
    >
      {isPhone || replies.actions.length === 0 ? null : (
        <IconAction
          tone="steel"
          label={replyLabel}
          icon={Reply}
          onClick={() => {
            replies.open('reply')
          }}
          data-testid="email-view-action-reply"
        />
      )}
      {isPhone || move === undefined ? null : (
        <IconAction
          tone="steel"
          label={t(move.label)}
          icon={move.id === 'move' ? FolderMoveto : Archive}
          onClick={() => {
            handleRun(move.id)
          }}
          data-testid={`email-view-action-${move.id}`}
        />
      )}
      <IconAction
        label={starLabel}
        icon={isStarred ? Star : StarOutline}
        tone={isStarred ? 'starred' : 'steel'}
        aria-pressed={isStarred}
        onClick={() => {
          handleRun(isStarred ? 'unstar' : 'star')
        }}
        data-testid="email-view-star-button"
      />
      {isPhone || deletion === undefined ? null : (
        <IconAction
          tone="steel"
          label={t(deletion.label)}
          icon={Trash}
          onClick={() => {
            handleRun(deletion.id)
          }}
          data-testid={`email-view-action-${deletion.id}`}
        />
      )}
      <IconAction
        tone="steel"
        label={moreLabel}
        icon={Dots}
        aria-haspopup="menu"
        aria-expanded={menuAnchor !== null}
        onClick={event => {
          setMenuAnchor(event.currentTarget)
        }}
        data-testid="email-view-more-button"
      />
      <EmailActionsMenu
        anchor={menuAnchor === null ? null : { element: menuAnchor }}
        onClose={() => {
          setMenuAnchor(null)
        }}
        emails={[email]}
        mailboxId={mailboxId}
        onAction={onAction}
        replies={replies.actions}
        detail={email}
        data-testid="email-view-menu"
      />
    </Box>
  )
}
