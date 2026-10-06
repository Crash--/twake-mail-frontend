import {
  findTeamFolderByAddress,
  findTemplatesMailboxId,
  isTeamRoot,
  isTeamTemplates,
  teamMailboxAddress
} from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'

/**
 * Where "Save as template" files a message: the Templates folder `mailboxId`
 * when it exists, else the one to create, at the top level (`parentId` null)
 * or under the root of a team mailbox
 */
export interface TemplatesTarget {
  mailboxId: string | null
  parentId: string | null
}

/**
 * The Templates folder of the identity a message is saved with: the one of
 * the team mailbox whose address the identity has (created under its root
 * when missing), when `myRights` let the user file mail there (`mayAddItems`
 * of the folder, `mayCreateChild` of the root); else the personal one.
 */
export function chooseTemplatesTarget(
  mailboxes: readonly MailboxSummary[],
  identityEmail: string | null
): TemplatesTarget {
  const personal: TemplatesTarget = {
    mailboxId: findTemplatesMailboxId(mailboxes),
    parentId: null
  }
  if (identityEmail === null) return personal
  const wanted = identityEmail.trim().toLowerCase()
  const root = mailboxes.find(
    mailbox =>
      isTeamRoot(mailbox) &&
      teamMailboxAddress(mailbox)?.toLowerCase() === wanted
  )
  if (!root) return personal
  const folderId = findTeamFolderByAddress(
    mailboxes,
    identityEmail,
    'templates'
  )
  const folder = mailboxes.find(mailbox => mailbox.id === folderId)
  if (folder) {
    return folder.myRights.mayAddItems
      ? { mailboxId: folder.id, parentId: root.id }
      : personal
  }
  return root.myRights.mayCreateChild
    ? { mailboxId: null, parentId: root.id }
    : personal
}

/** The key of a target, to remember the folder a save created */
export function templatesTargetKey(target: TemplatesTarget): string {
  return target.parentId ?? 'personal'
}

/** The ids of every Templates folder: the user's and the ones of the team mailboxes */
export function listTemplatesMailboxIds(
  mailboxes: readonly MailboxSummary[]
): string[] {
  const own = findTemplatesMailboxId(mailboxes)
  return [
    ...(own === null ? [] : [own]),
    ...mailboxes.filter(isTeamTemplates).map(mailbox => mailbox.id)
  ]
}

/**
 * The Templates folders the picker lists: the user's and the ones of the
 * team mailboxes they may read
 */
export function listReadableTemplatesMailboxIds(
  mailboxes: readonly MailboxSummary[]
): string[] {
  const own = findTemplatesMailboxId(mailboxes)
  return [
    ...(own === null ? [] : [own]),
    ...mailboxes
      .filter(
        mailbox => isTeamTemplates(mailbox) && mailbox.myRights.mayReadItems
      )
      .map(mailbox => mailbox.id)
  ]
}
