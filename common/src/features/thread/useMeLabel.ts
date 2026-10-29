import { useContactName } from '@common/features/delegation/useContactNames'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

/**
 * What the rows call the owner of the mailbox shown: "Me" in the user's own
 * mailbox (and in their team mailboxes); in a mailbox delegated to them, its
 * owner's name as their contacts give it, else null: the name the email
 * gives the address, or the address
 */
export function useMeLabel(): string | null {
  const { t } = useI18n()
  const { mailAddress, view } = useJmapSession()
  const isDelegated = view.kind === 'delegated'
  const ownerName = useContactName(isDelegated ? mailAddress : null)
  if (!isDelegated) return t('thread.me')
  return ownerName === mailAddress ? null : ownerName
}
