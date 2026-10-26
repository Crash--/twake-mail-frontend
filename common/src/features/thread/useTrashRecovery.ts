import { isPersonalMailbox } from '@common/features/mailbox/mailboxTree'
import type { MailboxSummary } from '@common/features/mailbox/queries'
import { useRecovery } from '@common/features/recovery/RecoveryProvider'

/**
 * Opens the recovery of deleted messages from the list of the personal
 * Trash, when the server keeps them; null in any other list
 */
export function useTrashRecovery(
  mailbox: MailboxSummary | null
): (() => void) | null {
  const recovery = useRecovery()
  const canRecover =
    mailbox !== null &&
    mailbox.role === 'trash' &&
    isPersonalMailbox(mailbox) &&
    recovery.isAvailable
  return canRecover ? recovery.open : null
}
