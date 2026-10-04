import type { ReactElement, ReactNode } from 'react'

import { DefaultMailboxRedirect } from './DefaultMailboxRedirect'
import { useMailboxes } from './useMailboxes'

export interface RequireKnownMailboxProps {
  mailboxId: string
  children: ReactNode
}

/**
 * Renders the screen of a mailbox of the signed-in user, or goes to the
 * inbox when the mailbox is not one of theirs: a link of another account
 * (the page a previous user signed out from), or a deleted folder.
 */
export function RequireKnownMailbox({
  mailboxId,
  children
}: RequireKnownMailboxProps): ReactElement {
  const query = useMailboxes()

  if (query.isSuccess && !query.data.some(({ id }) => id === mailboxId)) {
    return <DefaultMailboxRedirect />
  }
  return <>{children}</>
}
