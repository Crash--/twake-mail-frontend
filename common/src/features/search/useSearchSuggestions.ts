import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  LINAGORA_CAPABILITIES,
  type TMailContact
} from 'jmap-client-ts/linagora'

import type {
  EmailListItemData,
  EmailSnippet
} from '@common/features/thread/queries'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  contactSuggestionsQueryOptions,
  emailSuggestionsQueryOptions
} from './queries'
import {
  toSearchRequest,
  withTypedText,
  type SearchContext,
  type SearchFilter
} from './searchFilter'
import { readRecentSearchEntries, type RecentSearch } from './searchStorage'

/** Pause in the typing before the suggestions are fetched */
export const SUGGESTION_DELAY_MS = 300

/** Shortest text the contacts are looked up for, without a server limit */
const DEFAULT_CONTACT_MIN_LENGTH = 3

export interface EmailSuggestion {
  email: EmailListItemData
  snippet: EmailSnippet | null
}

export interface SearchSuggestions {
  /** Recent searches containing the text (all of them for an empty text) */
  recent: RecentSearch[]
  contacts: TMailContact[]
  emails: EmailSuggestion[]
  isLoading: boolean
}

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value)
    }, delay)
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])
  return debounced
}

function readMinInputLength(capability: unknown): number | null {
  if (typeof capability !== 'object' || capability === null) return null
  return 'minInputLength' in capability &&
    typeof capability.minInputLength === 'number'
    ? capability.minInputLength
    : DEFAULT_CONTACT_MIN_LENGTH
}

/**
 * What the search field suggests while the user types, as tmail-flutter
 * does: recent searches, then contacts (when the server autocompletes
 * them) and the first emails the search would find, with the filters
 * picked so far.
 */
export function useSearchSuggestions(
  typed: string,
  draft: SearchFilter,
  context: SearchContext | null,
  isOpen: boolean
): SearchSuggestions {
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()
  const text = useDebouncedValue(typed.trim(), SUGGESTION_DELAY_MS)
  const minContactLength = readMinInputLength(
    session.capabilities[LINAGORA_CAPABILITIES.contactAutocomplete]
  )
  const request = useMemo(
    () =>
      context === null || text === ''
        ? null
        : toSearchRequest(withTypedText(draft, text), context),
    [context, text, draft]
  )
  const emails = useQuery({
    ...emailSuggestionsQueryOptions(
      client,
      accountId,
      request ?? { filter: {}, sort: [] }
    ),
    enabled: isOpen && request !== null
  })
  const contacts = useQuery({
    ...contactSuggestionsQueryOptions(client, accountId, text),
    enabled:
      isOpen && minContactLength !== null && text.length >= minContactLength
  })
  const recent = useMemo(() => {
    const needle = typed.trim().toLowerCase()
    return isOpen
      ? readRecentSearchEntries(accountId).filter(item =>
          item.text.toLowerCase().includes(needle)
        )
      : []
  }, [isOpen, typed, accountId])

  const page = request === null ? undefined : emails.data
  return {
    recent,
    contacts: text === '' ? [] : (contacts.data ?? []),
    emails: (page?.emails ?? []).map(email => ({
      email,
      snippet: page?.snippets?.[email.id] ?? null
    })),
    isLoading: typed.trim() !== text || emails.isFetching || contacts.isFetching
  }
}
