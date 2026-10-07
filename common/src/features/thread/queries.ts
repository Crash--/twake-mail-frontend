import {
  infiniteQueryOptions,
  queryOptions,
  type InfiniteData
} from '@tanstack/react-query'
import type {
  Email,
  EmailComparator,
  EmailFilterCondition,
  Filter,
  JmapClient,
  QueryResponse,
  SearchSnippet
} from 'jmap-client-ts'

import {
  PRIORITY_HEADERS,
  type PriorityHeaders
} from '@common/features/email/importance'
import type {
  InfiniteQueryOptionsFor,
  QueryOptionsFor
} from '@common/app/queryOptionsTypes'
import { settle } from '@common/jmap/settle'

/** Emails fetched per page of the list */
export const EMAIL_LIST_PAGE_SIZE = 30

/** The email properties a list row shows, without its headers */
export const EMAIL_ROW_PROPERTIES = [
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

/** The email properties a list row shows: the fields, the priority headers */
export const EMAIL_LIST_PROPERTIES = [
  ...EMAIL_ROW_PROPERTIES,
  ...PRIORITY_HEADERS
] as const

export type EmailListItemData = Pick<
  Email,
  (typeof EMAIL_ROW_PROPERTIES)[number]
> &
  PriorityHeaders

/**
 * What a list of conversations knows of every email of a listed thread:
 * enough to tell its participants and its state (unread, starred,
 * attachment), to find the email standing for it in a mailbox, and to act
 * on all of them
 */
export const THREAD_MEMBER_PROPERTIES = [
  'id',
  'threadId',
  'mailboxIds',
  'keywords',
  'receivedAt',
  'from',
  'to',
  'hasAttachment'
] as const

export type ThreadMember = Pick<
  Email,
  (typeof THREAD_MEMBER_PROPERTIES)[number]
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
  /**
   * Search results: the subject and preview of the emails with the matches
   * marked (`SearchSnippet/get`), by email id
   */
  snippets?: Readonly<Record<string, EmailSnippet>>
  /**
   * Lists of conversations: every email of each thread listed, the oldest
   * first, by thread id (`Thread/get`, then `Email/get` of their ids)
   */
  threads?: Readonly<Record<string, readonly ThreadMember[]>>
}

/** The highlighted subject and preview of a search result */
export type EmailSnippet = Pick<SearchSnippet, 'subject' | 'preview'>

export type EmailListData = InfiniteData<EmailListPage, number>

export type ThreadListKey = readonly ['thread', string, 'list', string]

/** What a search asks the server: an `Email/query` filter and its order */
export interface SearchRequest {
  filter: Filter<EmailFilterCondition>
  sort: readonly EmailComparator[]
  /** One row per conversation: its most recent email */
  collapseThreads?: boolean
  /**
   * The list is a folder narrowed by a filter: an email leaving it leaves
   * the list (search results keep it, in its new state)
   */
  mailboxId?: string
  /**
   * The list is narrowed by a filter of the toolbar (unread, starred,
   * attachments), or is a label view: an email that stops matching it
   * leaves the list, as tmail-flutter's client-side `filterEmail`. Search
   * results keep it
   */
  isListFiltered?: boolean
}

/** The search request of a `threadKeys.search` key */
export function isSearchRequest(value: unknown): value is SearchRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'filter' in value &&
    typeof value.filter === 'object' &&
    value.filter !== null &&
    'sort' in value &&
    Array.isArray(value.sort)
  )
}

export type SearchListKey = readonly ['thread', string, 'search', SearchRequest]

export type ConversationListKey = readonly ['thread', string, 'threads', string]

export type ConversationKey = readonly ['conversation', string, string]

/** The emails of a conversation, and the `Email` state they are at */
export interface ConversationData {
  state: string
  /** Every email of the thread, the oldest first */
  emails: EmailListItemData[]
}

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
  ],
  /** The conversations of a mailbox: one row per thread */
  threads: (accountId: string, mailboxId: string): ConversationListKey => [
    ...threadKeys.all(accountId),
    'threads',
    mailboxId
  ],
  /** The results of a search, also patched by push and the email actions */
  search: (accountId: string, request: SearchRequest): SearchListKey => [
    ...threadKeys.all(accountId),
    'search',
    request
  ]
}

/** Orders `emails` as `ids`: Email/get does not keep the order of the ids */
export function orderByIds(
  emails: EmailListItemData[],
  ids: readonly string[]
): EmailListItemData[] {
  const byId = new Map(emails.map(email => [email.id, email]))
  return ids.flatMap(id => {
    const email = byId.get(id)
    return email ? [email] : []
  })
}

/** Orders the members of a thread: the oldest first */
export function byReceivedAt<T extends Pick<Email, 'receivedAt'>>(
  left: T,
  right: T
): number {
  return left.receivedAt.localeCompare(right.receivedAt)
}

/** The members of the threads `ids`, by thread id, the oldest first */
export function groupThreadMembers(
  threadIds: readonly string[],
  members: readonly ThreadMember[]
): Record<string, ThreadMember[]> {
  const threads: Record<string, ThreadMember[]> = Object.fromEntries(
    threadIds.map(id => [id, []])
  )
  for (const member of members) threads[member.threadId]?.push(member)
  for (const list of Object.values(threads)) list.sort(byReceivedAt)
  return threads
}

function toSnippets(
  list: readonly SearchSnippet[]
): Record<string, EmailSnippet> {
  return Object.fromEntries(
    list.map(({ emailId, subject, preview }) => [emailId, { subject, preview }])
  )
}

