import { useQueryClient } from '@tanstack/react-query'
import { JmapHttpError } from 'jmap-client-ts'
import { useMemo } from 'react'

import { emailKeys } from '@common/features/email/queries'
import { FLAGGED, SEEN } from '@common/features/email/keywords'
import {
  findMailboxIdByRole,
  mailboxPath
} from '@common/features/mailbox/mailboxTree'
import {
  mailboxesQueryOptions,
  mailboxKeys,
  type MailboxListData,
  type MailboxSummary
} from '@common/features/mailbox/queries'
import { useMailboxName } from '@common/features/mailbox/useMailboxName'
import type { EmailListItemData } from '@common/features/thread/queries'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  applyEmailChanges,
  findCachedEmail,
  findListRows
} from './optimisticEmailChanges'
import {
  invertEmailChanges,
  planEmailChanges,
  type EmailChange,
  type EmailOperation,
  type TargetEmail
} from './planEmailChanges'
import { emailSetBatchSize, sendEmailChanges } from './sendEmailChanges'

export type EmailActionName =
  | 'archive'
  | 'moveToTrash'
  | 'moveTo'
  | 'markAsSpam'
  | 'markAsNotSpam'
  | 'markAsRead'
  | 'markAsUnread'
  | 'star'
  | 'unstar'
  | 'deletePermanently'

export interface EmailActionRequest {
  action: EmailActionName
  emails: readonly TargetEmail[]
  /** The folder the emails are shown in; null elsewhere */
  mailboxId: string | null
  /** The folder `moveTo` moves them to */
  destinationId?: string
  /**
   * No toast: the control that ran it shows the new state, or the state
   * back as it was when it failed
   */
  silent?: boolean
}

export interface EmailActions {
  /**
   * Runs an action on emails: shown at once, sent with `Email/set`, then a
   * toast with "Undo"; rolled back, with an error toast offering to retry,
   * for the emails the server did not change. Resolves to whether every
   * email was changed.
   */
  run: (request: EmailActionRequest) => Promise<boolean>
}

/** The system folder an action moves emails to, by role */
const DESTINATION_ROLES: Partial<Record<EmailActionName, string>> = {
  archive: 'archive',
  moveToTrash: 'trash',
  markAsSpam: 'junk',
  markAsNotSpam: 'inbox'
}

/**
 * The folder an action moves emails to, null when it moves none or the
 * account has no such folder (no Archive: tmail-flutter does not create it)
 */
export function findActionDestination(
  mailboxes: readonly MailboxSummary[],
  action: EmailActionName
): string | null {
  const role = DESTINATION_ROLES[action]
  return role === undefined ? null : findMailboxIdByRole(mailboxes, role)
}

function toOperation(
  { action, mailboxId, destinationId }: EmailActionRequest,
  mailboxes: readonly MailboxSummary[]
): EmailOperation | null {
  switch (action) {
    case 'markAsRead':
    case 'markAsUnread':
      return { kind: 'keyword', keyword: SEEN, isSet: action === 'markAsRead' }
    case 'star':
    case 'unstar':
      return { kind: 'keyword', keyword: FLAGGED, isSet: action === 'star' }
    case 'deletePermanently':
      return { kind: 'destroy' }
    case 'moveTo':
      return destinationId === undefined
        ? null
        : { kind: 'move', from: mailboxId, to: destinationId }
    default: {
      const to = findActionDestination(mailboxes, action)
      return to === null
        ? null
        : {
            kind: 'move',
            from: mailboxId,
            to,
            markSeen: action === 'markAsSpam'
          }
    }
  }
}

/** A network failure or a server error, rather than a refusal */
function isConnectionError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof JmapHttpError && error.status >= 500)
  )
}

interface ExecuteResult {
  done: EmailChange[]
  failed: EmailChange[]
  error: unknown
  /** The list rows of the emails, to put them back in the lists later */
  rows: ReadonlyMap<string, EmailListItemData>
}

/**
 * The email actions of the mail screens: archive, trash, move, spam, read,
 * star, delete forever, with optimistic updates (`applyEmailChanges`),
 * batched `Email/set` (`sendEmailChanges`), undo and retry.
 */
