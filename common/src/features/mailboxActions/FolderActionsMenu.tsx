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

import { isPersonalMailbox } from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'
import { useMailboxRights } from '@common/features/mailbox/useMailboxRights'
import { useRecovery } from '@common/features/recovery/RecoveryProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { useI18n } from '@common/i18n/useI18n'

import { useFolderActionProgress } from './FolderActionProgress'
import {
  availableFolderActions,
  type FolderActionId
} from './folderActionItems'
import { useFolderActions } from './FolderActionsProvider'
import {
  isSubaddressingAllowed,
  isSubaddressingSupported
} from './subaddressing'

/** The actions that show their progress above the list */
const LONG_ACTIONS: readonly FolderActionId[] = [
  'mark-as-read',
  'empty-trash',
  'empty-spam'
]

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
 * key or Shift+F10): the actions `availableFolderActions` gives it, the
 * long ones disabled while one runs. It closes before the action runs,
 * giving the focus back to the folder.
 */
export function FolderActionsMenu({
  mailbox,
  anchor,
  onClose
}: FolderActionsMenuProps): ReactElement {
  const { t } = useI18n()
  const recovery = useRecovery()
  const { data: mailboxes = [] } = useMailboxes()
  const { session, accountId } = useJmapSession()
  const { run } = useFolderActions()
  // Sub-addressing, for a personal folder of a server that delivers it:
  // whether it is on is read from the rights of the folder, at each opening
  const hasSubaddressing =
    mailbox !== null &&
    anchor !== null &&
    mailbox.role === null &&
    isPersonalMailbox(mailbox) &&
    isSubaddressingSupported(session, accountId)
  const rights = useMailboxRights(hasSubaddressing ? mailbox.id : null)
  // One long folder action at a time, as tmail-flutter
  const isLongActionRunning = useFolderActionProgress().progress !== null
  // Opening a folder in a new tab is a link: the browser does it
  const newTabHref = useHref(
    `/mailbox/${encodeURIComponent(mailbox?.id ?? '')}`
  )
  const items =
    mailbox === null || anchor === null
      ? []
      : availableFolderActions(mailbox, mailboxes, {
          canRecover: recovery.isAvailable,
          canFilter: LINAGORA_CAPABILITIES.filter in session.capabilities,
          subaddressing: hasSubaddressing
            ? {
                isAllowed: rights.isSuccess
                  ? isSubaddressingAllowed(rights.data)
                  : null
              }
            : null
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
          disabled={isLongActionRunning && LONG_ACTIONS.includes(item.id)}
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
