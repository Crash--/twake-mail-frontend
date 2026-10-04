import { Dots, Icon, Star, StarOutline } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import {
  availableEmailActions,
  type EmailActionId
} from '@common/features/emailActions/emailActionItems'
import { EmailActionsMenu } from '@common/features/emailActions/EmailActionsMenu'
import { useRunEmailAction } from '@common/features/emailActions/useRunEmailAction'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useI18n } from '@common/i18n/useI18n'

import { FLAGGED, hasKeyword } from './keywords'
import type { EmailDetail } from './queries'

/** The actions shown as buttons beside "More", from the tablet size */
const BUTTONS: readonly EmailActionId[] = [
  'archive',
  'move-to-trash',
  'delete-permanently',
  'mark-as-unread',
  'move',
  'mark-as-spam',
  'not-spam'
]

export interface EmailViewActionsProps {
  email: EmailDetail
  /** The folder the email is open from, null from search results */
  mailboxId: string | null
  /** Back to the list: an email marked unread is closed, as tmail-flutter */
  onLeave: () => void
}

/**
 * The actions of an open email, beside its back button: the star, the main
 * actions as buttons (not on phones), and every action in "More". An email
 * leaving the folder closes the view (`useEmailViewShortcuts`).
 */
export function EmailViewActions({
  email,
  mailboxId,
  onLeave
}: EmailViewActionsProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const { data: mailboxes = [] } = useMailboxes()
  const runAction = useRunEmailAction()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const mailbox =
    mailboxes.find(candidate => candidate.id === mailboxId) ?? null
  const items = availableEmailActions([email], mailbox, mailboxes)
  const buttons = isPhone ? [] : items.filter(item => BUTTONS.includes(item.id))
  const isStarred = hasKeyword(email, FLAGGED)
  const starLabel = t(isStarred ? 'email.unstar' : 'email.star')
  const moreLabel = t('emailActions.menu.more')

  const handleAction = (id: EmailActionId): void => {
    if (id === 'mark-as-unread') onLeave()
  }
  const handleRun = (id: EmailActionId): void => {
    void runAction(id, [email], mailboxId).then(done => {
      if (done) handleAction(id)
    })
  }

  return (
    <Box
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
        onAction={handleAction}
        data-testid="email-view-menu"
      />
    </Box>
  )
}
