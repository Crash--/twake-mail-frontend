import { infiniteQueryOptions, type InfiniteData } from '@tanstack/react-query'
import type { Email, JmapClient } from 'jmap-client-ts'

import type { InfiniteQueryOptionsFor } from '@common/app/queryOptionsTypes'

/** Emails fetched per page of the list */
export const EMAIL_LIST_PAGE_SIZE = 30

/** The email properties a list row shows */
export const EMAIL_LIST_PROPERTIES = [
  'id',
  'threadId',
  'mailboxIds',
  'keywords',
  'receivedAt',
  'subject',
  'from',
  'to',
  'preview',
  'hasAttachment'
] as const

export type EmailListItemData = Pick<
  Email,
  (typeof EMAIL_LIST_PROPERTIES)[number]
>

export interface EmailListPage {
  emails: EmailListItemData[]
  /** Position of the first email of the page in the query results */
  position: number
  /**
   * Number of query results the page covers: the ids the query returned,
   * then moved by the emails push inserts or removes
   */
  count: number
  total: number | null
  /** No result after this page when it was fetched */
  isLast: boolean
  /** `Email` state the emails of the page are up to date with */
  state: string
}

export type EmailListData = InfiniteData<EmailListPage, number>

export type ThreadListKey = readonly ['thread', string, 'list', string]

/**
 * Keys of the email lists (thread view). Distinct from the `email` keys of
 * the reading view, so that a list refetch does not refetch the open email.
 */
export const threadKeys = {
  all: (accountId: string): readonly ['thread', string] => [
    'thread',
    accountId
  ],
  list: (accountId: string, mailboxId: string): ThreadListKey => [
    ...threadKeys.all(accountId),
    'list',
    mailboxId
  ]
}

/** Orders `emails` as `ids`: Email/get does not keep the order of the ids */
function orderByIds(
  emails: EmailListItemData[],
  ids: readonly string[]
): EmailListItemData[] {
  const byId = new Map(emails.map(email => [email.id, email]))
  return ids.flatMap(id => {
    const email = byId.get(id)
    return email ? [email] : []
  })
}

async function fetchEmailListPage(
  client: JmapClient,
  accountId: string,
  mailboxId: string,
  position: number,
  signal: AbortSignal
): Promise<EmailListPage> {
  const [query, emails] = await client.request(
    builder => {
      const queryCall = builder.call('Email/query', {
        accountId,
        filter: { inMailbox: mailboxId },
        sort: [{ property: 'receivedAt', isAscending: false }],
        position,
        limit: EMAIL_LIST_PAGE_SIZE,
        calculateTotal: true
      })
      const getCall = builder.call('Email/get', {
        accountId,
        '#ids': queryCall.ref('/ids'),
        properties: [...EMAIL_LIST_PROPERTIES]
      })
      return [queryCall, getCall]
    },
    { signal }
  )
  const total = query.total ?? null
  const next = query.position + query.ids.length
  return {
    emails: orderByIds(emails.list, query.ids),
    position: query.position,
    count: query.ids.length,
    total,
    isLast:
      query.ids.length < EMAIL_LIST_PAGE_SIZE ||
      (total !== null && next >= total),
    state: emails.state
  }
}

/** Position of the next page, undefined after the last one */
export function getNextPosition(page: EmailListPage): number | undefined {
  return page.isLast ? undefined : page.position + page.count
}

/**
 * The emails of a mailbox, most recent first, page by page: each page is
 * one JMAP request, `Email/query` then `Email/get` of its ids.
 *
 * Push keeps the loaded pages up to date from `Email/changes`
 * (`features/push/`): James has no `Email/queryChanges`.
 */
export function emailListQueryOptions(
  client: JmapClient,
  accountId: string,
  mailboxId: string
): InfiniteQueryOptionsFor<EmailListPage, ThreadListKey, number> {
  return infiniteQueryOptions({
    queryKey: threadKeys.list(accountId, mailboxId),
    queryFn: ({ pageParam, signal }) =>
      fetchEmailListPage(client, accountId, mailboxId, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: getNextPosition
  })
}
