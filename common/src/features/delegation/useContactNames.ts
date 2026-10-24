import { useQueries, useQuery } from '@tanstack/react-query'
import {
  LINAGORA_CAPABILITIES,
  type TMailContact
} from 'jmap-client-ts/linagora'

import { contactAutocompleteQueryOptions } from '@common/features/contacts/queries'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

function sameAddress(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

/** The name a contact gives the address, else the address itself */
function nameIn(
  contacts: readonly TMailContact[] | undefined,
  address: string
): string {
  const contact = contacts?.find(candidate =>
    sameAddress(candidate.emailAddress, address)
  )
  const name = `${contact?.firstname ?? ''} ${contact?.surname ?? ''}`.trim()
  return name === '' ? address : name
}

/**
 * The names of these addresses, as the contacts of the user know them
 * (`TMailContact/autocomplete`, the contacts of the domain included): the
 * address itself while they load, without the extension, and when no
 * contact has a name for it
 */
export function useContactNames(
  addresses: readonly string[]
): Record<string, string> {
  const client = useJmapClient()
  const { ownAccountId, session } = useJmapSession()
  const isOffered =
    LINAGORA_CAPABILITIES.contactAutocomplete in session.capabilities
  const results = useQueries({
    queries: addresses.map(address => ({
      ...contactAutocompleteQueryOptions(client, ownAccountId, address),
      enabled: isOffered
    }))
  })
  return Object.fromEntries(
    addresses.map((address, index) => [
      address,
      nameIn(results[index]?.data, address)
    ])
  )
}

/**
 * The name of this address as `useContactNames` gives it, once known: null
 * while the contacts load (and for no address), the address itself when
 * they have no name for it or cannot be read
 */
export function useContactName(address: string | null): string | null {
  const client = useJmapClient()
  const { ownAccountId, session } = useJmapSession()
  const isOffered =
    LINAGORA_CAPABILITIES.contactAutocomplete in session.capabilities
  const query = useQuery({
    ...contactAutocompleteQueryOptions(client, ownAccountId, address ?? ''),
    enabled: isOffered && address !== null
  })
  if (address === null) return null
  if (isOffered && query.isPending) return null
  return nameIn(query.data, address)
}
