import type { EmailFilterCondition, Filter } from 'jmap-client-ts'

/**
 * Whether an email matches an `Email/query` filter, as far as the client can
 * tell from what a list knows of it: `maybe` for what only the server knows
 * (words, addresses, sizes, threads).
 */
export type FilterVerdict = 'yes' | 'no' | 'maybe'

/** What a list knows of an email: an update may lack all but the first */
export interface FilteredEmail {
  mailboxIds: Record<string, true>
  keywords: Record<string, true>
  receivedAt?: string
  hasAttachment?: boolean
}

function every(verdicts: readonly FilterVerdict[]): FilterVerdict {
  if (verdicts.includes('no')) return 'no'
  return verdicts.every(verdict => verdict === 'yes') ? 'yes' : 'maybe'
}

function some(verdicts: readonly FilterVerdict[]): FilterVerdict {
  if (verdicts.includes('yes')) return 'yes'
  return verdicts.every(verdict => verdict === 'no') ? 'no' : 'maybe'
}

function not(verdict: FilterVerdict): FilterVerdict {
  if (verdict === 'yes') return 'no'
  return verdict === 'no' ? 'yes' : 'maybe'
}

function verdict(condition: boolean): FilterVerdict {
  return condition ? 'yes' : 'no'
}

function hasKeyword(email: FilteredEmail, keyword: string): boolean {
  const wanted = keyword.toLowerCase()
  return Object.keys(email.keywords).some(key => key.toLowerCase() === wanted)
}

/**
 * A date bound: a date equal to the bound is left to the server, whose
 * bounds are not exact (the memory image of tmail-backend treats `after`
 * as exclusive, RFC 8621 as inclusive)
 */
function compareDate(
  receivedAt: string | undefined,
  bound: string,
  isAfter: boolean
): FilterVerdict {
  if (receivedAt === undefined) return 'maybe'
  const time = Date.parse(receivedAt)
  const limit = Date.parse(bound)
  if (Number.isNaN(time) || Number.isNaN(limit) || time === limit) {
    return 'maybe'
  }
  return verdict(isAfter ? time > limit : time < limit)
}

function conditionVerdict(
  condition: EmailFilterCondition,
  email: FilteredEmail
): FilterVerdict {
  const verdicts = Object.entries(condition).map(
    ([property, value]: [string, unknown]): FilterVerdict => {
      switch (property) {
        case 'inMailbox':
          return typeof value === 'string'
            ? verdict(value in email.mailboxIds)
            : 'maybe'
        case 'inMailboxOtherThan':
          return Array.isArray(value)
            ? verdict(
                Object.keys(email.mailboxIds).some(id => !value.includes(id))
              )
            : 'maybe'
        case 'hasKeyword':
          return typeof value === 'string'
            ? verdict(hasKeyword(email, value))
            : 'maybe'
        case 'notKeyword':
          return typeof value === 'string'
            ? verdict(!hasKeyword(email, value))
            : 'maybe'
        case 'hasAttachment':
          return typeof value === 'boolean' && email.hasAttachment !== undefined
            ? verdict(email.hasAttachment === value)
            : 'maybe'
        case 'after':
          return typeof value === 'string'
            ? compareDate(email.receivedAt, value, true)
            : 'maybe'
        case 'before':
          return typeof value === 'string'
            ? compareDate(email.receivedAt, value, false)
            : 'maybe'
        default:
          // Words, addresses, headers, sizes, threads: the server knows
          return 'maybe'
      }
    }
  )
  return every(verdicts)
}

/**
 * Whether `email` matches `filter`, in three-valued logic: `AND` is `no`
 * when one operand is, `OR` is `yes` when one operand is, `NOT` swaps `yes`
 * and `no`; a condition is `no` when one of its properties fails.
 */
export function filterVerdict(
  filter: Filter<EmailFilterCondition> | null | undefined,
  email: FilteredEmail
): FilterVerdict {
  if (filter === null || filter === undefined) return 'yes'
  if ('operator' in filter) {
    const verdicts = filter.conditions.map(condition =>
      filterVerdict(condition, email)
    )
    switch (filter.operator) {
      case 'AND':
        return every(verdicts)
      case 'OR':
        return some(verdicts)
      case 'NOT':
        return not(some(verdicts))
      default:
        return 'maybe'
    }
  }
  return conditionVerdict(filter, email)
}
