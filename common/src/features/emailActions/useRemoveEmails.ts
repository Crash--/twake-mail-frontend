import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useConfirm } from '@common/features/confirm/ConfirmProvider'
import {
  mailboxesQueryOptions,
  type MailboxSummary
} from '@common/features/mailbox/queries'
import { useMailboxName } from '@common/features/mailbox/useMailboxName'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import type { TargetEmail } from './planEmailChanges'
import { useEmailActions } from './useEmailActions'

/** Folders whose emails are deleted forever rather than moved to Trash */
const DELETE_FOREVER_ROLES: readonly string[] = ['trash', 'junk', 'drafts']

/** Whether deleting from this folder deletes forever (tmail-flutter) */
export function deletesForever(
  mailbox: Pick<MailboxSummary, 'role'> | null
): boolean {
  const role = mailbox?.role ?? null
  return role !== null && DELETE_FOREVER_ROLES.includes(role)
}

/**
 * Deletes emails as tmail-flutter does: to Trash, or forever after a
 * confirmation in Trash, Spam and Drafts. Resolves to whether they went.
 */
export function useRemoveEmails(): (
  emails: readonly TargetEmail[],
  mailboxId: string | null
) => Promise<boolean> {
  const { t } = useI18n()
  const { run } = useEmailActions()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const getMailboxName = useMailboxName()

  return useCallback(
    async (emails, mailboxId) => {
      if (emails.length === 0) return false
      const mailboxes = await queryClient
        .query({
          ...mailboxesQueryOptions(client, accountId),
          staleTime: Infinity
        })
        .catch(() => null)
      const mailbox =
        mailboxes?.list.find(candidate => candidate.id === mailboxId) ?? null
      if (!deletesForever(mailbox)) {
        return run({ action: 'moveToTrash', emails, mailboxId })
      }
      const isSingle = emails.length === 1
      const confirmed = await confirm({
        title: t(
          isSingle
            ? 'emailActions.deleteForever.title'
            : 'emailActions.deleteForever.titleMany'
        ),
        message: isSingle
          ? t('emailActions.deleteForever.message')
          : t('emailActions.deleteForever.messageMany', {
              count: emails.length,
              mailboxName: mailbox === null ? '' : getMailboxName(mailbox)
            }),
        confirmLabel: t('common.delete'),
        isDestructive: true
      })
      if (!confirmed) return false
      return run({ action: 'deletePermanently', emails, mailboxId })
    },
    [queryClient, client, accountId, run, confirm, t, getMailboxName]
  )
}
