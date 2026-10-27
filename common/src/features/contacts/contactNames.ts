import type { TMailContact } from 'jmap-client-ts/linagora'

type NamedContact = Pick<TMailContact, 'emailAddress' | 'firstname' | 'surname'>

function sameAddress(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

/**
 * The name of a contact, null when it has none: a contact collected from a
 * sent email is named after its address (`fn` is the address), which is no
 * name either
 */
export function contactName(contact: NamedContact): string | null {
  const name = `${contact.firstname} ${contact.surname}`.trim()
  return name === '' || sameAddress(name, contact.emailAddress) ? null : name
}

/**
 * `contacts` with one contact per address, whatever its case, where the
 * first one stood: the named one when there is one (#741). An address
 * already in the user's contacts is collected again when mailed, and the
 * server suggests both.
 */
export function uniqueContacts<Contact extends NamedContact>(
  contacts: readonly Contact[]
): Contact[] {
  const kept = new Map<string, Contact>()
  contacts.forEach(contact => {
    const address = contact.emailAddress.trim().toLowerCase()
    const known = kept.get(address)
    if (
      known === undefined ||
      (contactName(known) === null && contactName(contact) !== null)
    ) {
      kept.set(address, contact)
    }
  })
  return [...kept.values()]
}
