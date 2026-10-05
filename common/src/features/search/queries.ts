import { queryOptions } from '@tanstack/react-query'
import type { EmailFilterCondition, Filter, JmapClient } from 'jmap-client-ts'
import type { TMailContact } from 'jmap-client-ts/linagora'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'
import {
  fetchListPage,
  type EmailListPage,
  type SearchRequest
} from '@common/features/thread/queries'

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
 * One page of search results, with the matches marked when the search has
 * words (`SearchSnippet/get`)
 */
export async function fetchSearchPage(
  client: JmapClient,
  accountId: string,
  request: SearchRequest,
  position: number,
  limit: number,
  signal?: AbortSignal
): Promise<EmailListPage> {
  return fetchListPage(
    client,
    accountId,
    request,
    { position, limit, withSnippets: hasSearchedWords(request.filter) },
    signal
  )
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
