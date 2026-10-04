import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { contactAutocompleteQueryOptions } from '@common/features/contacts/queries'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import {
  CONTACT_AUTOCOMPLETE_CAPABILITY,
  type TMailContact
} from '@common/jmap/linagoraMethods'

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

/**
 * The contacts matching what is typed in a recipient field, when the
 * server autocompletes them (`TMailContact/autocomplete`): none without
 * the capability, nor below its shortest text.
 */
export function useContactSuggestions(typed: string): TMailContact[] {
  const client = useJmapClient()
  const { accountId, session } = useJmapSession()
  const [text, setText] = useState(typed.trim())
  useEffect(() => {
    const timer = setTimeout(() => {
      setText(typed.trim())
    }, CONTACT_SUGGESTION_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [typed])
  const minLength = readMinInputLength(
    session.capabilities[CONTACT_AUTOCOMPLETE_CAPABILITY]
  )
  const query = useQuery({
    ...contactAutocompleteQueryOptions(client, accountId, text),
    enabled: minLength !== null && text.length >= minLength
  })
  return typed.trim() === '' ? [] : (query.data ?? [])
}
