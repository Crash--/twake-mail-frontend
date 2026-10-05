import {
  Eye,
  EyeClosed,
  FolderAdd,
  FolderMoveto,
  Rename,
  Restore,
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
  | 'new-subfolder'
  | 'mark-as-read'
  | 'empty-trash'
  | 'empty-spam'
  | 'move'
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

/**
 * The actions of a folder, as tmail-flutter's folder menu:
 *
 * - a system folder: new subfolder, then "Empty Trash" for the Trash and
 *   "Delete all spam emails" for Spam (when not empty), "Mark as read"
 *   for the others (when they hold unread emails);
 * - a personal folder: new subfolder, mark as read, move, rename, hide or
 *   show, delete;
 * - a team mailbox folder, as its rights allow (`myRights`): new subfolder,
 *   mark as read, rename, hide or show (its root only), empty its Trash,
 *   delete. Team folders do not move.
 */
export function availableFolderActions(
  mailbox: MailboxSummary,
  mailboxes: readonly MailboxSummary[],
  /** The server keeps deleted emails: the Trash recovers them */
  { canRecover = false }: { canRecover?: boolean } = {}
): FolderActionItem[] {
  const rights = mailbox.myRights
  // Marking a folder read sets `$seen` on its emails
  const hasUnread = mailbox.unreadEmails > 0 && rights.maySetSeen
  const hasChildren = mailboxes.some(other => other.parentId === mailbox.id)
  const ids: FolderActionId[] = []
  const visibility: FolderActionId = isHiddenMailbox(mailbox) ? 'show' : 'hide'

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
  if (mailbox.role === 'trash') {
    if (mailbox.totalEmails > 0 || hasChildren) ids.push('empty-trash')
    if (canRecover) ids.push('recover-deleted-messages')
  } else if (mailbox.role === 'junk') {
    if (mailbox.totalEmails > 0) ids.push('empty-spam')
  } else if (hasUnread) {
    ids.push('mark-as-read')
  }
  if (mailbox.role === null) {
    ids.push('move', 'rename', visibility)
    if (rights.mayDelete) ids.push('delete')
  }
  return ids.map(item)
}
