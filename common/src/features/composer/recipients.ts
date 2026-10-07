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
 * and a domain of at least two labels
 */
const EMAIL = new RegExp(`^${ATOM}(?:\\.${ATOM})*@${LABEL}(?:\\.${LABEL})+$`)

/** Whether an address can be sent to (a local part, a domain with a dot) */
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

/** Whether `email` is one of `recipients` */
export function hasRecipient(
  recipients: readonly Recipient[],
  email: string
): boolean {
  return recipients.some(recipient => sameEmail(recipient.email, email))
}