export function useEmailActions(): EmailActions {
  const { t } = useI18n()
  const client = useJmapClient()
  const { accountId, session, extraCapabilities } = useJmapSession()
  const queryClient = useQueryClient()
  const { notify } = useNotify()
  const getMailboxName = useMailboxName()
  const batchSize = emailSetBatchSize(session)

  return useMemo(() => {
    const mailboxes = (): MailboxSummary[] =>
      queryClient.getQueryData<MailboxListData>(mailboxKeys.list(accountId))
        ?.list ?? []

    /** Shows the changes, sends them, rolls back the ones refused */
    async function execute(
      changes: readonly EmailChange[],
      knownRows: ReadonlyMap<string, EmailListItemData> = new Map()
    ): Promise<ExecuteResult> {
      const ids = changes.map(change => change.before.id)
      // An email undone or retried may have left every loaded list
      const rows = new Map([
        ...knownRows,
        ...findListRows(queryClient, accountId, ids)
      ])
      applyEmailChanges(queryClient, accountId, changes, rows)
      const { failedIds, error } = await sendEmailChanges(
        client,
        accountId,
        changes,
        { batchSize, extraCapabilities }
      )
      const failedSet = new Set(failedIds)
      const failed = changes.filter(change => failedSet.has(change.before.id))
      if (failed.length > 0) {
        // Back to what the server still holds; a destroyed email comes
        // back from nowhere
        applyEmailChanges(
          queryClient,
          accountId,
          failed.map(({ before, after }) => ({
            before: after ?? { ...before, mailboxIds: {} },
            after: before
          })),
          rows
        )
        for (const change of failed) {
          if (change.after === null) {
            queryClient
              .invalidateQueries({
                queryKey: emailKeys.detail(accountId, change.before.id)
              })
              .catch(() => undefined)
          }
        }
        // The counters of the server, whatever was counted meanwhile
        queryClient
          .invalidateQueries({ queryKey: mailboxKeys.list(accountId) })
          .catch(() => undefined)
      }
      return {
        done: changes.filter(change => !failedSet.has(change.before.id)),
        failed,
        error,
        rows
      }
    }

    function notifyFailure(error: unknown, retry: () => void): void {
      console.error('[email] Cannot change the emails', error)
      notify({
        message: t(
          isConnectionError(error)
            ? 'common.connectionError'
            : 'common.unknownError'
        ),
        severity: 'error',
        action: {
          label: t('common.retry'),
          onClick: retry,
          'data-testid': 'toast-retry-button'
        }
      })
    }

    /** Runs changes without a toast once done (an undo) */
    async function replay(
      changes: readonly EmailChange[],
      rows: ReadonlyMap<string, EmailListItemData>
    ): Promise<void> {
      const result = await execute(changes, rows)
      if (result.failed.length > 0) {
        notifyFailure(result.error, () => {
          void replay(result.failed, result.rows)
        })
      }
    }

    function successMessage(
      request: EmailActionRequest,
      count: number,
      to: string | null
    ): string {
      switch (request.action) {
        case 'moveToTrash':
          return t('emailActions.toast.movedToTrash')
        case 'markAsSpam':
          return t('emailActions.toast.markedAsSpam')
        case 'markAsNotSpam':
          return t('emailActions.toast.markedAsNotSpam')
        case 'archive':
        case 'moveTo':
          return t('emailActions.toast.movedTo', {
            destinationMailboxPath:
              to === null ? '' : mailboxPath(mailboxes(), to, getMailboxName)
          })
        case 'markAsRead':
        case 'markAsUnread': {
          const state = t(
            request.action === 'markAsRead'
              ? 'emailActions.toast.read'
              : 'emailActions.toast.unread'
          )
          return count === 1
            ? t('emailActions.toast.markedMessageAs', {
                action: state.toLocaleLowerCase()
              })
            : t('emailActions.toast.markedMessagesAs', { action: state })
        }
        case 'star':
          return count === 1
            ? t('emailActions.toast.starred')
            : t('emailActions.toast.starredCount', { smart_count: count })
        case 'unstar':
          return count === 1
            ? t('emailActions.toast.unstarred')
            : t('emailActions.toast.unstarredCount', { smart_count: count })
        case 'deletePermanently':
          return count === 1
            ? t('emailActions.toast.deletedForever')
            : t('emailActions.toast.deletedForeverCount', {
                smart_count: count
              })
      }
    }

    async function run(request: EmailActionRequest): Promise<boolean> {
      // The folders are loaded with the tree; fetched here if not yet
      const operation = toOperation(
        request,
        (
          await queryClient
            .query({
              ...mailboxesQueryOptions(client, accountId),
              staleTime: Infinity
            })
            .catch(() => null)
        )?.list ?? []
      )
      if (operation === null) {
        console.warn('[email] No folder to run this action', request.action)
        return false
      }
      const changes = planEmailChanges(request.emails, operation)
      if (changes.length === 0) return true
      const result = await execute(changes)
      if (result.failed.length > 0) {
        if (request.silent === true) {
          // The control that ran it shows the state back as it was
          console.error('[email] Cannot change the emails', result.error)
          return false
        }
        notifyFailure(result.error, () => {
          // From where the emails are now: the rollback put them back
          const emails = result.failed.map(
            ({ before }) =>
              findCachedEmail(queryClient, accountId, before.id) ?? before
          )
          void run({ ...request, emails })
        })
        return false
      }
      if (request.silent !== true) {
        const to = operation.kind === 'move' ? operation.to : null
        notify({
          message: successMessage(request, result.done.length, to),
          severity: 'success',
          action:
            operation.kind === 'destroy'
              ? null
              : {
                  label: t('common.undo'),
                  isUndo: true,
                  onClick: () => {
                    void replay(invertEmailChanges(result.done), result.rows)
                  },
                  'data-testid': 'toast-undo-button'
                }
        })
      }
      return true
    }

    return { run }
  }, [
    t,
    client,
    accountId,
    extraCapabilities,
    queryClient,
    notify,
    getMailboxName,
    batchSize
  ])
}
