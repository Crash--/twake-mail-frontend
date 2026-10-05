import { Icon } from '@linagora/twake-icons'
import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  type PopoverPosition
} from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useRecovery } from '@common/features/recovery/RecoveryProvider'
import { useI18n } from '@common/i18n/useI18n'

import { availableFolderActions } from './folderActionItems'
import { useFolderActions } from './FolderActionsProvider'

export type FolderMenuAnchor =
  { element: HTMLElement } | { position: PopoverPosition }

export interface FolderActionsMenuProps {
  /** The folder whose menu is open, null when closed */
  mailbox: MailboxSummary | null
  anchor: FolderMenuAnchor | null
  onClose: () => void
}

/**
 * The menu of a folder of the tree (its ⋮ button, a right click, the menu
 * key or Shift+F10): the actions `availableFolderActions` gives it. It
 * closes before the action runs, giving the focus back to the folder.
 */
export function FolderActionsMenu({
  mailbox,
  anchor,
  onClose
}: FolderActionsMenuProps): ReactElement {
  const { t } = useI18n()
  const recovery = useRecovery()
  const { data: mailboxes = [] } = useMailboxes()
  const { run } = useFolderActions()
  const items =
    mailbox === null || anchor === null
      ? []
      : availableFolderActions(mailbox, mailboxes, {
          canRecover: recovery.isAvailable
        })

  return (
    <Menu
      open={mailbox !== null && anchor !== null}
      onClose={onClose}
      {...(anchor !== null && 'position' in anchor
        ? { anchorReference: 'anchorPosition', anchorPosition: anchor.position }
        : { anchorEl: anchor?.element ?? null })}
      slotProps={{ list: { 'aria-label': t('folders.menu.label') } }}
      data-testid="mailbox-context-menu"
    >
      {items.map(item => (
        <MenuItem
          key={item.id}
          onClick={() => {
            onClose()
            if (mailbox !== null) run(item.id, mailbox)
          }}
          data-testid={`mailbox-action-${item.id}`}
        >
          <ListItemIcon>
            <Icon icon={item.icon} />
          </ListItemIcon>
          <ListItemText
            primary={t(item.label)}
            slotProps={{
              primary: { color: item.isDestructive ? 'error.dark' : 'inherit' }
            }}
          />
        </MenuItem>
      ))}
    </Menu>
  )
}
