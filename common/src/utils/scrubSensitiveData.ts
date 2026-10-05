/**
 * Removes secrets and personal data from what leaves the browser for
 * observability (Sentry): the OIDC code and state of the login callback,
 * tokens, the WebSocket ticket, Authorization headers, email addresses, and
 * what the mails are made of (subjects, bodies, previews, recipients,
 * attachment names, search queries).
 */

const FILTERED = '[Filtered]'
const EMAIL_MASK = '[email]'
const ID_MASK = ':id'

const SENSITIVE_PARAMS = [
  'code',
  'state',
  'session_state',
  'ticket',
  'access_token',
  'id_token',
  'id_token_hint',
  'refresh_token',
  'code_verifier',
  'login_hint',
  'email',
  'password'
]

const SENSITIVE_PARAM_REGEX = new RegExp(
  `([?&#;]|\\b)(${SENSITIVE_PARAMS.join('|')})=[^&#\\s"'<>]*`,
  'gi'
)
const AUTHORIZATION_VALUE_REGEX = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g
const EMAIL_REGEX = /[A-Z0-9._%+-]+(?:@|%40)[A-Z0-9.-]+\.[A-Z]{2,}/gi
// An absolute URL in a text, followed by its query string or fragment
const URL_WITH_QUERY_REGEX = /(\bhttps?:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/gi
// A JWT: three base64url parts, the first starting like a JSON object
const JWT_REGEX = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g

/**
 * The keys that hold what the mails are made of, a credential or a JMAP
 * identifier: their value is replaced, whatever it is (JMAP objects, request
 * bodies, `extra` data attached by a call site). Compared in lowercase.
 */
const SENSITIVE_KEYS = new Set([
  'subject',
  'preview',
  'textbody',
  'htmlbody',
  'bodyvalues',
  'bodystructure',
  'from',
  'sender',
  'to',
  'cc',
  'bcc',
  'replyto',
  'attachments',
  'displayname',
  'email',
  'emailaddress',
  'username',
  'login_hint',
  'search',
  'text',
  'body',
  'searchquery',
  'query',
  'q',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'idtoken',
  'id_token',
  'token',
  'code',
  'state',
  'codeverifier',
  'code_verifier',
  'ticket',
  'secret',
  'apikey',
  'accountid',
  'blobid',
  'emailid',
  'emailids',
  'threadid',
  'mailboxid',
  'mailboxids'
])

const MAX_DEPTH = 10

/**
 * Masks the sensitive parameters, credentials and email addresses found
 * anywhere in a free text (messages, exception values, log arguments), and
 * the query string of the URLs it holds.
 */
export function scrubText(text: string): string {
  return text
    .replace(URL_WITH_QUERY_REGEX, '$1')
    .replace(SENSITIVE_PARAM_REGEX, `$1$2=${FILTERED}`)
    .replace(AUTHORIZATION_VALUE_REGEX, `$1 ${FILTERED}`)
    .replace(JWT_REGEX, FILTERED)
    .replace(EMAIL_REGEX, EMAIL_MASK)
}

/**
 * Masks what a path tells about the mails of the user: the identifier after
 * `/mailbox/`, `/label/` and `/email/` in the routes of the app, and
 * everything after `/download/` and `/upload/` in the JMAP URLs (account,
 * blob and file name).
 */
function scrubPath(path: string): string {
  return path
    .replace(/\/(download|upload)\/.*$/i, `/$1/${FILTERED}`)
    .replace(/\/(mailbox|label|email)\/[^/]+/gi, `/$1/${ID_MASK}`)
}

/**
 * Drops the query string and the fragment of a URL, then masks what remains:
 * the identifiers of its path and the credentials and addresses in it.
 */
export function scrubUrl(url: string): string {
  const cut = url.search(/[?#]/)
  return scrubText(scrubPath(cut === -1 ? url : url.slice(0, cut)))
}

function isUrlKey(key: string): boolean {
  return /^(url|from|to|referer|referrer)$/i.test(key)
}

function isDroppedKey(key: string): boolean {
  return /^(query_string|cookies|cookie|set-cookie|authorization|password)$/i.test(
    key
  )
}

function isFileNameKey(key: string): boolean {
  return /^(name|filename)$/i.test(key)
}

function scrubValue(value: unknown, key: string, depth: number): unknown {
  if (typeof value === 'string') {
    return isUrlKey(key) ? scrubUrl(value) : scrubText(value)
  }
  if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => scrubValue(item, key, depth + 1))
  }
  // An attachment or a blob: its name is the name of a file of the user
  const isFile = 'blobId' in value
  const result: Record<string, unknown> = {}
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (isDroppedKey(entryKey)) continue
    const isMasked =
      typeof entryValue === 'string' && isUrlKey(entryKey)
        ? false
        : SENSITIVE_KEYS.has(entryKey.toLowerCase()) ||
          (isFile && isFileNameKey(entryKey))
    result[entryKey] =
      isMasked && entryValue !== null && entryValue !== undefined
        ? FILTERED
        : scrubValue(entryValue, entryKey, depth + 1)
  }
  return result
}

/**
 * Walks an object and scrubs every string it holds. Keys named like URLs get
 * their query string and identifiers dropped, the others are masked in place,
 * credential keys are removed, and the keys that hold the content of the
 * mails (subject, body, recipients, search…) or a JMAP identifier are
 * replaced.
 */
export function scrubDeep<T extends object>(value: T): T {
  // SAFETY: scrubValue keeps the shape of objects, it only rewrites strings
  // and removes credential keys, which the Sentry types mark optional
  return scrubValue(value, '', 0) as T
}
