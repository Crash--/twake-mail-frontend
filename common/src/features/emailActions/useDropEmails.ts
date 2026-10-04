import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import type { MailboxSummary } from '@common/features/mailbox/queries'
import {
  DRAGGED_EMAILS_TYPE,
  readDraggedEmails
} from '@common/features/thread/useEmailListActions'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { findCachedEmail } from './optimisticEmailChanges'
import type { TargetEmail } from './planEmailChanges'
import { useEmailActions } from './useEmailActions'

export interface DropEmails {
  /** Whether emails dragged from a list may drop on the folder */
  accepts: (types: readonly string[]) => boolean
  onDrop: (dataTransfer: DataTransfer) => void
}

/**
 * Emails dragged from a list onto a folder of the tree move there, as
 * tmail-flutter: to the Trash, to Spam (marked read), or to the folder.
 * Folders where emails cannot be added refuse them.
 */
export function useDropEmails(mailbox: MailboxSummary): DropEmails {
  const queryClient = useQueryClient()
  const { accountId } = useJmapSession()
  const { run } = useEmailActions()
  const mayAdd = mailbox.myRights.mayAddItems

  const accepts = useCallback(
    (types: readonly string[]): boolean =>
      mayAdd && types.includes(DRAGGED_EMAILS_TYPE),
    [mayAdd]
  )

  const onDrop = useCallback(
    (dataTransfer: DataTransfer): void => {
      const dragged = readDraggedEmails(dataTransfer)
      if (dragged === null || dragged.mailboxId === mailbox.id) return
      const emails = dragged.emailIds.flatMap((id): TargetEmail[] => {
        const email = findCachedEmail(queryClient, accountId, id)
        return email === null ? [] : [email]
      })
      const request = { emails, mailboxId: dragged.mailboxId }
      if (mailbox.role === 'trash') {
        void run({ ...request, action: 'moveToTrash' })
      } else if (mailbox.role === 'junk') {
        void run({ ...request, action: 'markAsSpam' })
      } else {
        void run({ ...request, action: 'moveTo', destinationId: mailbox.id })
      }
    },
    [mailbox.id, mailbox.role, queryClient, accountId, run]
  )

  return { accepts, onDrop }
}
