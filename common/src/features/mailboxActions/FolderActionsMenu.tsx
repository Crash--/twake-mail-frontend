import { Icon } from '@linagora/twake-icons'
import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  type PopoverPosition
} from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'
import { useHref } from 'react-router'

import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useRecovery } from '@common/features/recovery/RecoveryProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { useI18n } from '@common/i18n/useI18n'

import { availableFolderActions } from './folderActionItems'
import { useFolderActions } from './FolderActionsProvider'

/**
 * Where the menu opens: beside `element`, or at the `position` of a right
 * click on the row `element`; the actions find the row of the folder there
 */
export type FolderMenuAnchor =
  { element: HTMLElement } | { position: PopoverPosition; element: HTMLElement }

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
  const { session } = useJmapSession()
  const { run } = useFolderActions()
  // Opening a folder in a new tab is a link: the browser does it
  const newTabHref = useHref(
    `/mailbox/${encodeURIComponent(mailbox?.id ?? '')}`
  )
  const items =
    mailbox === null || anchor === null
      ? []
      : availableFolderActions(mailbox, mailboxes, {
          canRecover: recovery.isAvailable,
          canFilter: LINAGORA_CAPABILITIES.filter in session.capabilities
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
          {...(item.id === 'open-in-new-tab'
            ? {
                component: 'a',
                href: newTabHref,
                target: '_blank',
                rel: 'noopener noreferrer'
              }
            : {})}
          onClick={() => {
            onClose()
            if (mailbox !== null) {
              run(item.id, mailbox, anchor?.element ?? null)
            }
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
