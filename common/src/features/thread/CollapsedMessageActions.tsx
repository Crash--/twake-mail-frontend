import { useState, type ReactElement } from 'react'

import {
  Dots,
  MoveEmail,
  Reply,
  Star,
  StarOutline,
  Trash
} from '@/ds/FlutterIcons/FlutterIcons'
import { IconAction } from '@/ds/IconAction/IconAction'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { FLAGGED, hasKeyword } from '@common/features/email/keywords'
import { messageMailboxId } from '@common/features/email/messageMailbox'
import {
  availableEmailActions,
  type EmailActionId
} from '@common/features/emailActions/emailActionItems'
import { EmailActionsMenu } from '@common/features/emailActions/EmailActionsMenu'
import { useRunEmailAction } from '@common/features/emailActions/useRunEmailAction'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { useLabelsAvailable } from '@common/features/labels/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useI18n } from '@common/i18n/useI18n'

import type { EmailListItemData } from './queries'

export interface CollapsedMessageActionsProps {
  email: EmailListItemData
  /** The folder the conversation is open from, null from search results */
  openedMailboxId: string | null
  /** After an action of the message changed it */
  onAction: (id: EmailActionId) => void
  /** Names the group, e.g. with the sender and date of the message */
  label: string
}

/**
 * The actions of a message of a conversation that is not expanded, in its
 * row: reply, move, star, delete and "More" (as tmail-flutter's header). The message is not loaded
 * in full: what a list row knows of it is enough for them, so the actions
 * that need all of it (Print, Download as EML, Unsubscribe) wait for it to be
 * expanded.
 */
export function CollapsedMessageActions({
  email,
  openedMailboxId,
  onAction,
  label
}: CollapsedMessageActionsProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const { data: mailboxes = [] } = useMailboxes()
  const canLabel = useLabelsAvailable()
  const runAction = useRunEmailAction()
  const { openComposer } = useComposer()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const mailboxId = messageMailboxId(email, openedMailboxId, mailboxes)
  const mailbox =
    mailboxes.find(candidate => candidate.id === mailboxId) ?? null
  const items = availableEmailActions([email], mailbox, mailboxes, {
    canLabel,
    extras: ['edit-as-new']
  })
  const move = items.find(item => item.id === 'move')
  const deletion = items.find(
    item => item.id === 'move-to-trash' || item.id === 'delete-permanently'
  )
  const isStarred = hasKeyword(email, FLAGGED)
  // A toggle keeps its name: aria-pressed carries the state
  const starLabel = t('email.starred')
  const moreLabel = t('emailActions.menu.more')

  const handleRun = (id: EmailActionId): void => {
    void runAction(id, [email], mailboxId).then(done => {
      if (done) onAction(id)
    })
  }

  return (
    <div
      role="group"
      aria-label={label}
      className="u-flex u-flex-items-center"
      data-testid="conversation-message-row-actions"
    >
      {isPhone ? null : (
        <IconAction
          tone="steel"
          label={t('emailActions.reply.reply')}
          icon={Reply}
          onClick={() => {
            openComposer({ reply: { emailId: email.id, action: 'reply' } })
          }}
          data-testid="email-view-action-reply"
        />
      )}
      {isPhone || move === undefined ? null : (
        <IconAction
          tone="steel"
          label={t(move.label)}
          icon={MoveEmail}
          onClick={() => {
            handleRun(move.id)
          }}
          data-testid="email-view-action-move"
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
        data-testid="email-view-menu"
      />
    </div>
  )
}
