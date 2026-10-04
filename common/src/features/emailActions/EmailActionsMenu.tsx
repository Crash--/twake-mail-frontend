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

import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useI18n } from '@common/i18n/useI18n'

import {
  availableEmailActions,
  type EmailActionId,
  type EmailActionItem
} from './emailActionItems'
import type { TargetEmail } from './planEmailChanges'
import { useRunEmailAction } from './useRunEmailAction'

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
  'data-testid': testId = 'email-actions-menu'
}: EmailActionsMenuProps): ReactElement {
  const { t } = useI18n()
  const { data: mailboxes = [] } = useMailboxes()
  const runAction = useRunEmailAction()
  const mailbox =
    mailboxes.find(candidate => candidate.id === mailboxId) ?? null
  const items =
    anchor === null
      ? []
      : availableEmailActions(emails, mailbox, mailboxes).filter(
          item => !exclude.includes(item.id)
        )

  const handleRun = (item: EmailActionItem): void => {
    onClose()
    void runAction(item.id, emails, mailboxId).then(done => {
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
                primary: { color: item.isDestructive ? 'error' : 'inherit' }
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
