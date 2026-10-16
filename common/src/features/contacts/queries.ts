import { queryOptions } from '@tanstack/react-query'
import type { JmapClient } from 'jmap-client-ts'
import type { TMailContact } from 'jmap-client-ts/linagora'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'

/**
 * How many contacts are first suggested under a recipient field
 * (tmail-flutter); scrolling to the end asks for the others
 */
export const CONTACT_SUGGESTION_LIMIT = 8

/** `limited`: the first contacts only; `all`: as many as the server gives */
export type ContactSuggestionScope = 'limited' | 'all'

export type ContactSuggestionsKey = readonly [
  'contacts',
  string,
  'autocomplete',
  string,
  ContactSuggestionScope
]

export const contactKeys = {
  autocomplete: (
    accountId: string,
    text: string,
    scope: ContactSuggestionScope
  ): ContactSuggestionsKey => [
    'contacts',
    accountId,
    'autocomplete',
    text,
    scope
  ]
}

/**
 * Contacts whose name or address matches `text` (Linagora extension): the
 * first ones, or all of them up to the server's own limit (tmail-flutter
 * then leaves `limit` out)
 */
export function contactAutocompleteQueryOptions(
  client: JmapClient,
  accountId: string,
  text: string,
  scope: ContactSuggestionScope = 'limited'
): QueryOptionsFor<TMailContact[], ContactSuggestionsKey> {
  return queryOptions({
    queryKey: contactKeys.autocomplete(accountId, text, scope),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'TMailContact/autocomplete',
        {
          accountId,
          filter: { text },
          ...(scope === 'limited' ? { limit: CONTACT_SUGGESTION_LIMIT } : {})
        },
        { signal }
      )
      return response.list
    },
    staleTime: 60_000
  })
}
