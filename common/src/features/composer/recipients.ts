/**
 * Recipients typed or pasted in the composer: `Name <address>` forms and
 * bare addresses, separated by spaces, commas, semicolons or line breaks
 * (tmail-flutter `StringConvert.emailSeparatorPattern`).
 */

export interface Recipient {
  /** Display name, null for a bare address */
  name: string | null
  email: string
}

/**
 * A named address (`"Name" <address>`, `'Name' <address>`, `Name
 * <address>`: an unquoted name has no `@`, so that `a@b.c Name <d@e.f>`
 * reads as two recipients), or a bare token.
 */
const TOKEN =
  /(?:"([^"]*)"\s*|'([^']*)'\s*|([^,;<>"'@\n\r\t]*?)\s*)<([^<>]*)>|([^\s,;<>]+)/g

/** Characters an atom of the local part or a domain label may not hold */
const FORBIDDEN = '\\s@<>()[\\]\\\\,;:".'

const ATOM = `[^${FORBIDDEN}]+`

/** A domain label does not start or end with a hyphen (RFC 1035) */
const LABEL_EDGE = `[^${FORBIDDEN}-]`
const LABEL = `${LABEL_EDGE}(?:[^${FORBIDDEN}]*${LABEL_EDGE})?`

/**
 * A dot-atom local part (no leading, trailing or doubled dot, RFC 5322)
 * and a domain of one or more labels: a single-label domain (`localhost`,
 * an intranet host) is accepted, as tmail-flutter does
 */
const EMAIL = new RegExp(`^${ATOM}(?:\\.${ATOM})*@${LABEL}(?:\\.${LABEL})*$`)

/** Whether an address can be sent to (a local part and a domain) */
export function isValidEmail(email: string): boolean {
  return EMAIL.test(email)
}

function cleanName(name: string | undefined): string | null {
  const trimmed = (name ?? '').trim()
  return trimmed === '' ? null : trimmed
}

function cleanEmail(email: string): string {
  return email.trim().replace(/^mailto:/i, '')
}

/** The recipients of a typed or pasted text, in order, invalid ones included */
export function parseRecipients(text: string): Recipient[] {
  const recipients: Recipient[] = []
  for (const match of text.matchAll(TOKEN)) {
    const [, doubleQuoted, singleQuoted, unquoted, bracketed, bare] = match
    if (bracketed !== undefined) {
      const email = cleanEmail(bracketed)
      if (email === '') continue
      recipients.push({
        name: cleanName(doubleQuoted ?? singleQuoted ?? unquoted),
        email
      })
    } else if (bare !== undefined) {
      const email = cleanEmail(bare)
      if (email !== '') recipients.push({ name: null, email })
    }
  }
  return recipients
}

function sameEmail(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase()
}

/** `added` after `current`, without the addresses already there */
export function mergeRecipients(
  current: readonly Recipient[],
  added: readonly Recipient[]
): Recipient[] {
  const merged = [...current]
  for (const recipient of added) {
    if (!merged.some(other => sameEmail(other.email, recipient.email))) {
      merged.push(recipient)
    }
  }
  return merged
}

/** How a recipient is written back in a field: `Name <address>` */
export function formatRecipient(recipient: Recipient): string {
  return recipient.name === null
    ? recipient.email
    : `${recipient.name} <${recipient.email}>`
}

/**
 * `items` without the ones whose address, whatever its case, came earlier
 * (tf#1763): the server may return the same contact twice, and two options
 * would share a DOM id, breaking `aria-activedescendant`
 */
export function uniqueByAddress<Item>(
  items: readonly Item[],
  addressOf: (item: Item) => string
): Item[] {
  const seen = new Set<string>()
  return items.filter(item => {
    const address = addressOf(item).toLowerCase()
    if (seen.has(address)) return false
    seen.add(address)
    return true
  })
}

/**
 * The suggestions of a recipient field, each address once, the typed text
 * first when it is a complete address (tmail-flutter): Enter picks what was
 * typed, not a contact whose address merely contains it, nor a suggestion
 * left from a shorter text while the lookup waits. The matching contact
 * moves first, or `typedSuggestion` makes one for the address. Without
 * suggestions nothing is listed: Enter commits the text.
 */
export function withTypedAddressFirst<Suggestion extends { id: string }>(
  allSuggestions: readonly Suggestion[],
  typed: string,
  typedSuggestion: (email: string) => Suggestion
): Suggestion[] {
  const suggestions = uniqueByAddress(
    allSuggestions,
    suggestion => suggestion.id
  )
  const email = typed.trim()
  if (suggestions.length === 0 || !isValidEmail(email)) return suggestions
  const match = suggestions.find(suggestion => sameEmail(suggestion.id, email))
  const others = suggestions.filter(suggestion => suggestion !== match)
  return [match ?? typedSuggestion(email), ...others]
}

/** Whether `email` is one of `recipients` */
export function hasRecipient(
  recipients: readonly Recipient[],
  email: string
): boolean {
  return recipients.some(recipient => sameEmail(recipient.email, email))
}
