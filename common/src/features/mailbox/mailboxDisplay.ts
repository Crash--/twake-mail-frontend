import {
  Archive,
  FolderOutlined,
  FileOutline,
  Email,
  Send,
  Restore,
  Paperplane,
  Warning,
  Note,
  Trash,
  type IconProps
} from '@linagora/twake-icons'

import type { TranslationKey } from '@common/i18n/useI18n'

import {
  isDraftsMailbox,
  isTeamFolder,
  isTeamTemplates,
  isTemplatesMailbox,
  isTrashMailbox
} from './mailboxTree'
import type { MailboxSummary } from './queries'

type MailboxIcon = IconProps['icon']

const ROLE_NAMES: Partial<Record<string, TranslationKey>> = {
  inbox: 'mailbox.roles.inbox',
  drafts: 'mailbox.roles.drafts',
  outbox: 'mailbox.roles.outbox',
  sent: 'mailbox.roles.sent',
  trash: 'mailbox.roles.trash',
  junk: 'mailbox.roles.junk',
  templates: 'mailbox.roles.templates',
  archive: 'mailbox.roles.archive',
  // tmail-backend's folder of the emails recovered from the vault
  'restored messages': 'mailbox.roles.restored'
}

const ROLE_ICONS: Partial<Record<string, MailboxIcon>> = {
  inbox: Email,
  drafts: FileOutline,
  outbox: Send,
  sent: Paperplane,
  trash: Trash,
  junk: Warning,
  templates: Note,
  archive: Archive,
  'restored messages': Restore
}

/** The role whose name and icon a system folder of a team mailbox takes */
const TEAM_ROLES: Partial<Record<string, string>> = {
  inbox: 'inbox',
  drafts: 'drafts',
  outbox: 'outbox',
  sent: 'sent',
  trash: 'trash',
  spam: 'junk',
  junk: 'junk',
  templates: 'templates',
  archive: 'archive'
}

type DisplayedMailbox = Pick<
  MailboxSummary,
  'role' | 'name' | 'namespace' | 'parentId' | 'myRights'
>

/**
 * The role of a folder, or the one a system folder of a team mailbox takes:
 * these have no role, nor can they be deleted, and are known by their name
 * (tmail-flutter `getMailboxIcon`)
 */
function getDisplayedRole(mailbox: DisplayedMailbox): string | null {
  if (mailbox.role) return mailbox.role
  if (isTeamFolder(mailbox) && !mailbox.myRights.mayDelete) {
    return TEAM_ROLES[mailbox.name.toLowerCase()] ?? null
  }
  return null
}

/**
 * Translation key of the name of a system folder (by its JMAP role, or, for
 * a team mailbox, by the same rule as its icon), null for personal folders,
 * which keep the name the user gave them.
 */
export function getRoleNameKey(
  mailbox: DisplayedMailbox
): TranslationKey | null {
  const role = getDisplayedRole(mailbox)
  return role === null ? null : (ROLE_NAMES[role] ?? null)
}

export function getMailboxIcon(mailbox: DisplayedMailbox): MailboxIcon {
  const role = getDisplayedRole(mailbox)
  return (role === null ? null : ROLE_ICONS[role]) ?? FolderOutlined
}

/**
 * Whether the sidebar shows the unread count of a folder: not on the Trash,
 * Spam, Drafts, Templates and Sent (the ones of a team mailbox, known by
 * their name, included, except its Sent and Spam which tmail-flutter tests
 * by role only), and only when something is unread
 * (`allowedToDisplayCountOfUnreadEmails`)
 */
export function showsUnreadCount(mailbox: MailboxSummary): boolean {
  return (
    mailbox.unreadEmails > 0 &&
    !(
      isTrashMailbox(mailbox) ||
      mailbox.role === 'junk' ||
      isDraftsMailbox(mailbox) ||
      isTemplatesMailbox(mailbox) ||
      isTeamTemplates(mailbox) ||
      mailbox.role === 'sent'
    )
  )
}

/**
 * Whether the sidebar shows the number of emails of a folder instead: the
 * Drafts, when it holds some (`allowedToDisplayCountOfTotalEmails`; the
 * Trash and Spam have the "Empty" action in that place)
 */
export function showsTotalCount(mailbox: MailboxSummary): boolean {
  return mailbox.totalEmails > 0 && isDraftsMailbox(mailbox)
}
