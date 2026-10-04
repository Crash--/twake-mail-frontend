/**
 * Removes secrets and personal data from what leaves the browser for
 * observability (Sentry): the OIDC code and state of the login callback,
 * tokens, the WebSocket ticket, Authorization headers and email addresses.
 */

const FILTERED = '[Filtered]'
const EMAIL_MASK = '[email]'

const SENSITIVE_PARAMS = [
  'code',
  'state',
  'session_state',
  'ticket',
  'access_token',
  'id_token',
  'id_token_hint',
  'refresh_token',
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

const MAX_DEPTH = 10

/**
 * Masks the sensitive parameters, credentials and email addresses found
 * anywhere in a free text (messages, exception values, log arguments).
 */
export function scrubText(text: string): string {
  return text
    .replace(SENSITIVE_PARAM_REGEX, `$1$2=${FILTERED}`)
    .replace(AUTHORIZATION_VALUE_REGEX, `$1 ${FILTERED}`)
    .replace(EMAIL_REGEX, EMAIL_MASK)
}

/**
 * Drops the query string and the fragment of a URL, then masks what remains.
 */
export function scrubUrl(url: string): string {
  const cut = url.search(/[?#]/)
  return scrubText(cut === -1 ? url : url.slice(0, cut))
}

function isUrlKey(key: string): boolean {
  return /^(url|from|to|referer|referrer)$/i.test(key)
}

function isDroppedKey(key: string): boolean {
  return /^(query_string|cookies|authorization|password)$/i.test(key)
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
  const result: Record<string, unknown> = {}
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (isDroppedKey(entryKey)) continue
    result[entryKey] = scrubValue(entryValue, entryKey, depth + 1)
  }
  return result
}

/**
 * Walks an object and scrubs every string it holds. Keys named like URLs get
 * their query string dropped, the others are masked in place, and
 * credential keys are removed.
 */
export function scrubDeep<T extends object>(value: T): T {
  // SAFETY: scrubValue keeps the shape of objects, it only rewrites strings
  // and removes credential keys, which the Sentry types mark optional
  return scrubValue(value, '', 0) as T
}
