import { useQueries } from '@tanstack/react-query'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'

import { contactAutocompleteQueryOptions } from '@common/features/contacts/queries'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

function sameAddress(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
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
    addresses.map((address, index) => {
      const contact = results[index]?.data?.find(candidate =>
        sameAddress(candidate.emailAddress, address)
      )
      const name =
        `${contact?.firstname ?? ''} ${contact?.surname ?? ''}`.trim()
      return [address, name === '' ? address : name]
    })
  )
}
