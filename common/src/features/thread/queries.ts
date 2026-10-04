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
  /** Number of ids the query returned for this page */
  count: number
  total: number | null
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
  return {
    emails: orderByIds(emails.list, query.ids),
    position: query.position,
    count: query.ids.length,
    total: query.total ?? null
  }
}

/** Position of the next page, undefined after the last one */
export function getNextPosition(page: EmailListPage): number | undefined {
  const next = page.position + page.count
  if (page.count < EMAIL_LIST_PAGE_SIZE) return undefined
  if (page.total !== null && next >= page.total) return undefined
  return next
}

/**
 * The emails of a mailbox, most recent first, page by page: each page is
 * one JMAP request, `Email/query` then `Email/get` of its ids.
 *
 * TODO: keep the pages up to date with `Email/queryChanges` instead of
 * refetching them on every push.
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
