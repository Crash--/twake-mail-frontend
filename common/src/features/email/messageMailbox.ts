import type { MailboxSummary } from '@common/features/mailbox/queries'

/**
 * The folder whose actions apply to a message of a conversation: the folder
 * open when it is in it, else the first of its folders the tree knows
 * (tmail-flutter `findMailboxContain`); null when none is known. A message
 * in the Trash is deleted forever, one in Spam can leave it, wherever the
 * conversation was opened from.
 */
export function messageMailboxId(
  email: { mailboxIds: Record<string, true> },
  openedMailboxId: string | null,
  mailboxes: readonly Pick<MailboxSummary, 'id'>[]
): string | null {
  if (openedMailboxId !== null && openedMailboxId in email.mailboxIds) {
    return openedMailboxId
  }
  const known = new Set(mailboxes.map(mailbox => mailbox.id))
  return Object.keys(email.mailboxIds).find(id => known.has(id)) ?? null
}
