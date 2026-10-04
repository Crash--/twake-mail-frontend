import { queryOptions } from '@tanstack/react-query'
import type {
  CallHandle,
  EmailFilterCondition,
  Filter,
  JmapClient,
  NarrowedMethodResponse,
  QueryResponse,
  RequestBuilder,
  SearchSnippet
} from 'jmap-client-ts'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'
import type { TMailContact } from '@common/jmap/linagoraMethods'
import {
  EMAIL_LIST_PROPERTIES,
  orderByIds,
  type EmailListPage,
  type EmailSnippet,
  type SearchRequest
} from '@common/features/thread/queries'

type ListCalls = readonly [
  CallHandle<'Email/query', QueryResponse>,
  CallHandle<
    'Email/get',
    NarrowedMethodResponse<'Email/get', (typeof EMAIL_LIST_PROPERTIES)[number]>
  >
]

function toSnippets(
  list: readonly SearchSnippet[]
): Record<string, EmailSnippet> {
  return Object.fromEntries(
    list.map(({ emailId, subject, preview }) => [emailId, { subject, preview }])
  )
}

/** A filter worth highlighting: one with words to look for */
export function hasSearchedWords(
  filter: Filter<EmailFilterCondition>
): boolean {
  if ('operator' in filter) {
    return filter.operator !== 'NOT' && filter.conditions.some(hasSearchedWords)
  }
  return [filter.text, filter.subject, filter.body].some(
    value => value !== undefined && value !== ''
  )
}

/**
 * One page of search results, in one JMAP request: `Email/query`, then the
 * `Email/get` of its ids and, when the search has words, their
 * `SearchSnippet/get`, both through back-references.
 */
export async function fetchSearchPage(
  client: JmapClient,
  accountId: string,
  { filter, sort }: SearchRequest,
  position: number,
  limit: number,
  signal?: AbortSignal
): Promise<EmailListPage> {
  const withSnippets = hasSearchedWords(filter)
  const options = signal ? { signal } : {}
  // Email/query, then Email/get of its ids
  const listCalls = (builder: RequestBuilder): ListCalls => {
    const queryCall = builder.call('Email/query', {
      accountId,
      filter,
      sort: sort.length > 0 ? [...sort] : null,
      position,
      limit
    })
    const getCall = builder.call('Email/get', {
      accountId,
      '#ids': queryCall.ref('/ids'),
      properties: [...EMAIL_LIST_PROPERTIES]
    })
    return [queryCall, getCall] as const
  }
  // A server without snippets still searches: they are optional
  const withSnippetCalls = withSnippets
    ? await client.requestSettled(builder => {
        const [queryCall, getCall] = listCalls(builder)
        const snippetCall = builder.call('SearchSnippet/get', {
          accountId,
          filter,
          '#emailIds': queryCall.ref('/ids')
        })
        return [queryCall, getCall, snippetCall] as const
      }, options)
    : null
  const [query, emails] =
    withSnippetCalls ?? (await client.requestSettled(listCalls, options))
  const snippets = withSnippetCalls?.[2] ?? null
  if (!query.ok) throw query.error
  if (!emails.ok) throw emails.error
  const { ids } = query.value
  const next = query.value.position + ids.length
  const total = query.value.total ?? null
  return {
    emails: orderByIds(emails.value.list, ids),
    position: query.value.position,
    count: ids.length,
    total,
    isLast: ids.length < limit || (total !== null && next >= total),
    state: emails.value.state,
    snippets: snippets?.ok ? toSnippets(snippets.value.list) : {}
  }
}

/** Email suggestions shown under the search field */
export const EMAIL_SUGGESTION_COUNT = 5

/** Contact suggestions shown under the search field */
export const CONTACT_SUGGESTION_COUNT = 3

export type SuggestionsKey = readonly [
  'search',
  string,
  'suggestions',
  SearchRequest
]

export type ContactsKey = readonly ['search', string, 'contacts', string]

/**
 * Keys of the search suggestions. Short-lived: unlike the results, push
 * does not keep them up to date.
 */
export const searchKeys = {
  all: (accountId: string): readonly ['search', string] => [
    'search',
    accountId
  ],
  suggestions: (accountId: string, request: SearchRequest): SuggestionsKey => [
    ...searchKeys.all(accountId),
    'suggestions',
    request
  ],
  contacts: (accountId: string, text: string): ContactsKey => [
    ...searchKeys.all(accountId),
    'contacts',
    text
  ]
}

/** The first emails a search typed so far finds, with their snippets */
export function emailSuggestionsQueryOptions(
  client: JmapClient,
  accountId: string,
  request: SearchRequest
): QueryOptionsFor<EmailListPage, SuggestionsKey> {
  return queryOptions({
    queryKey: searchKeys.suggestions(accountId, request),
    queryFn: ({ signal }) =>
      fetchSearchPage(
        client,
        accountId,
        request,
        0,
        EMAIL_SUGGESTION_COUNT,
        signal
      ),
    staleTime: 10_000
  })
}

/** Contacts whose name or address matches `text` (Linagora extension) */
export function contactSuggestionsQueryOptions(
  client: JmapClient,
  accountId: string,
  text: string
): QueryOptionsFor<TMailContact[], ContactsKey> {
  return queryOptions({
    queryKey: searchKeys.contacts(accountId, text),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'TMailContact/autocomplete',
        { accountId, filter: { text }, limit: CONTACT_SUGGESTION_COUNT },
        { signal }
      )
      return response.list
    },
    staleTime: 60_000
  })
}
