import { Icon } from '@linagora/twake-icons'
import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  type PopoverPosition
} from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { Reply, Share } from '@/ds/FlutterIcons/FlutterIcons'
import { useComposer } from '@common/features/composer/ComposerProvider'
import type { ReplyAction } from '@common/features/composer/replyRecipients'
import type { EmailDetail } from '@common/features/email/queries'
import {
  useRunViewedEmailAction,
  viewedEmailExtras
} from '@common/features/email/useRunViewedEmailAction'
import { useUnsubscribe } from '@common/features/email/useUnsubscribe'
import { REPLY_LABELS } from '@common/features/email/useReplyOptions'
import { isDraftsMailbox } from '@common/features/mailbox/mailboxTree'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useLabelsAvailable } from '@common/features/labels/queries'
import { useI18n } from '@common/i18n/useI18n'

import {
  availableEmailActions,
  type EmailActionId,
  type EmailActionItem
} from './emailActionItems'
import type { TargetEmail } from './planEmailChanges'
import { useRunEmailAction } from './useRunEmailAction'

const REPLY_MENU_IDS: Record<ReplyAction, string> = {
  reply: 'reply',
  replyAll: 'reply-all',
  replyToList: 'reply-to-list',
  forward: 'forward'
}

/** Where the menu opens: under a button or row, or at the mouse pointer */
export type EmailActionsMenuAnchor =
  { element: HTMLElement } | { position: PopoverPosition }

export interface EmailActionsMenuProps {
  /** Null when closed */
  anchor: EmailActionsMenuAnchor | null
  onClose: () => void
  emails: readonly TargetEmail[]
  /** The folder shown, null in search results */
  mailboxId: string | null
  /** Leaves out actions shown elsewhere (the buttons beside the menu) */
  exclude?: readonly EmailActionId[]
  /** After an action ran (e.g. to clear the selection) */
  onAction?: (id: EmailActionId) => void
  /**
   * The answers offered first, for one email: by default reply, reply all
   * and forward, none in Drafts
   */
  replies?: readonly ReplyAction[]
  /**
   * The email the answers go to: by default the email when there is one; a
   * conversation row gives the email standing for it (its newest in the
   * folder, the one its conversation opens on)
   */
  answerEmailId?: string | null
  /**
   * The open email, when the menu is its "More" menu: adds the actions
   * that need all of it (Print, Download as EML, Unsubscribe)
   */
  detail?: EmailDetail
  'data-testid'?: string
}

/**
 * The actions on one email or a selection, in a menu: from the ⋮ button of a
 * row, a right click or the context menu key on a row, the "More" button of
 * an open email or of the selection toolbar. Items are grouped as in
 * tmail-flutter; the menu closes before the action runs, giving the focus
 * back to what opened it.
 */
export function EmailActionsMenu({
  anchor,
  onClose,
  emails,
  mailboxId,
  exclude = [],
  onAction,
  replies,
  answerEmailId,
  detail,
  'data-testid': testId = 'email-actions-menu'
}: EmailActionsMenuProps): ReactElement {
  const { t } = useI18n()
  const { data: mailboxes = [] } = useMailboxes()
  const canLabel = useLabelsAvailable()
  const runAction = useRunEmailAction()
  const runViewedAction = useRunViewedEmailAction()
  const { canUnsubscribe } = useUnsubscribe()
  const { openComposer } = useComposer()
  const mailbox =
    mailboxes.find(candidate => candidate.id === mailboxId) ?? null
  const single = emails.length === 1 ? emails[0] : undefined
  const answered = answerEmailId ?? single?.id ?? null
  const answers: readonly ReplyAction[] =
    anchor === null || answered === null
      ? []
      : (replies ??
        (mailbox !== null && isDraftsMailbox(mailbox)
          ? []
          : ['reply', 'replyAll', 'forward']))
  const items =
    anchor === null
      ? []
      : availableEmailActions(emails, mailbox, mailboxes, {
          canLabel,
          extras:
            detail !== undefined
              ? viewedEmailExtras(detail, canUnsubscribe(detail))
              : ['edit-as-new']
        }).filter(item => !exclude.includes(item.id))

  const handleReply = (action: ReplyAction): void => {
    onClose()
    if (answered !== null)
      openComposer({ reply: { emailId: answered, action } })
  }

  const replyItems = answers.map(action => (
    <MenuItem
      key={action}
      onClick={() => {
        handleReply(action)
      }}
      data-testid={`email-action-${REPLY_MENU_IDS[action]}`}
    >
      <ListItemIcon>
        <Icon icon={action === 'forward' ? Share : Reply} />
      </ListItemIcon>
      <ListItemText primary={t(REPLY_LABELS[action])} />
    </MenuItem>
  ))

  const handleRun = (item: EmailActionItem): void => {
    onClose()
    let running: Promise<boolean>
    if (detail !== undefined) {
      running = runViewedAction(item.id, detail, mailboxId)
    } else if (item.id === 'edit-as-new') {
      if (answered !== null) openComposer({ editAsNewEmailId: answered })
      running = Promise.resolve(false)
    } else {
      running = runAction(item.id, emails, mailboxId)
    }
    void running.then(done => {
      if (done) onAction?.(item.id)
    })
  }

  return (
    <Menu
      open={anchor !== null}
      onClose={onClose}
      {...(anchor !== null && 'position' in anchor
        ? { anchorReference: 'anchorPosition', anchorPosition: anchor.position }
        : { anchorEl: anchor?.element ?? null })}
      slotProps={{ list: { 'aria-label': t('emailActions.menu.label') } }}
      data-testid={testId}
    >
      {/* No Fragment: Menu reads its children for the keyboard focus */}
      {replyItems}
      {replyItems.length > 0 && items.length > 0 ? (
        <Divider key="divider-replies" />
      ) : null}
      {items.flatMap((item, index) => {
        const menuItem = (
          <MenuItem
            key={item.id}
            onClick={() => {
              handleRun(item)
            }}
            data-testid={`email-action-${item.id}`}
          >
            <ListItemIcon>
              <Icon icon={item.icon} />
            </ListItemIcon>
            <ListItemText
              primary={t(item.label)}
              slotProps={{
                primary: {
                  color: item.isDestructive ? 'error.dark' : 'inherit'
                }
              }}
            />
          </MenuItem>
        )
        return index > 0 && items[index - 1]?.group !== item.group
          ? [<Divider key={`divider-${item.id}`} />, menuItem]
          : [menuItem]
      })}
    </Menu>
  )
}
