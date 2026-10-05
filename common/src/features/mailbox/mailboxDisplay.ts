import {
  Archive,
  Email,
  File,
  Folder,
  Note,
  Paperplane,
  Restore,
  Send,
  Trash,
  Warning,
  type IconProps
} from '@linagora/twake-icons'

import type { TranslationKey } from '@common/i18n/useI18n'

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
  drafts: File,
  outbox: Send,
  sent: Paperplane,
  trash: Trash,
  junk: Warning,
  templates: Note,
  archive: Archive,
  'restored messages': Restore
}

/**
 * Translation key of the name of a system folder (by its JMAP role), null
 * for personal folders, which keep the name the user gave them.
 */
export function getRoleNameKey(
  mailbox: Pick<MailboxSummary, 'role'>
): TranslationKey | null {
  return (mailbox.role && ROLE_NAMES[mailbox.role]) ?? null
}

export function getMailboxIcon(
  mailbox: Pick<MailboxSummary, 'role'>
): MailboxIcon {
  return (mailbox.role && ROLE_ICONS[mailbox.role]) ?? Folder
}
