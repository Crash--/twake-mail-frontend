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
  if (isNameTaken(name.trim(), mailboxes, parentId, renamedId)) {
    return renamedId === null
      ? 'folders.validation.taken'
      : 'folders.validation.sameName'
  }
  return null
}

/**
 * Whether another folder than `ownId` under `parentId` (null: the top
 * level) has this name, whatever the case
 */
function isNameTaken(
  name: string,
  mailboxes: readonly MailboxSummary[],
  parentId: string | null,
  ownId: string | null
): boolean {
  const lower = name.toLocaleLowerCase()
  return mailboxes.some(
    mailbox =>
      mailbox.parentId === parentId &&
      mailbox.id !== ownId &&
      mailbox.name.toLocaleLowerCase() === lower
  )
}

/**
 * The parents a folder cannot move under, a folder with its name (whatever
 * the case) being there already: their ids, null for the top level. The
 * server refuses such a move.
 */
export function findClashingParentIds(
  mailboxes: readonly MailboxSummary[],
  moved: MailboxSummary
): (string | null)[] {
  const parentIds = new Set([
    null,
    ...mailboxes.map(({ parentId }) => parentId)
  ])
  return [...parentIds].filter(
    parentId =>
      parentId !== moved.parentId &&
      isNameTaken(moved.name, mailboxes, parentId, moved.id)
  )
}
