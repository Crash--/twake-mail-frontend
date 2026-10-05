import { Dots, Icon, Star, StarOutline } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

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

/** The actions shown as buttons beside "More", from the tablet size */
const BUTTONS: Record<EmailViewActionsVariant, readonly EmailActionId[]> = {
  email: [
    'archive',
    'move-to-trash',
    'delete-permanently',
    'mark-as-unread',
    'move',
    'mark-as-spam',
    'not-spam',
    'print'
  ],
  // A message of a conversation: the most used ones, the rest in "More"
  message: ['mark-as-unread', 'move-to-trash', 'delete-permanently']
}

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
 * The actions of an open email, beside its back button, or of a message of
 * a conversation: the star, the main actions as buttons (not on phones),
 * and every action in "More". An email leaving the folder closes the view
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
  const buttons = isPhone
    ? []
    : items.filter(item => BUTTONS[variant].includes(item.id))
  const isStarred = hasKeyword(email, FLAGGED)
  const starLabel = t(isStarred ? 'email.unstar' : 'email.star')
  const moreLabel = t('emailActions.menu.more')

  const handleRun = (id: EmailActionId): void => {
    void runAction(id, email, mailboxId).then(done => {
      if (done) onAction(id)
    })
  }

  return (
    <Box
      role={label === undefined ? undefined : 'group'}
      aria-label={label}
      className="u-flex u-flex-items-center u-flex-auto u-flex-justify-end"
      data-testid="email-view-actions"
    >
      <Tooltip title={starLabel}>
        <IconButton
          aria-label={starLabel}
          aria-pressed={isStarred}
          color={isStarred ? 'warning' : 'default'}
          onClick={() => {
            handleRun(isStarred ? 'unstar' : 'star')
          }}
          data-testid="email-view-star-button"
        >
          <Icon icon={isStarred ? Star : StarOutline} />
        </IconButton>
      </Tooltip>
      {buttons.map(item => (
        <Tooltip key={item.id} title={t(item.label)}>
          <IconButton
            aria-label={t(item.label)}
            onClick={() => {
              handleRun(item.id)
            }}
            data-testid={`email-view-action-${item.id}`}
          >
            <Icon icon={item.icon} />
          </IconButton>
        </Tooltip>
      ))}
      <Tooltip title={moreLabel}>
        <IconButton
          aria-label={moreLabel}
          aria-haspopup="menu"
          aria-expanded={menuAnchor !== null}
          onClick={event => {
            setMenuAnchor(event.currentTarget)
          }}
          data-testid="email-view-more-button"
        >
          <Icon icon={Dots} />
        </IconButton>
      </Tooltip>
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
