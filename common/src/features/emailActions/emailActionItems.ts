import { type IconProps } from '@linagora/twake-icons'

import {
  DRAFT,
  FLAGGED,
  hasKeyword,
  SEEN
} from '@common/features/email/keywords'
import {
  findMailboxIdByRole,
  findTeamHomeId,
  findTemplatesMailboxId,
  isPersonalMailbox
} from '@common/features/mailbox/mailboxTree'
import {
  Archive,
  Download,
  Email,
  EmailNotification,
  EmailOpen,
  MoveEmail,
  NotSpam,
  Pen,
  Printer,
  Spam,
  Star,
  StarOutline,
  Tag,
  Trash
} from '@/ds/FlutterIcons/FlutterIcons'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import type { TranslationKey } from '@common/i18n/useI18n'

import type { TargetEmail } from './planEmailChanges'
import { mayOnEmails, rightForItem } from './emailRights'
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
  | 'label-as'
  | 'unsubscribe'
  | 'print'
  | 'download-eml'
  | 'edit-as-new'

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
    icon: NotSpam,
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
    icon: MoveEmail,
    isDestructive: false,
    group: 2
  },
  'mark-as-spam': {
    label: 'emailActions.menu.markAsSpam',
    icon: Spam,
    isDestructive: false,
    group: 2
  },
  'label-as': {
    label: 'labels.labelAs',
    icon: Tag,
    isDestructive: false,
    group: 2
  },
  unsubscribe: {
    label: 'unsubscribe.action',
    icon: EmailNotification,
    isDestructive: false,
    group: 3
  },
  print: {
    label: 'emailActions.menu.print',
    icon: Printer,
    isDestructive: false,
    group: 3
  },
  'download-eml': {
    label: 'emailActions.menu.downloadAsEml',
    icon: Download,
    isDestructive: false,
    group: 3
  },
  'edit-as-new': {
    label: 'emailActions.menu.editAsNew',
    icon: Pen,
    isDestructive: false,
    group: 3
  }
}

/**
 * The actions that only make sense on one open email, appended after the
 * others, in tmail-flutter's order (it shows "Edit as new email" in
 * Drafts and Templates nowhere)
 */
export const SINGLE_EMAIL_ACTIONS: readonly EmailActionId[] = [
  'unsubscribe',
  'print',
  'download-eml',
  'edit-as-new'
]

export function emailActionItem(id: EmailActionId): EmailActionItem {
  return { id, ...ITEMS[id] }
}

/**
 * The actions offered on emails shown in `mailbox` (null in search
 * results), in tmail-flutter's order: out of Spam; to the Trash (deleted
 * forever in the Trash, Spam and Drafts), to Archive (not from Archive, and
 * only when the account has one); read or unread, starred or not (the
 * toggle that changes something), move, to Spam (not from Spam nor Drafts).
 * Team mailboxes have no Archive nor Spam. "Label as" when labels show.
 */
export function availableEmailActions(
  emails: readonly TargetEmail[],
  mailbox:
    | (Pick<MailboxSummary, 'role' | 'name' | 'namespace' | 'parentId'> & {
        id?: string
      })
    | null,
  mailboxes: readonly MailboxSummary[],
  {
    canLabel = false,
    extras = []
  }: {
    canLabel?: boolean
    /**
     * Actions of `SINGLE_EMAIL_ACTIONS` to add for one email, the caller
     * knowing what it has (Unsubscribe needs a link, Print the body…)
     */
    extras?: readonly EmailActionId[]
  } = {}
): EmailActionItem[] {
  if (emails.length === 0) return []
  const role = mailbox?.role ?? null
  const isSpam = role === 'junk'
  // Team mailboxes have neither Archive nor Spam (tmail-flutter)
  // (out of a folder, in a search, the emails say where they are)
  const isTeam =
    mailbox === null
      ? emails.some(email => findTeamHomeId(mailboxes, email) !== null)
      : !isPersonalMailbox(mailbox)
  const ids: EmailActionId[] = []
  if (isSpam) ids.push('not-spam')
  ids.push(deletesForever(mailbox) ? 'delete-permanently' : 'move-to-trash')
  if (
    !isTeam &&
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
  // As tmail-flutter's menu: "Label as", then "Mark as spam"
  if (canLabel) ids.push('label-as')
  if (!isTeam && !isSpam && role !== 'drafts') ids.push('mark-as-spam')
  if (emails.length === 1) {
    // A draft or a template is edited, not copied
    const templatesId = findTemplatesMailboxId(mailboxes)
    const isEdited =
      role === 'drafts' ||
      emails.some(
        email =>
          hasKeyword(email, DRAFT) ||
          (templatesId !== null && templatesId in email.mailboxIds)
      )
    for (const id of SINGLE_EMAIL_ACTIONS) {
      if (extras.includes(id) && !(id === 'edit-as-new' && isEdited)) {
        ids.push(id)
      }
    }
  }
  // What the rights of the folders forbid is not offered
  return ids
    .filter(id => {
      const right = rightForItem(id)
      return (
        right === null ||
        mayOnEmails(emails, right, mailboxes, mailbox?.id ?? null)
      )
    })
    .map(emailActionItem)
}
