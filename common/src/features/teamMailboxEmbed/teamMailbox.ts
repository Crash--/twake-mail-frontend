import {
  findTeamFolderByAddress,
  isTeamRoot,
  teamMailboxAddress
} from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'

/** Whether a folder belongs to the team mailbox of `address` (lowercased) */
export function isInTeamMailbox(
  mailbox: Pick<MailboxSummary, 'namespace'>,
  address: string
): boolean {
  return teamMailboxAddress(mailbox)?.toLowerCase() === address
}

/**
 * The root of the team mailbox of `address`: null when the user is not one
 * of its members (a viewer of the space has no access, ADR 005) or when it
 * does not exist
 */
export function findTeamMailboxRoot(
  mailboxes: readonly MailboxSummary[],
  address: string
): MailboxSummary | null {
  return (
    mailboxes.find(
      mailbox => isTeamRoot(mailbox) && isInTeamMailbox(mailbox, address)
    ) ?? null
  )
}

/**
 * The folder the facade opens on: the Inbox of the team mailbox (by name,
 * team folders have no role), else its first folder; null without access
 */
export function findTeamInboxId(
  mailboxes: readonly MailboxSummary[],
  address: string
): string | null {
  const root = findTeamMailboxRoot(mailboxes, address)
  if (root === null) return null
  return (
    findTeamFolderByAddress(mailboxes, address, 'inbox') ??
    mailboxes.find(mailbox => mailbox.parentId === root.id)?.id ??
    root.id
  )
}
