/**
 * `mailto:` links (RFC 6068), opened by the `/mailto` route of the app
 * (tmail-flutter `RouteUtils.parseMapMailtoFromUri`, ADR 0036):
 * `/mailto?uri=mailto:a@b.c?subject=Hi`, and the form tmail-flutter also
 * accepts, its fields beside `uri` (`/mailto?uri=mailto:a@b.c&cc=…`).
 */

/** What a `mailto:` link puts in a new message */
export interface MailtoFields {
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string | null
  /** Plain text */
  body: string | null
}

const EMPTY: MailtoFields = {
  to: [],
  cc: [],
  bcc: [],
  subject: null,
  body: null
}

/** Percent-decoded once; a broken escape is kept as written */
function decode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

function addresses(text: string): string[] {
  return text
    .split(',')
    .map(address => address.trim())
    .filter(address => address !== '')
}

/** Adds a field of a link (`to`, `cc`, `bcc`, `subject`, `body`) */
function withField(
  fields: MailtoFields,
  name: string,
  value: string
): MailtoFields {
  switch (name.toLowerCase()) {
    case 'to':
    case 'cc':
    case 'bcc': {
      const kind = name.toLowerCase() as 'to' | 'cc' | 'bcc'
      return { ...fields, [kind]: [...fields[kind], ...addresses(value)] }
    }
    case 'subject':
      return { ...fields, subject: value }
    case 'body':
      return { ...fields, body: value }
    default:
      // Other header fields (In-Reply-To…) are ignored, as tmail-flutter does
      return fields
  }
}

/**
 * The fields of a `mailto:` URI (RFC 6068): the addresses of its path and
 * its `to`, `cc`, `bcc`, `subject` and `body` fields, each decoded once
 * (`+` stays a plus); null when it is no `mailto:` URI
 */
export function parseMailto(uri: string): MailtoFields | null {
  const trimmed = uri.trim()
  if (!/^mailto:/i.test(trimmed)) return null
  const rest = trimmed.slice('mailto:'.length)
  const queryAt = rest.indexOf('?')
  const path = queryAt === -1 ? rest : rest.slice(0, queryAt)
  const query = queryAt === -1 ? '' : rest.slice(queryAt + 1)
  let fields: MailtoFields = { ...EMPTY, to: addresses(decode(path)) }
  for (const pair of query.split('&')) {
    if (pair === '') continue
    const equalAt = pair.indexOf('=')
    const name = decode(equalAt === -1 ? pair : pair.slice(0, equalAt))
    const value = equalAt === -1 ? '' : decode(pair.slice(equalAt + 1))
    fields = withField(fields, name, value)
  }
  return fields
}

/**
 * The fields of the `/mailto` route: its `uri` parameter (a `mailto:` URI,
 * or bare addresses), and the fields given beside it
 */
export function mailtoFromSearch(search: string): MailtoFields | null {
  const params = new URLSearchParams(search)
  const uri = params.get('uri')
  if (uri === null) return null
  let fields =
    parseMailto(uri) ??
    (uri.includes('@') ? { ...EMPTY, to: addresses(uri) } : null)
  if (fields === null) return null
  for (const [name, value] of params) {
    if (name !== 'uri') fields = withField(fields, name, value)
  }
  return fields
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * The editor HTML of the body of a link: plain text, one paragraph per
 * line. tmail-flutter puts the body in the editor as HTML: a link could
 * then inject markup in the message, which plain text cannot.
 */
export function mailtoBodyHtml(body: string): string {
  return body
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => (line === '' ? '<p></p>' : `<p>${escapeText(line)}</p>`))
    .join('')
}
