import { useCallback } from 'react'

import { useLabelActions } from '@common/features/labels/LabelActionsProvider'
import {
  PICKED_ROOT,
  usePickMailbox
} from '@common/features/mailbox/MailboxPickerProvider'

import type { EmailActionId } from './emailActionItems'
import type { TargetEmail } from './planEmailChanges'
import { useEmailActions, type EmailActionName } from './useEmailActions'
import { useRemoveEmails } from './useRemoveEmails'

const ACTION_NAMES: Partial<Record<EmailActionId, EmailActionName>> = {
  'not-spam': 'markAsNotSpam',
  'move-to-trash': 'moveToTrash',
  archive: 'archive',
  'mark-as-read': 'markAsRead',
  'mark-as-unread': 'markAsUnread',
  star: 'star',
  unstar: 'unstar',
  'mark-as-spam': 'markAsSpam'
}

/**
 * Runs an action of the menus and toolbars (`availableEmailActions`) on
 * emails shown in `mailboxId` (null in search results): "Delete
 * permanently" asks first, "Move message" opens the folder picker.
 * Resolves to whether the emails changed.
 */
export function useRunEmailAction(): (
  id: EmailActionId,
  emails: readonly TargetEmail[],
  mailboxId: string | null
) => Promise<boolean> {
  const { run } = useEmailActions()
  const removeEmails = useRemoveEmails()
  const pickMailbox = usePickMailbox()
  const { choose: chooseLabels } = useLabelActions()

  return useCallback(
    async (id, emails, mailboxId) => {
      if (id === 'delete-permanently') return removeEmails(emails, mailboxId)
      if (id === 'label-as') return chooseLabels(emails, mailboxId)
      if (id === 'move') {
        const destination = await pickMailbox({
          requireAddItems: true,
          disabledIds: mailboxId === null ? [] : [mailboxId]
        })
        if (destination === null || destination === PICKED_ROOT) return false
        return run({
          action: 'moveTo',
          emails,
          mailboxId,
          destinationId: destination.id
        })
      }
      const action = ACTION_NAMES[id]
      return action === undefined ? false : run({ action, emails, mailboxId })
    },
    [run, removeEmails, pickMailbox, chooseLabels]
  )
}
