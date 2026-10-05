import {
  Eye,
  EyeClosed,
  FolderAdd,
  Filter,
  FolderMoveto,
  Moveto,
  Rename,
  Restore,
  Tab,
  Trash,
  EmailOpen,
  type IconProps
} from '@linagora/twake-icons'

import {
  isHiddenMailbox,
  isPersonalMailbox,
  isTeamTrash
} from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import type { TranslationKey } from '@common/i18n/useI18n'

export type FolderActionId =
  | 'open-in-new-tab'
  | 'new-subfolder'
  | 'mark-as-read'
  | 'empty-trash'
  | 'empty-spam'
  | 'create-filter'
  | 'move'
  | 'move-content'
  | 'rename'
  | 'hide'
  | 'show'
  | 'delete'
  | 'recover-deleted-messages'

export interface FolderActionItem {
  id: FolderActionId
  label: TranslationKey
  icon: IconProps['icon']
  isDestructive: boolean
}

const ITEMS: Record<FolderActionId, Omit<FolderActionItem, 'id'>> = {
  'open-in-new-tab': {
    label: 'folders.menu.openInNewTab',
    icon: Tab,
    isDestructive: false
  },
  'create-filter': {
    label: 'folders.menu.createFilter',
    icon: Filter,
    isDestructive: false
  },
  'move-content': {
    label: 'folders.menu.moveContent',
    icon: Moveto,
    isDestructive: false
  },
  'new-subfolder': {
    label: 'folders.menu.newSubfolder',
    icon: FolderAdd,
    isDestructive: false
  },
  'mark-as-read': {
    label: 'email.markAsRead',
    icon: EmailOpen,
    isDestructive: false
  },
  'empty-trash': {
    label: 'folders.menu.emptyTrash',
    icon: Trash,
    isDestructive: true
  },
  'empty-spam': {
    label: 'folders.menu.emptySpam',
    icon: Trash,
    isDestructive: true
  },
  move: {
    label: 'folders.menu.move',
    icon: FolderMoveto,
    isDestructive: false
  },
  rename: { label: 'folders.menu.rename', icon: Rename, isDestructive: false },
  hide: { label: 'folders.menu.hide', icon: EyeClosed, isDestructive: false },
  show: { label: 'folders.menu.show', icon: Eye, isDestructive: false },
  delete: { label: 'folders.menu.delete', icon: Trash, isDestructive: true },
  'recover-deleted-messages': {
    label: 'recovery.title',
    icon: Restore,
    isDestructive: false
  }
}

function item(id: FolderActionId): FolderActionItem {
  return { id, ...ITEMS[id] }
}

export interface FolderActionOptions {
  /** The server keeps deleted emails: the Trash recovers them */
  canRecover?: boolean
  /** The server has filtering rules: a folder starts one */
  canFilter?: boolean
}

/**
 * The actions of a folder, as tmail-flutter's folder menu:
 *
 * - every folder not hidden: open in a new tab;
 * - a system folder: new subfolder, create a filter, then, for the Trash,
 *   move its content, "Empty Trash" and recover deleted messages; for Spam,
 *   move its content and "Delete all spam emails" (when not empty); for the
 *   others, "Mark as read" and move their content (when they hold unread
 *   emails);
 * - a personal folder: new subfolder, create a filter, mark as read, move,
 *   move its content, rename, hide or show, delete;
 * - a team mailbox folder, as its rights allow (`myRights`): new subfolder,
 *   mark as read, rename, hide or show (its root only), empty its Trash,
 *   delete. Team folders do not move, their content does not either, and
 *   they start no filter.
 *
 * Moving the content needs `mayRemoveItems` and something to move.
 */
export function availableFolderActions(
  mailbox: MailboxSummary,
  mailboxes: readonly MailboxSummary[],
  { canRecover = false, canFilter = false }: FolderActionOptions = {}
): FolderActionItem[] {
  const rights = mailbox.myRights
  // Marking a folder read sets `$seen` on its emails
  const hasUnread = mailbox.unreadEmails > 0 && rights.maySetSeen
  const hasChildren = mailboxes.some(other => other.parentId === mailbox.id)
  const ids: FolderActionId[] = []
  const visibility: FolderActionId = isHiddenMailbox(mailbox) ? 'show' : 'hide'
  const canMoveContent = rights.mayRemoveItems && mailbox.totalEmails > 0
  if (mailbox.role !== null || !isHiddenMailbox(mailbox)) {
    ids.push('open-in-new-tab')
  }

  if (!isPersonalMailbox(mailbox)) {
    if (rights.mayCreateChild) ids.push('new-subfolder')
    if (hasUnread) ids.push('mark-as-read')
    if (rights.mayRename && mailbox.parentId !== null) ids.push('rename')
    if (mailbox.parentId === null) ids.push(visibility)
    if (
      isTeamTrash(mailbox) &&
      rights.mayRemoveItems &&
      (mailbox.totalEmails > 0 || hasChildren)
    ) {
      ids.push('empty-trash')
    }
    if (rights.mayDelete && mailbox.parentId !== null) ids.push('delete')
    return ids.map(item)
  }

  if (rights.mayCreateChild) ids.push('new-subfolder')
  if (canFilter) ids.push('create-filter')
  if (mailbox.role === 'trash') {
    if (canMoveContent) ids.push('move-content')
    if (mailbox.totalEmails > 0 || hasChildren) ids.push('empty-trash')
    if (canRecover) ids.push('recover-deleted-messages')
  } else if (mailbox.role === 'junk') {
    if (canMoveContent) ids.push('move-content')
    if (mailbox.totalEmails > 0) ids.push('empty-spam')
  } else if (mailbox.role !== null) {
    // tmail-flutter offers it to the other system folders along with
    // "Mark as read" only: with something unread
    if (hasUnread) ids.push('mark-as-read')
    if (canMoveContent && mailbox.unreadEmails > 0) ids.push('move-content')
  } else {
    if (hasUnread) ids.push('mark-as-read')
    ids.push('move')
    if (canMoveContent) ids.push('move-content')
    ids.push('rename', visibility)
    if (rights.mayDelete) ids.push('delete')
  }
  return ids.map(item)
}
