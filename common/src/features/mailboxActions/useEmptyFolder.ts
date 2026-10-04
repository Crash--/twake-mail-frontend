import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { emailSetBatchSize } from '@common/features/emailActions/sendEmailChanges'
import { useConfirm } from '@common/features/confirm/ConfirmProvider'
import {
  mailboxesQueryOptions,
  mailboxKeys,
  type MailboxSummary
} from '@common/features/mailbox/queries'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { threadKeys, type EmailListData } from '@common/features/thread/queries'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { emptyFolder, type SubfoldersOutcome } from './emptyFolder'

/** Default `maxCallsInRequest` of a JMAP server (RFC 8620 suggests 16) */
const DEFAULT_MAX_CALLS = 16

export function maxCallsInRequest(
  capabilities: Record<string, unknown>
): number {
  const core = capabilities['urn:ietf:params:jmap:core']
  return typeof core === 'object' &&
    core !== null &&
    'maxCallsInRequest' in core &&
    typeof core.maxCallsInRequest === 'number'
    ? Math.max(1, core.maxCallsInRequest)
    : DEFAULT_MAX_CALLS
}

const SUBFOLDER_TOASTS: Record<
  Exclude<SubfoldersOutcome, 'none'>,
  { key: TranslationKey; severity: 'success' | 'info' | 'error' }
> = {
  deleted: { key: 'emptyFolder.subfoldersSuccess', severity: 'success' },
  partial: { key: 'emptyFolder.subfoldersPartial', severity: 'info' },
  failed: { key: 'emptyFolder.subfoldersFailed', severity: 'error' }
}

/** A folder that can be emptied at once: the Trash and Spam */
export function isEmptiableFolder(mailbox: MailboxSummary | null): boolean {
  return mailbox?.role === 'trash' || mailbox?.role === 'junk'
}

/**
 * Empties the Trash or Spam after a confirmation: every email goes for
 * good (`emptyFolder`), the subfolders of the Trash too. The list shows
 * empty at once; push, or a refetch, brings the counters.
 */
export function useEmptyFolder(): (mailbox: MailboxSummary) => Promise<void> {
  const { t } = useI18n()
  const client = useJmapClient()
  const { accountId, session, extraCapabilities } = useJmapSession()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const { notify } = useNotify()

  return useCallback(
    async (mailbox: MailboxSummary): Promise<void> => {
      const isTrash = mailbox.role === 'trash'
      const confirmed = await confirm(
        isTrash
          ? {
              title: t('emptyFolder.emptyTrashTitle'),
              message: t('emptyFolder.emptyTrashMessage'),
              confirmLabel: t('common.delete'),
              isDestructive: true
            }
          : {
              title: t('emptyFolder.emptySpamTitle'),
              message: t('emptyFolder.emptySpamMessage'),
              confirmLabel: t('common.deleteAll'),
              isDestructive: true
            }
      )
      if (!confirmed) return
      try {
        const mailboxes = await queryClient.query({
          ...mailboxesQueryOptions(client, accountId),
          staleTime: Infinity
        })
        const result = await emptyFolder(
          client,
          accountId,
          mailbox,
          mailboxes.list,
          {
            batchSize: emailSetBatchSize(session),
            maxCalls: maxCallsInRequest(session.capabilities),
            extraCapabilities
          }
        )
        // Empty now, at the JMAP state it was: push brings what changed
        queryClient.setQueryData<EmailListData>(
          threadKeys.list(accountId, mailbox.id),
          data =>
            data && {
              pages: data.pages.slice(0, 1).map(page => ({
                ...page,
                emails: [],
                count: 0,
                total: 0,
                isLast: true
              })),
              pageParams: data.pageParams.slice(0, 1)
            }
        )
        queryClient
          .invalidateQueries({ queryKey: mailboxKeys.list(accountId) })
          .catch(() => undefined)
        if (result.subfolders === 'none') {
          notify({ message: t('emptyFolder.success'), severity: 'success' })
        } else {
          const toast = SUBFOLDER_TOASTS[result.subfolders]
          notify({ message: t(toast.key), severity: toast.severity })
        }
      } catch (error: unknown) {
        console.error('[mailbox] Cannot empty the folder', error)
        notify({
          message: t(
            isTrash ? 'emptyFolder.trashFailed' : 'emptyFolder.spamFailed'
          ),
          severity: 'error'
        })
        queryClient
          .invalidateQueries({
            queryKey: threadKeys.list(accountId, mailbox.id)
          })
          .catch(() => undefined)
      }
    },
    [
      confirm,
      t,
      queryClient,
      client,
      accountId,
      session,
      extraCapabilities,
      notify
    ]
  )
}
