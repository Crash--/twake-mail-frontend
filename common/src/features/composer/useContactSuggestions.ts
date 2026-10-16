import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  LINAGORA_CAPABILITIES,
  type TMailContact
} from 'jmap-client-ts/linagora'

import {
  CONTACT_SUGGESTION_LIMIT,
  contactAutocompleteQueryOptions
} from '@common/features/contacts/queries'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

/** Pause in the typing before contacts are looked up (tmail-flutter) */
export const CONTACT_SUGGESTION_DELAY_MS = 150

/** Shortest text looked up when the server does not say (tmail-flutter) */
const DEFAULT_MIN_LENGTH = 3

function readMinInputLength(capability: unknown): number | null {
  if (typeof capability !== 'object' || capability === null) return null
  return 'minInputLength' in capability &&
    typeof capability.minInputLength === 'number'
    ? capability.minInputLength
    : DEFAULT_MIN_LENGTH
}

export interface ContactSuggestions {
  contacts: TMailContact[]
  /**
   * Asks for the contacts beyond the first ones, once the user scrolled to
   * the end of them (tmail-flutter); `null` when there are no others
   */
  loadMore: (() => void) | null
}

/**
 * The contacts matching what is typed in a recipient field, when the
 * server autocompletes them (`TMailContact/autocomplete`): none without
 * the capability, nor below its shortest text. The first ones only, until
 * `loadMore` asks for all of them, for this text.
 */
export function useContactSuggestions(typed: string): ContactSuggestions {
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()
  const [text, setText] = useState(typed.trim())
  /** The text all the contacts were asked for */
  const [loadedText, setLoadedText] = useState<string | null>(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      setText(typed.trim())
    }, CONTACT_SUGGESTION_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [typed])
  const minLength = readMinInputLength(
    session.capabilities[LINAGORA_CAPABILITIES.contactAutocomplete]
  )
  const isEnabled = minLength !== null && text.length >= minLength
  const first = useQuery({
    ...contactAutocompleteQueryOptions(client, accountId, text),
    enabled: isEnabled
  })
  const isAllAsked = loadedText === text
  const all = useQuery({
    ...contactAutocompleteQueryOptions(client, accountId, text, 'all'),
    enabled: isEnabled && isAllAsked
  })
  // The first ones stay while the others load
  const contacts = (isAllAsked ? all.data : undefined) ?? first.data ?? []
  const hasMore =
    !isAllAsked && (first.data?.length ?? 0) >= CONTACT_SUGGESTION_LIMIT
  return typed.trim() === ''
    ? { contacts: [], loadMore: null }
    : {
        contacts,
        loadMore: hasMore
          ? () => {
              setLoadedText(text)
            }
          : null
      }
}
