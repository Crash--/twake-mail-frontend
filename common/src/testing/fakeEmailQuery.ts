import type { FakeEmail } from './fakeJmapServer'

/**
 * `Email/query`, `SearchSnippet/get` and `Thread/get` of the fake JMAP
 * server: enough of RFC 8621 to test the search and the conversations
 * against what the app really sends. Text conditions are case-insensitive
 * substring matches, as a small search index would answer them.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function includes(
  haystack: string | null | undefined,
  needle: string
): boolean {
  return (haystack ?? '').toLowerCase().includes(needle.toLowerCase())
}

function addressesMatch(
  addresses: FakeEmail['from'] | undefined,
  needle: string
): boolean {
  return (addresses ?? []).some(
    address => includes(address.email, needle) || includes(address.name, needle)
  )
}

function bodyText(email: FakeEmail): string {
  return Object.values(email.bodyValues ?? {})
    .map(value => value.value)
    .join(' ')
}

function matchesText(email: FakeEmail, text: string): boolean {
  return (
    includes(email.subject, text) ||
    includes(email.preview, text) ||
    includes(bodyText(email), text) ||
    addressesMatch(email.from, text) ||
    addressesMatch(email.to, text) ||
    addressesMatch(email.cc, text)
  )
}

/** One `EmailFilterCondition`: every property present must match */
function matchesCondition(
  email: FakeEmail,
  condition: Record<string, unknown>
): boolean {
  const checks: Record<string, (value: unknown) => boolean> = {
    inMailbox: value => typeof value === 'string' && value in email.mailboxIds,
    inMailboxOtherThan: value =>
      Array.isArray(value) &&
      Object.keys(email.mailboxIds).some(id => !value.includes(id)),
    before: value => typeof value === 'string' && email.receivedAt < value,
    after: value => typeof value === 'string' && email.receivedAt >= value,
    hasKeyword: value => typeof value === 'string' && value in email.keywords,
    notKeyword: value =>
      typeof value === 'string' && !(value in email.keywords),
    hasAttachment: value => email.hasAttachment === value,
    text: value => typeof value === 'string' && matchesText(email, value),
    from: value =>
      typeof value === 'string' && addressesMatch(email.from, value),
    to: value => typeof value === 'string' && addressesMatch(email.to, value),
    cc: value => typeof value === 'string' && addressesMatch(email.cc, value),
    subject: value =>
      typeof value === 'string' && includes(email.subject, value),
    body: value =>
      typeof value === 'string' &&
      (includes(bodyText(email), value) || includes(email.preview, value))
  }
  return Object.entries(condition).every(([property, value]) => {
    const check = checks[property]
    return check === undefined ? true : check(value)
  })
}

/** A `Filter`: an operator (`AND`, `OR`, `NOT`) or a condition */
export function matchesFilter(email: FakeEmail, filter: unknown): boolean {
  if (!isRecord(filter)) return true
  if (typeof filter.operator === 'string' && Array.isArray(filter.conditions)) {
    const results = filter.conditions.map(condition =>
      matchesFilter(email, condition)
    )
    if (filter.operator === 'AND') return results.every(Boolean)
    if (filter.operator === 'OR') return results.some(Boolean)
    return !results.some(Boolean)
  }
  return matchesCondition(email, filter)
}

/** The words a filter searches for, to mark them in the snippets */
export function filterWords(filter: unknown): string[] {
  if (!isRecord(filter)) return []
  if (filter.operator === 'NOT') return []
  if (Array.isArray(filter.conditions)) {
    return filter.conditions.flatMap(filterWords)
  }
  return ['text', 'subject', 'body']
    .map(property => filter[property])
    .filter(value => typeof value === 'string' && value !== '')
    .map(String)
}

function compareBy(
  property: string,
  left: FakeEmail,
  right: FakeEmail
): number {
  switch (property) {
    case 'receivedAt':
      return left.receivedAt.localeCompare(right.receivedAt)
    case 'subject':
      return (left.subject ?? '').localeCompare(right.subject ?? '')
    case 'from':
      return (left.from?.[0]?.email ?? '').localeCompare(
        right.from?.[0]?.email ?? ''
      )
    default:
      return 0
  }
}

/** Sorts by the comparators, the most recent first otherwise */
export function sortEmails(emails: FakeEmail[], sort: unknown): FakeEmail[] {
  const comparators = (Array.isArray(sort) ? sort : [])
    .filter(isRecord)
    .map(comparator => ({
      property: String(comparator.property),
      isAscending: comparator.isAscending !== false
    }))
  if (comparators.length === 0) {
    comparators.push({ property: 'receivedAt', isAscending: false })
  }
  return [...emails].sort((left, right) => {
    for (const { property, isAscending } of comparators) {
      const order = compareBy(property, left, right)
      if (order !== 0) return isAscending ? order : -order
    }
    return 0
  })
}

/** Keeps the first email of each thread, in the order of the results */
export function collapseThreads(emails: FakeEmail[]): FakeEmail[] {
  const seen = new Set<string>()
  return emails.filter(email => {
    if (seen.has(email.threadId)) return false
    seen.add(email.threadId)
    return true
  })
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/** Escapes `text` and wraps the words in `<mark>`, null without a match */
export function markWords(
  text: string | null | undefined,
  words: readonly string[]
): string | null {
  if (!text || words.length === 0) return null
  const lower = text.toLowerCase()
  const ranges: [number, number][] = []
  for (const word of words) {
    const needle = word.toLowerCase()
    let index = lower.indexOf(needle)
    while (index !== -1 && needle !== '') {
      ranges.push([index, index + needle.length])
      index = lower.indexOf(needle, index + needle.length)
    }
  }
  if (ranges.length === 0) return null
  ranges.sort((left, right) => left[0] - right[0])
  let html = ''
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start < cursor) continue
    html += `${escapeHtml(text.slice(cursor, start))}<mark>${escapeHtml(text.slice(start, end))}</mark>`
    cursor = end
  }
  return html + escapeHtml(text.slice(cursor))
}
