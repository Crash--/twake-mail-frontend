import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { hasKeyword, SEEN } from '@common/features/email/keywords'
import { emailKeys, type EmailDetail } from '@common/features/email/queries'
import {
  mailboxKeys,
  type MailboxListData
} from '@common/features/mailbox/queries'
import { patchSearchList } from '@common/features/search/patchSearchList'
import { patchEmailList } from '@common/features/thread/patchEmailList'
import {
  threadKeys,
  type EmailListData,
  type EmailListItemData
} from '@common/features/thread/queries'

import type { EmailChange, TargetEmail } from './planEmailChanges'

function listMailboxId(key: QueryKey, accountId: string): string | null {
  const [feature, account, kind, mailboxId] = key
  return feature === 'thread' &&
    account === accountId &&
    kind === 'list' &&
    typeof mailboxId === 'string'
    ? mailboxId
    : null
}

function isSearchList(key: QueryKey, accountId: string): boolean {
  const [feature, account, kind] = key
  return feature === 'thread' && account === accountId && kind === 'search'
}

/**
 * The list rows of these emails, as cached by the loaded email lists: an
 * email moved into a list is inserted there from its row (an opened email
 * has no preview, it cannot make a row)
 */
export function findListRows(
  queryClient: QueryClient,
  accountId: string,
  ids: Iterable<string>
): Map<string, EmailListItemData> {
  const wanted = new Set(ids)
  const rows = new Map<string, EmailListItemData>()
  for (const [, data] of queryClient.getQueriesData<EmailListData>({
    queryKey: threadKeys.all(accountId)
  })) {
    for (const page of data?.pages ?? []) {
      for (const email of page.emails) {
        if (wanted.has(email.id) && !rows.has(email.id)) {
          rows.set(email.id, email)
        }
      }
    }
  }
  return rows
}

/** The current state of an email, from the lists or the opened email */
export function findCachedEmail(
  queryClient: QueryClient,
  accountId: string,
  id: string
): TargetEmail | null {
  const row = findListRows(queryClient, accountId, [id]).get(id)
  if (row) return row
  return (
    queryClient.getQueryData<EmailDetail | null>(
      emailKeys.detail(accountId, id)
    ) ?? null
  )
}

function countIn(
  email: TargetEmail | null,
  deltas: Map<string, { total: number; unread: number }>,
  sign: 1 | -1
): void {
  if (email === null) return
  const isUnread = !hasKeyword(email, SEEN)
  for (const mailboxId of Object.keys(email.mailboxIds)) {
    const delta = deltas.get(mailboxId) ?? { total: 0, unread: 0 }
    delta.total += sign
    if (isUnread) delta.unread += sign
    deltas.set(mailboxId, delta)
  }
}

/**
 * Shows `changes` at once, before the server confirms them:
 *
 * - every loaded email list, through `patchEmailList` (`patchSearchList`
 *   for search results), as if push had brought them: an email leaving a folder is removed, one entering it is
 *   inserted where it sorts (when its row is known), keywords follow. The
 *   pages keep their JMAP state, so the push of the same change later
 *   finds the lists already right and changes nothing;
 * - the opened emails (mailboxes, keywords; null once destroyed);
 * - the counters of the mailboxes involved. Push replaces them with the
 *   counts of the server afterwards, which are absolute: nothing is
 *   counted twice.
 *
 * `rows` are the list rows of the emails, taken before any change.
 */
export function applyEmailChanges(
  queryClient: QueryClient,
  accountId: string,
  changes: readonly EmailChange[],
  rows: ReadonlyMap<string, EmailListItemData>
): void {
  if (changes.length === 0) return
  const destroyed = changes
    .filter(change => change.after === null)
    .map(change => change.before.id)
  const changed = changes.flatMap(({ before, after }) => {
    const row = rows.get(before.id)
    return after === null || row === undefined
      ? []
      : [{ ...row, mailboxIds: after.mailboxIds, keywords: after.keywords }]
  })
  // Emails without a row still leave the lists they were in
  const leaving = changes.flatMap(({ before, after }) =>
    after !== null && !rows.has(before.id) ? [after] : []
  )

  for (const [key, data] of queryClient.getQueriesData<EmailListData>({
    queryKey: threadKeys.all(accountId)
  })) {
    if (data === undefined) continue
    const mailboxId = listMailboxId(key, accountId)
    if (mailboxId === null) {
      // Search results keep their emails where they are, in their new state
      if (isSearchList(key, accountId)) {
        queryClient.setQueryData<EmailListData>(key, current =>
          current
            ? patchSearchList(current, {
                changed,
                destroyed,
                newStates: new Map()
              }).data
            : current
        )
      }
      continue
    }
    const gone = leaving
      .filter(email => !(mailboxId in email.mailboxIds))
      .map(email => email.id)
    queryClient.setQueryData<EmailListData>(key, current =>
      current
        ? patchEmailList(current, mailboxId, {
            changed,
            destroyed: [...destroyed, ...gone],
            newStates: new Map()
          })
        : current
    )
  }

  for (const { before, after } of changes) {
    queryClient.setQueryData<EmailDetail | null>(
      emailKeys.detail(accountId, before.id),
      detail => {
        if (detail === undefined || detail === null) return detail
        return after === null
          ? null
          : {
              ...detail,
              mailboxIds: after.mailboxIds,
              keywords: after.keywords
            }
      }
    )
  }

  const deltas = new Map<string, { total: number; unread: number }>()
  for (const { before, after } of changes) {
    countIn(before, deltas, -1)
    countIn(after, deltas, 1)
  }
  queryClient.setQueryData<MailboxListData>(
    mailboxKeys.list(accountId),
    data =>
      data && {
        ...data,
        list: data.list.map(mailbox => {
          const delta = deltas.get(mailbox.id)
          return delta === undefined
            ? mailbox
            : {
                ...mailbox,
                totalEmails: Math.max(0, mailbox.totalEmails + delta.total),
                unreadEmails: Math.max(0, mailbox.unreadEmails + delta.unread)
              }
        })
      }
  )
}
