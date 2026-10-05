import { useQueryClient } from '@tanstack/react-query'
import { JmapHttpError } from 'jmap-client-ts'
import { useMemo } from 'react'

import { emailKeys } from '@common/features/email/queries'
import { FLAGGED, SEEN, UNSUBSCRIBED } from '@common/features/email/keywords'
import {
  findMailboxIdByRole,
  findTeamFolderId,
  findTeamHomeId,
  isPersonalMailbox,
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

import { mayOnEmail, rightForAction } from './emailRights'
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
  | 'markUnsubscribed'
  | 'deletePermanently'
  | 'addLabel'
  | 'removeLabel'

export interface EmailActionRequest {
  action: EmailActionName
  emails: readonly TargetEmail[]
  /** The folder the emails are shown in; null elsewhere */
  mailboxId: string | null
  /** The folder `moveTo` moves them to */
  destinationId?: string
  /** The label `addLabel` and `removeLabel` set or take off */
  label?: { keyword: string; displayName: string }
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
  action: EmailActionName,
  /** The folder the emails are in: a team mailbox has its own Trash */
  fromMailboxId: string | null = null
): string | null {
  const role = DESTINATION_ROLES[action]
  if (role === undefined) return null
  const from = mailboxes.find(mailbox => mailbox.id === fromMailboxId)
  if (role === 'trash' && from !== undefined && !isPersonalMailbox(from)) {
    return findTeamFolderId(mailboxes, from.id, 'trash')
  }
  return findMailboxIdByRole(mailboxes, role)
}

/**
 * The emails of a request by the folder they are taken out of. Shown in a
 * folder they are all in it. In a search or in Starred, an email of a team
 * mailbox is taken out of its own folder, so that its Trash is the one of
 * its team mailbox (tmail-flutter `_moveEmailsToTrashAcrossNamespaces`).
 */
function groupByHome(
  { action, emails, mailboxId }: EmailActionRequest,
  mailboxes: readonly MailboxSummary[]
): { mailboxId: string | null; emails: TargetEmail[] }[] {
  if (action !== 'moveToTrash' || mailboxId !== null) {
    return [{ mailboxId, emails: [...emails] }]
  }
  const groups = new Map<string | null, TargetEmail[]>()
  for (const email of emails) {
    const home = findTeamHomeId(mailboxes, email)
    groups.set(home, [...(groups.get(home) ?? []), email])
  }
  return [...groups].map(([home, group]) => ({
    mailboxId: home,
    emails: group
  }))
}

function toOperation(
  { action, mailboxId, destinationId, label }: EmailActionRequest,
  mailboxes: readonly MailboxSummary[]
): EmailOperation | null {
  switch (action) {
    case 'markAsRead':
    case 'markAsUnread':
      return { kind: 'keyword', keyword: SEEN, isSet: action === 'markAsRead' }
    case 'star':
    case 'unstar':
      return { kind: 'keyword', keyword: FLAGGED, isSet: action === 'star' }
    case 'markUnsubscribed':
      return { kind: 'keyword', keyword: UNSUBSCRIBED, isSet: true }
    case 'deletePermanently':
      return { kind: 'destroy' }
    case 'addLabel':
    case 'removeLabel':
      return label === undefined
        ? null
        : {
            kind: 'keyword',
            keyword: label.keyword,
            isSet: action === 'addLabel'
          }
    case 'moveTo':
      return destinationId === undefined
        ? null
        : { kind: 'move', from: mailboxId, to: destinationId }
    default: {
      const to = findActionDestination(mailboxes, action, mailboxId)
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
        case 'addLabel':
          return count === 1
            ? t('labels.toasts.addedToEmail', {
                labelName: request.label?.displayName ?? ''
              })
            : t('labels.toasts.addedToEmails')
        case 'removeLabel':
          return t('labels.toasts.removedFromEmail', {
            labelName: request.label?.displayName ?? ''
          })
        case 'markUnsubscribed':
          return t('unsubscribe.done')
        case 'deletePermanently':
          return count === 1
            ? t('emailActions.toast.deletedForever')
            : t('emailActions.toast.deletedForeverCount', {
                smart_count: count
              })
      }
    }

    async function run(initial: EmailActionRequest): Promise<boolean> {
      let request = initial
      // The folders are loaded with the tree; fetched here if not yet
      const list =
        (
          await queryClient
            .query({
              ...mailboxesQueryOptions(client, accountId),
              staleTime: Infinity
            })
            .catch(() => null)
        )?.list ?? []
      // What the rights of the folders forbid is refused, with its reason
      const right = rightForAction(request.action)
      const allowed = request.emails.filter(email =>
        mayOnEmail(email, right, list, request.mailboxId)
      )
      if (allowed.length < request.emails.length) {
        notify({ message: t('emailActions.noRights'), severity: 'error' })
        if (allowed.length === 0) return false
        request = { ...request, emails: allowed }
      }
      const planned = groupByHome(request, list).flatMap(
        ({ mailboxId, emails }) => {
          const operation = toOperation({ ...request, mailboxId }, list)
          return operation === null
            ? []
            : [{ operation, changes: planEmailChanges(emails, operation) }]
        }
      )
      const operation = planned[0]?.operation ?? null
      if (operation === null) {
        console.warn('[email] No folder to run this action', request.action)
        return false
      }
      const refused = planned.find(({ operation: candidate }) => {
        const destination =
          candidate.kind === 'move'
            ? list.find(mailbox => mailbox.id === candidate.to)
            : undefined
        return destination?.myRights.mayAddItems === false
      })
      if (refused !== undefined) {
        notify({
          message: t('emailActions.noRightsDestination'),
          severity: 'error'
        })
        return false
      }
      const changes = planned.flatMap(group => group.changes)
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
