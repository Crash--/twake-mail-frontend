import {
  LINAGORA_CAPABILITIES,
  type ContactSupportCapability
} from 'jmap-client-ts/linagora'

import { useJmapSession } from '@common/jmap/JmapSessionProvider'

/** Where the server tells to ask for help, as tmail-flutter reads it */
export type ContactSupport =
  { kind: 'address'; address: string } | { kind: 'link'; href: string }

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

/**
 * The support of the server (`com:linagora:params:jmap:contact:support`):
 * its address first, else its web page; null when it offers none
 */
export function useContactSupport(): ContactSupport | null {
  const { session } = useJmapSession()
  const support = session.capabilities[LINAGORA_CAPABILITIES.contactSupport] as
    ContactSupportCapability | undefined
  const address = clean(support?.supportMailAddress)
  if (address !== null) return { kind: 'address', address }
  const link = clean(support?.httpLink)
  return link === null ? null : { kind: 'link', href: link }
}
