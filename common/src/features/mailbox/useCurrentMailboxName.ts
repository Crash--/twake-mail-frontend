import { useMatch } from 'react-router'

import { useMailboxes } from './useMailboxes'
import { useMailboxName } from './useMailboxName'

/** Display name of the mailbox of the current route, null outside one */
export function useCurrentMailboxName(): string | null {
  const match = useMatch('/mailbox/:mailboxId/*')
  const mailboxes = useMailboxes()
  const getName = useMailboxName()
  const mailboxId = match?.params.mailboxId ?? null
  const mailbox =
    mailboxes.data?.find(candidate => candidate.id === mailboxId) ?? null
  return mailbox === null ? null : getName(mailbox)
}
