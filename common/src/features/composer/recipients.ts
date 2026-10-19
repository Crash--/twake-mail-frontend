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

/** A character of an unquoted name: no separator, quote, bracket nor `@` */
const NAME_CHAR = /[^,;<>"'@\n\r\t]/
const SPACE = /\s/
const BARE_CHAR = /[^\s,;<>]/

type Token =
  | { name: string; email: string; bare: false }
  | { name: null; email: string; bare: true }

/**
 * Where the run of `char` starting at a position ends, remembered: a
 * position inside the last run read is answered without reading it again
 */
function runEnds(text: string, char: RegExp): (from: number) => number {
  let runStart = 0
  let runEnd = -1
  return from => {
    if (from < runStart || from > runEnd) {
      runStart = from
      runEnd = from
      while (runEnd < text.length && char.test(text.charAt(runEnd))) {
        runEnd += 1
      }
    }
    return runEnd
  }
}

/**
 * The tokens of a text, as the matches of
 * `/(?:"([^"]*)"\s*|'([^']*)'\s*|([^,;<>"'@\n\r\t]*?)\s*)<([^<>]*)>|([^\s,;<>]+)/g`:
 * a named address (`"Name" <address>`, `'Name' <address>`, `Name
 * <address>`: an unquoted name has no `@`, so that `a@b.c Name <d@e.f>`
 * reads as two recipients), or a bare token. That pattern read the run of
 * name characters and the spaces after it again from each position, a time
 * cubic in the length of a failing text (ReDoS): here each run is read once.
 */
function tokens(text: string): Token[] {
  const found: Token[] = []
  const nameEnd = runEnds(text, NAME_CHAR)
  const spacesAfterName = runEnds(text, SPACE)
  const spacesAfterQuote = runEnds(text, SPACE)
  // The last non-space of the name run last read, before its start if none
  let nameRun = { end: -1, lastNonSpace: -1 }
  // The first `<` or `>` after the last `<` read
  let bracket = { start: -1, end: -1 }

  /** The address in `<…>` at `start`, and its end, or null */
  const bracketedAt = (
    start: number
  ): { email: string; end: number } | null => {
    if (text.charAt(start) !== '<') return null
    if (bracket.start !== start) {
      let end = start + 1
      while (end < text.length && !'<>'.includes(text.charAt(end))) end += 1
      bracket = { start, end }
    }
    return text.charAt(bracket.end) === '>'
      ? { email: text.slice(start + 1, bracket.end), end: bracket.end + 1 }
      : null
  }

  let position = 0
  while (position < text.length) {
    const char = text.charAt(position)
    let named: { name: string; email: string; end: number } | null = null
    if (char === '"' || char === "'") {
      const close = text.indexOf(char, position + 1)
      const address =
        close === -1 ? null : bracketedAt(spacesAfterQuote(close + 1))
      if (close !== -1 && address !== null) {
        named = { name: text.slice(position + 1, close), ...address }
      }
    } else {
      const end = nameEnd(position)
      if (end !== nameRun.end) {
        let lastNonSpace = end - 1
        while (
          lastNonSpace >= position &&
          SPACE.test(text.charAt(lastNonSpace))
        ) {
          lastNonSpace -= 1
        }
        nameRun = { end, lastNonSpace }
      }
      // Without the spaces before `<`, which the lazy name left to `\s*`
      const nameStop = Math.max(position, nameRun.lastNonSpace + 1)
      const address = bracketedAt(spacesAfterName(end))
      if (address !== null) {
        named = { name: text.slice(position, nameStop), ...address }
      }
    }
    if (named !== null) {
      found.push({ name: named.name, email: named.email, bare: false })
      position = named.end
    } else if (BARE_CHAR.test(char)) {
      let end = position + 1
      while (end < text.length && BARE_CHAR.test(text.charAt(end))) end += 1
      found.push({ name: null, email: text.slice(position, end), bare: true })
      position = end
    } else {
      position += 1
    }
  }
  return found
}

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
  for (const token of tokens(text)) {
    const email = cleanEmail(token.email)
    if (email === '') continue
    recipients.push({ name: token.bare ? null : cleanName(token.name), email })
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
