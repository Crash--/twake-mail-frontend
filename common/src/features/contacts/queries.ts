import { queryOptions } from '@tanstack/react-query'
import type { JmapClient } from 'jmap-client-ts'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'
import type { TMailContact } from '@common/jmap/linagoraMethods'

/** How many contacts are suggested under a recipient field (tmail-flutter) */
export const CONTACT_SUGGESTION_LIMIT = 8

export type ContactSuggestionsKey = readonly [
  'contacts',
  string,
  'autocomplete',
  string
]

export const contactKeys = {
  autocomplete: (accountId: string, text: string): ContactSuggestionsKey => [
    'contacts',
    accountId,
    'autocomplete',
    text
  ]
}

/** Contacts whose name or address matches `text` (Linagora extension) */
export function contactAutocompleteQueryOptions(
  client: JmapClient,
  accountId: string,
  text: string
): QueryOptionsFor<TMailContact[], ContactSuggestionsKey> {
  return queryOptions({
    queryKey: contactKeys.autocomplete(accountId, text),
    queryFn: async ({ signal }) => {
      const response = await client.call(
        'TMailContact/autocomplete',
        { accountId, filter: { text }, limit: CONTACT_SUGGESTION_LIMIT },
        { signal }
      )
      return response.list
    },
    staleTime: 60_000
  })
}
