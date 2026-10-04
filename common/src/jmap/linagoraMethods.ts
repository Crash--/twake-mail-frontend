import { CAPABILITIES, type ExtensionMethodCapabilities } from 'jmap-client-ts'

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

/** Capability of `Mailbox/clear`, destroying every email of a mailbox */
export const MAILBOX_CLEAR_CAPABILITY = 'com:linagora:params:jmap:mailbox:clear'

export interface MailboxClearArgs {
  accountId: string
  mailboxId: string
}

/** How many emails went, or why none did */
export interface MailboxClearResponse {
  accountId: string
  totalDeletedMessagesCount?: number
  notCleared?: { type: string; description?: string | null } | null
}

declare module 'jmap-client-ts' {
  interface Mailbox {
    /**
     * James shares extension (`urn:apache:james:params:jmap:mail:shares`):
     * `Personal`, or `TeamMailbox[team@domain]` / `Delegated[user@domain]`
     * for the mailboxes shared with the user; absent without the extension
     */
    namespace?: string | null
  }

  interface JmapMethods {
    'Mailbox/clear': {
      // tmail-backend also asks for the mail capability
      capability: typeof MAILBOX_CLEAR_CAPABILITY | typeof CAPABILITIES.mail
      args: MailboxClearArgs
      response: MailboxClearResponse
    }
    'TMailContact/autocomplete': {
      capability: typeof CONTACT_AUTOCOMPLETE_CAPABILITY
      args: ContactAutocompleteArgs
      response: ContactAutocompleteResponse
    }
  }
}

/** The `methodCapabilities` option of `createClient` */
export const LINAGORA_METHOD_CAPABILITIES: ExtensionMethodCapabilities = {
  'Mailbox/clear': [MAILBOX_CLEAR_CAPABILITY, CAPABILITIES.mail],
  'TMailContact/autocomplete': CONTACT_AUTOCOMPLETE_CAPABILITY
}
