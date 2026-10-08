import type { IconProps } from '@linagora/twake-icons'

import {
  ArchiveFolderIcon,
  DefaultFolderIcon,
  DraftsFolderIcon,
  InboxFolderIcon,
  OutboxFolderIcon,
  RecoveredFolderIcon,
  SentFolderIcon,
  SpamFolderIcon,
  TemplatesFolderIcon,
  TrashFolderIcon
} from '@/ds/FolderIcons/FolderIcons'

import type { TranslationKey } from '@common/i18n/useI18n'

import {
  isDraftsMailbox,
  isTeamFolder,
  isTeamInbox,
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

/** The icons of tmail-flutter (`_systemFolderIconMap`) */
const ROLE_ICONS: Partial<Record<string, MailboxIcon>> = {
  inbox: InboxFolderIcon,
  drafts: DraftsFolderIcon,
  outbox: OutboxFolderIcon,
  sent: SentFolderIcon,
  trash: TrashFolderIcon,
  junk: SpamFolderIcon,
  templates: TemplatesFolderIcon,
  archive: ArchiveFolderIcon,
  'restored messages': RecoveredFolderIcon
}

/** The role whose icon a system folder of a team mailbox takes, by name */
const TEAM_ICON_ROLES: Partial<Record<string, string>> = {
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

/**
 * Translation key of the name of a system folder (by its JMAP role, or the
 * Inbox of a team mailbox, which has none and is named "INBOX"), null for
 * personal folders, which keep the name the user gave them.
 */
export function getRoleNameKey(
  mailbox: Pick<MailboxSummary, 'role' | 'name' | 'namespace' | 'parentId'>
): TranslationKey | null {
  if (isTeamInbox(mailbox)) return 'mailbox.roles.inbox'
  return (mailbox.role && ROLE_NAMES[mailbox.role]) ?? null
}

export function getMailboxIcon(
  mailbox: Pick<
    MailboxSummary,
    'role' | 'name' | 'namespace' | 'parentId' | 'myRights'
  >
): MailboxIcon {
  if (mailbox.role) return ROLE_ICONS[mailbox.role] ?? DefaultFolderIcon
  // The system folders of a team mailbox have no role, nor can they be
  // deleted: known by their name (tmail-flutter `getMailboxIcon`)
  if (isTeamFolder(mailbox) && !mailbox.myRights.mayDelete) {
    return (
      ROLE_ICONS[TEAM_ICON_ROLES[mailbox.name.toLowerCase()] ?? ''] ??
      DefaultFolderIcon
    )
  }
  return DefaultFolderIcon
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
