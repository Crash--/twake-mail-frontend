import type { ExtensionMethodCapabilities } from 'jmap-client-ts'

/**
 * JMAP methods of Linagora's tmail-backend the app calls, declared to
 * jmap-client-ts (declaration merging) with the capability each needs.
 * Meant to move to a `jmap-client-ts/linagora` entry point.
 */

/** Capability of the contact autocompletion (`TMailContact/autocomplete`) */
export const CONTACT_AUTOCOMPLETE_CAPABILITY =
  'com:linagora:params:jmap:contact:autocomplete'

/** A contact of the user's address book or directory */
export interface TMailContact {
  id: string
  firstname: string
  surname: string
  emailAddress: string
}

export interface ContactAutocompleteArgs {
  accountId: string
  filter: { text: string }
  limit?: number
}

export interface ContactAutocompleteResponse {
  accountId: string
  list: TMailContact[]
}

declare module 'jmap-client-ts' {
  interface JmapMethods {
    'TMailContact/autocomplete': {
      capability: typeof CONTACT_AUTOCOMPLETE_CAPABILITY
      args: ContactAutocompleteArgs
      response: ContactAutocompleteResponse
    }
  }
}

/** The `methodCapabilities` option of `createClient` */
export const LINAGORA_METHOD_CAPABILITIES: ExtensionMethodCapabilities = {
  'TMailContact/autocomplete': CONTACT_AUTOCOMPLETE_CAPABILITY
}