interface ListCalls {
  query: PromiseLike<QueryResponse>
  emails: PromiseLike<{ state: string; list: EmailListItemData[] }>
  snippets: PromiseLike<{ list: SearchSnippet[] }> | null
  members: PromiseLike<{ list: ThreadMember[] }> | null
}

export interface ListPageOptions {
  position: number
  limit: number
  /** Asks the server to mark the matches (`SearchSnippet/get`) */
  withSnippets: boolean
}

/**
 * One page of an email list, in one JMAP request: `Email/query`, then the
 * `Email/get` of its ids and, through back-references, the
 * `SearchSnippet/get` of a search and, for a list showing one row per
 * conversation, the `Thread/get` of the threads listed and the `Email/get`
 * of all their emails (their members). Snippets and members are optional:
 * a server failing on them still lists the emails.
 */
export async function fetchListPage(
  client: JmapClient,
  accountId: string,
  { filter, sort, collapseThreads = false }: SearchRequest,
  { position, limit, withSnippets }: ListPageOptions,
  signal?: AbortSignal
): Promise<EmailListPage> {
  // The calls of the request, to read each one, whether it failed or not
  const calls: { current: ListCalls | null } = { current: null }
  await client.requestSettled(
    builder => {
      const query = builder.call('Email/query', {
        accountId,
        filter,
        sort: sort.length > 0 ? [...sort] : null,
        position,
        limit,
        calculateTotal: true,
        collapseThreads
      })
      const emails = builder.call('Email/get', {
        accountId,
        '#ids': query.ref('/ids'),
        properties: [...EMAIL_LIST_PROPERTIES]
      })
      const snippets = withSnippets
        ? builder.call('SearchSnippet/get', {
            accountId,
            filter,
            '#emailIds': query.ref('/ids')
          })
        : null
      const threads = collapseThreads
        ? builder.call('Thread/get', {
            accountId,
            '#ids': emails.ref('/list/*/threadId')
          })
        : null
      const members = threads
        ? builder.call('Email/get', {
            accountId,
            '#ids': threads.ref('/list/*/emailIds'),
            properties: [...THREAD_MEMBER_PROPERTIES]
          })
        : null
      calls.current = { query, emails, snippets, members }
      return [
        query,
        emails,
        ...(snippets ? [snippets] : []),
        ...(threads && members ? [threads, members] : [])
      ]
    },
    signal ? { signal } : {}
  )
  if (calls.current === null) throw new Error('The list request was not built')
  const { query, emails, snippets, members } = calls.current
  const [queryResult, emailsResult, snippetsResult, membersResult] =
    await Promise.all([
      settle(query),
      settle(emails),
      snippets === null ? null : settle(snippets),
      members === null ? null : settle(members)
    ])
  if (!queryResult.ok) throw queryResult.error
  if (!emailsResult.ok) throw emailsResult.error
  const { ids } = queryResult.value
  const total = queryResult.value.total ?? null
  const next = queryResult.value.position + ids.length
  const listed = orderByIds(emailsResult.value.list, ids)
  return {
    emails: listed,
    position: queryResult.value.position,
    count: ids.length,
    total,
    isLast: ids.length < limit || (total !== null && next >= total),
    state: emailsResult.value.state,
    ...(snippetsResult?.ok
      ? { snippets: toSnippets(snippetsResult.value.list) }
      : {}),
    ...(membersResult?.ok
      ? {
          threads: groupThreadMembers(
            listed.map(email => email.threadId),
            membersResult.value.list
          )
        }
      : {})
  }
}

/** The order of a mailbox: the most recent first */
export const MAILBOX_SORT: readonly EmailComparator[] = [
  { property: 'receivedAt', isAscending: false }
]

/** One page of the emails of a mailbox, or of its conversations */
export async function fetchEmailListPage(
  client: JmapClient,
  accountId: string,
  mailboxId: string,
  position: number,
  signal: AbortSignal,
  collapseThreads = false
): Promise<EmailListPage> {
  return fetchListPage(
    client,
    accountId,
    { filter: { inMailbox: mailboxId }, sort: MAILBOX_SORT, collapseThreads },
    { position, limit: EMAIL_LIST_PAGE_SIZE, withSnippets: false },
    signal
  )
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

/**
 * Keys of the conversations (thread detail). Not under `thread`: their data
 * is no list of pages; push and the keyword updates handle them apart.
 */
export const conversationKeys = {
  all: (accountId: string): readonly ['conversation', string] => [
    'conversation',
    accountId
  ],
  detail: (accountId: string, threadId: string): ConversationKey => [
    ...conversationKeys.all(accountId),
    threadId
  ]
}

/**
 * The emails of a conversation, the oldest first: `Thread/get`, then the
 * `Email/get` of its emails, in one request. Push keeps it up to date.
 */
export function conversationQueryOptions(
  client: JmapClient,
  accountId: string,
  threadId: string
): QueryOptionsFor<ConversationData, ConversationKey> {
  return queryOptions({
    queryKey: conversationKeys.detail(accountId, threadId),
    queryFn: async ({ signal }): Promise<ConversationData> => {
      const [, emails] = await client.request(
        builder => {
          const thread = builder.call('Thread/get', {
            accountId,
            ids: [threadId]
          })
          const get = builder.call('Email/get', {
            accountId,
            '#ids': thread.ref('/list/*/emailIds'),
            properties: [...EMAIL_LIST_PROPERTIES]
          })
          return [thread, get]
        },
        { signal }
      )
      return {
        state: emails.state,
        emails: [...emails.list].sort(byReceivedAt)
      }
    }
  })
}
