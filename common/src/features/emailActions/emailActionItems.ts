import {
  Archive,
  CheckCircle,
  Email,
  EmailOpen,
  FolderMoveto,
  Star,
  StarOutline,
  Trash,
  Warning,
  type IconProps
} from '@linagora/twake-icons'

import { FLAGGED, hasKeyword, SEEN } from '@common/features/email/keywords'
import { findMailboxIdByRole } from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import type { TranslationKey } from '@common/i18n/useI18n'

import type { TargetEmail } from './planEmailChanges'
import { deletesForever } from './useRemoveEmails'

/** What the menus, toolbars and shortcuts can do to emails */
export type EmailActionId =
  | 'not-spam'
  | 'move-to-trash'
  | 'delete-permanently'
  | 'archive'
  | 'mark-as-read'
  | 'mark-as-unread'
  | 'star'
  | 'unstar'
  | 'move'
  | 'mark-as-spam'

export interface EmailActionItem {
  id: EmailActionId
  label: TranslationKey
  icon: IconProps['icon']
  /** Destroys or hides something: said in red */
  isDestructive: boolean
  /** Menus put a divider between groups, as tmail-flutter */
  group: number
}

const ITEMS: Record<EmailActionId, Omit<EmailActionItem, 'id'>> = {
  'not-spam': {
    label: 'emailActions.menu.removeFromSpam',
    icon: CheckCircle,
    isDestructive: false,
    group: 0
  },
  'move-to-trash': {
    label: 'emailActions.menu.moveToTrash',
    icon: Trash,
    isDestructive: false,
    group: 1
  },
  'delete-permanently': {
    label: 'emailActions.menu.deletePermanently',
    icon: Trash,
    isDestructive: true,
    group: 1
  },
  archive: {
    label: 'emailActions.menu.archive',
    icon: Archive,
    isDestructive: false,
    group: 1
  },
  'mark-as-read': {
    label: 'email.markAsRead',
    icon: EmailOpen,
    isDestructive: false,
    group: 2
  },
  'mark-as-unread': {
    label: 'email.markAsUnread',
    icon: Email,
    isDestructive: false,
    group: 2
  },
  star: {
    label: 'emailActions.menu.star',
    icon: StarOutline,
    isDestructive: false,
    group: 2
  },
  unstar: {
    label: 'emailActions.menu.unstar',
    icon: Star,
    isDestructive: false,
    group: 2
  },
  move: {
    label: 'emailActions.menu.moveMessage',
    icon: FolderMoveto,
    isDestructive: false,
    group: 2
  },
  'mark-as-spam': {
    label: 'emailActions.menu.markAsSpam',
    icon: Warning,
    isDestructive: false,
    group: 2
  }
}

export function emailActionItem(id: EmailActionId): EmailActionItem {
  return { id, ...ITEMS[id] }
}

/**
 * The actions offered on emails shown in `mailbox` (null in search
 * results), in tmail-flutter's order: out of Spam; to the Trash (deleted
 * forever in the Trash, Spam and Drafts), to Archive (not from Archive, and
 * only when the account has one); read or unread, starred or not (the
 * toggle that changes something), move, to Spam (not from Spam nor Drafts).
 */
export function availableEmailActions(
  emails: readonly TargetEmail[],
  mailbox: Pick<MailboxSummary, 'role'> | null,
  mailboxes: readonly MailboxSummary[]
): EmailActionItem[] {
  if (emails.length === 0) return []
  const role = mailbox?.role ?? null
  const isSpam = role === 'junk'
  const ids: EmailActionId[] = []
  if (isSpam) ids.push('not-spam')
  ids.push(deletesForever(mailbox) ? 'delete-permanently' : 'move-to-trash')
  if (
    role !== 'archive' &&
    findMailboxIdByRole(mailboxes, 'archive') !== null
  ) {
    ids.push('archive')
  }
  ids.push(
    emails.some(email => !hasKeyword(email, SEEN))
      ? 'mark-as-read'
      : 'mark-as-unread'
  )
  ids.push(
    emails.every(email => hasKeyword(email, FLAGGED)) ? 'unstar' : 'star'
  )
  ids.push('move')
  if (!isSpam && role !== 'drafts') ids.push('mark-as-spam')
  return ids.map(emailActionItem)
}
