import type { MailboxSummary } from '@common/features/mailbox/queries'
import type { TranslationKey } from '@common/i18n/useI18n'

/** A leading `#`, or `%`, `*`, a line break: refused by tmail-flutter */
const FORBIDDEN = /^#|[%*\r\n]/

/**
 * Checks a folder name as tmail-flutter does before creating or renaming:
 * required, not only spaces, no special characters, and not the name of
 * another folder at the same place (whatever the case). `/` is allowed.
 * Returns the message key of the problem, null when the name is fine.
 */
export function validateFolderName(
  name: string,
  {
    mailboxes,
    parentId,
    renamedId = null
  }: {
    mailboxes: readonly MailboxSummary[]
    parentId: string | null
    /** The folder renamed, null for a new one */
    renamedId?: string | null
  }
): TranslationKey | null {
  if (name === '') return 'folders.validation.required'
  if (name.trim() === '') return 'folders.validation.spaces'
  if (FORBIDDEN.test(name)) return 'folders.validation.characters'
  const lower = name.trim().toLocaleLowerCase()
  const isTaken = mailboxes.some(
    mailbox =>
      mailbox.parentId === parentId &&
      mailbox.id !== renamedId &&
      mailbox.name.toLocaleLowerCase() === lower
  )
  if (isTaken) {
    return renamedId === null
      ? 'folders.validation.taken'
      : 'folders.validation.sameName'
  }
  return null
}
