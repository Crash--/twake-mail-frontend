import { useMemo } from 'react'

import {
  buildMailboxTree,
  listVisibleMailboxes
} from '@common/features/mailbox/mailboxTree'
import { useMailboxName } from '@common/features/mailbox/useMailboxName'
import { useMailboxes } from '@common/features/mailbox/useMailboxes'

export interface MailboxOption {
  id: string
  /** The name, indented by its depth in the tree */
  label: string
  /** The name alone */
  name: string
}

/** Every mailbox in the order of the folder tree, to pick a search scope */
export function useMailboxOptions(): MailboxOption[] {
  const mailboxes = useMailboxes()
  const getName = useMailboxName()
  return useMemo(
    () =>
      listVisibleMailboxes(
        buildMailboxTree(mailboxes.data ?? []),
        () => true
      ).map(({ mailbox, level }) => ({
        id: mailbox.id,
        name: getName(mailbox),
        label: `${'   '.repeat(level - 1)}${getName(mailbox)}`
      })),
    [mailboxes.data, getName]
  )
}
