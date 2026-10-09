import type {
  EmailComparator,
  EmailFilterCondition,
  Filter
} from 'jmap-client-ts'

import { EVENT, FLAGGED, SEEN } from '@common/features/email/keywords'
import type { SearchRequest } from '@common/features/thread/queries'

/** Received date ranges of the search, as tmail-flutter offers them */
export const DATE_RANGES = [
  'allTime',
  'last7Days',
  'last30Days',
  'last6Months',
  'lastYear',
  'custom'
] as const

export type DateRange = (typeof DATE_RANGES)[number]

/** Orders of the results; `relevance` lets the server rank them */
export const SORT_ORDERS = [
  'relevance',
  'mostRecent',
  'oldest',
  'senderAscending',
  'senderDescending',
  'subjectAscending',
  'subjectDescending',
  'sizeAscending',
  'sizeDescending'
] as const

export type SortOrder = (typeof SORT_ORDERS)[number]

/** tmail-flutter searches by relevance unless the user picked an order */
export const DEFAULT_SORT_ORDER: SortOrder = 'relevance'

/**
 * Where the search looks: everywhere but the trash and the spam by default,
 * everywhere, or in one mailbox
 */
export type SearchScope =
  | { kind: 'default' }
  | { kind: 'everywhere' }
  | { kind: 'mailbox'; mailboxId: string }

/**
 * What the user searches for: the search bar, its quick filters and the
 * advanced search share it, and the URL of the results carries it.
 */
export interface SearchFilter {
  /** Words anywhere in the email: the search bar ("Has the words") */
  text: string
  /** Sender addresses or names, any of them */
  from: readonly string[]
  /** Recipient addresses or names (To, Cc or Bcc), all of them */
  to: readonly string[]
  subject: string
  /** Words the email must not contain */
  notWords: readonly string[]
  scope: SearchScope
  dateRange: DateRange
  /** Custom range, `YYYY-MM-DD`, both inclusive */
  startDate: string | null
  endDate: string | null
  hasAttachment: boolean
  unread: boolean
  starred: boolean
  /** Leaves out the emails carrying a calendar invitation */
  notIncludeEvents: boolean
  /** The keyword of a label the emails have, null for any */
  label: string | null
  sort: SortOrder
}

export const EMPTY_SEARCH_FILTER: SearchFilter = {
  text: '',
  from: [],
  to: [],
  subject: '',
  notWords: [],
  scope: { kind: 'default' },
  dateRange: 'allTime',
  startDate: null,
  endDate: null,
  hasAttachment: false,
  unread: false,
  starred: false,
  notIncludeEvents: false,
  label: null,
  sort: DEFAULT_SORT_ORDER
}

/** True when a custom range ends before it starts: it matches no email */
export function isReversedDateRange(filter: SearchFilter): boolean {
  return (
    filter.dateRange === 'custom' &&
    filter.startDate !== null &&
    filter.endDate !== null &&
    filter.endDate < filter.startDate
  )
}

/** True when the filter asks for nothing: no search to run */
export function isEmptySearch(filter: SearchFilter): boolean {
  return (
    filter.text.trim() === '' &&
    filter.from.length === 0 &&
    filter.to.length === 0 &&
    filter.subject.trim() === '' &&
    filter.notWords.length === 0 &&
    filter.scope.kind === 'default' &&
    filter.dateRange === 'allTime' &&
    !filter.hasAttachment &&
    !filter.unread &&
    !filter.starred &&
    !filter.notIncludeEvents &&
    filter.label === null
  )
}

/**
 * True when the filter asks for what only the advanced search sets (a
 * subject, words to leave out, a custom range): its button then shows it
 */
export function usesAdvancedFields(filter: SearchFilter): boolean {
  return (
    filter.subject.trim() !== '' ||
    filter.notWords.length > 0 ||
    filter.dateRange === 'custom'
  )
}

/** Splits "a, b ,c" into words, as the "Doesn't have" field does */
export function splitWords(value: string): string[] {
  return value
    .split(',')
    .map(word => word.trim())
    .filter(word => word !== '')
}

const EMAIL_ADDRESS = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/

/**
 * The filter for a text typed in the search bar: an email address searches
 * for its sender, as in tmail-flutter, anything else for its words
 */
export function withTypedText(
  filter: SearchFilter,
  typed: string
): SearchFilter {
  const text = typed.trim()
  if (EMAIL_ADDRESS.test(text) && !filter.from.includes(text)) {
    return { ...filter, text: '', from: [...filter.from, text] }
  }
  return { ...filter, text }
}

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

const PARAMS = {
  text: 'q',
  from: 'from',
  to: 'to',
  subject: 'subject',
  notWords: 'not',
  scope: 'in',
  dateRange: 'date',
  startDate: 'start',
  endDate: 'end',
  hasAttachment: 'attachment',
  unread: 'unread',
  starred: 'starred',
  notIncludeEvents: 'noevents',
  label: 'label',
  sort: 'sort'
} as const

function emptyToNull(value: string | null): string | null {
  return value === null || value === '' ? null : value
}

/** `in=` value searching every mailbox, the trash and the spam included */
const EVERYWHERE = 'all'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function readDay(value: string | null): string | null {
  return value !== null && ISO_DAY.test(value) ? value : null
}

function isOneOf<T extends string>(
  values: readonly T[],
  value: string | null
): value is T {
  return values.some(candidate => candidate === value)
}

/**
 * The filter a results URL carries. Its order comes from `sort`, or from
 * `defaultSort` (the order the user last picked) when absent.
 */
export function parseSearchParams(
  params: URLSearchParams,
  defaultSort: SortOrder = DEFAULT_SORT_ORDER
): SearchFilter {
  const scopeParam = params.get(PARAMS.scope)
  const dateRange = params.get(PARAMS.dateRange)
  const sort = params.get(PARAMS.sort)
  return {
    text: params.get(PARAMS.text) ?? '',
    from: params.getAll(PARAMS.from).filter(value => value !== ''),
    to: params.getAll(PARAMS.to).filter(value => value !== ''),
    subject: params.get(PARAMS.subject) ?? '',
    notWords: params.getAll(PARAMS.notWords).filter(value => value !== ''),
    scope:
      scopeParam === null || scopeParam === ''
        ? { kind: 'default' }
        : scopeParam === EVERYWHERE
          ? { kind: 'everywhere' }
          : { kind: 'mailbox', mailboxId: scopeParam },
    dateRange: isOneOf(DATE_RANGES, dateRange) ? dateRange : 'allTime',
    startDate: readDay(params.get(PARAMS.startDate)),
    endDate: readDay(params.get(PARAMS.endDate)),
    hasAttachment: params.get(PARAMS.hasAttachment) === '1',
    unread: params.get(PARAMS.unread) === '1',
    starred: params.get(PARAMS.starred) === '1',
    notIncludeEvents: params.get(PARAMS.notIncludeEvents) === '1',
    label: emptyToNull(params.get(PARAMS.label)),
    sort: isOneOf(SORT_ORDERS, sort) ? sort : defaultSort
  }
}

/** The URL parameters of a filter: only what differs from the defaults */
export function toSearchParams(filter: SearchFilter): URLSearchParams {
  const params = new URLSearchParams()
  if (filter.text.trim() !== '') params.set(PARAMS.text, filter.text.trim())
  filter.from.forEach(value => params.append(PARAMS.from, value))
  filter.to.forEach(value => params.append(PARAMS.to, value))
  if (filter.subject.trim() !== '') {
    params.set(PARAMS.subject, filter.subject.trim())
  }
  filter.notWords.forEach(value => params.append(PARAMS.notWords, value))
  if (filter.scope.kind === 'everywhere') params.set(PARAMS.scope, EVERYWHERE)
  if (filter.scope.kind === 'mailbox') {
    params.set(PARAMS.scope, filter.scope.mailboxId)
  }
  if (filter.dateRange !== 'allTime') {
    params.set(PARAMS.dateRange, filter.dateRange)
  }
  if (filter.dateRange === 'custom') {
    if (filter.startDate !== null) {
      params.set(PARAMS.startDate, filter.startDate)
    }
    if (filter.endDate !== null) params.set(PARAMS.endDate, filter.endDate)
  }
  if (filter.hasAttachment) params.set(PARAMS.hasAttachment, '1')
  if (filter.unread) params.set(PARAMS.unread, '1')
  if (filter.starred) params.set(PARAMS.starred, '1')
  if (filter.notIncludeEvents) params.set(PARAMS.notIncludeEvents, '1')
  if (filter.label !== null) params.set(PARAMS.label, filter.label)
  params.set(PARAMS.sort, filter.sort)
  return params
}

/** `/search?…`: the shareable URL of the results of a filter */
export function searchPath(filter: SearchFilter): string {
  return `/search?${toSearchParams(filter).toString()}`
}

// ---------------------------------------------------------------------------
// JMAP
// ---------------------------------------------------------------------------

/** What the JMAP filter depends on besides the search filter */
export interface SearchContext {
  /** Ids of the trash and spam mailboxes, left out by default */
  trashAndSpamIds: readonly string[]
  /** The day the relative date ranges count from, `YYYY-MM-DD` */
  today: string
}

/** `YYYY-MM-DD` of a local date */
export function formatDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Midnight (local time) of a `YYYY-MM-DD` day, moved by `days` days */
function startOfDay(day: string, days = 0): Date {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number)
  return new Date(year, month - 1, date + days)
}

/** JMAP `UTCDate`: no milliseconds */
function toUtcDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

const RANGE_DAYS: Readonly<Record<DateRange, number | null>> = {
  allTime: null,
  last7Days: 7,
  last30Days: 30,
  last6Months: 182,
  lastYear: 365,
  custom: null
}

/**
 * Bounds of the received date: relative ranges start at midnight, `n` days
 * before today, and have no end, so that a shared URL keeps meaning "the
 * last 7 days" and the query stays the same all day long.
 */
function dateBounds(
  filter: SearchFilter,
  today: string
): Pick<EmailFilterCondition, 'after' | 'before'> {
  if (filter.dateRange === 'custom') {
    return {
      ...(filter.startDate === null
        ? {}
        : { after: toUtcDate(startOfDay(filter.startDate)) }),
      ...(filter.endDate === null
        ? {}
        : { before: toUtcDate(startOfDay(filter.endDate, 1)) })
    }
  }
  const days = RANGE_DAYS[filter.dateRange]
  return days === null ? {} : { after: toUtcDate(startOfDay(today, -days)) }
}

function anyOf(
  conditions: EmailFilterCondition[]
): Filter<EmailFilterCondition> {
  return conditions.length === 1 && conditions[0] !== undefined
    ? conditions[0]
    : { operator: 'OR', conditions }
}

/**
 * The `Email/query` filter of a search, as tmail-flutter builds it: one
 * condition gathering the simple criteria, ANDed with an `OR` per sender
 * list and per recipient, and a `NOT` of the excluded words.
 */
export function toJmapFilter(
  filter: SearchFilter,
  { trashAndSpamIds, today }: SearchContext
): Filter<EmailFilterCondition> {
  const condition: EmailFilterCondition = { ...dateBounds(filter, today) }
  const text = filter.text.trim()
  const subject = filter.subject.trim()
  if (text !== '') condition.text = text
  if (subject !== '') condition.subject = subject
  if (filter.hasAttachment) condition.hasAttachment = true
  if (filter.starred) condition.hasKeyword = FLAGGED
  // One `hasKeyword` per condition: the label in its own when starred too
  const labelCondition: EmailFilterCondition[] = []
  if (filter.label !== null) {
    if (condition.hasKeyword === undefined) condition.hasKeyword = filter.label
    else labelCondition.push({ hasKeyword: filter.label })
  }
  if (filter.unread) condition.notKeyword = SEEN
  if (filter.scope.kind === 'mailbox') {
    condition.inMailbox = filter.scope.mailboxId
  } else if (filter.scope.kind === 'default' && trashAndSpamIds.length > 0) {
    condition.inMailboxOtherThan = [...trashAndSpamIds]
  }
  if (filter.from.length === 1) condition.from = filter.from[0]

  // `unread` already holds `notKeyword`: the events go in a condition of their own
  const extra: Filter<EmailFilterCondition>[] = [...labelCondition]
  if (filter.notIncludeEvents) extra.push({ notKeyword: EVENT })
  if (filter.from.length > 1) {
    extra.push(anyOf(filter.from.map(from => ({ from }))))
  }
  for (const to of filter.to) {
    extra.push(anyOf([{ to }, { cc: to }, { bcc: to }]))
  }
  if (filter.notWords.length > 0) {
    extra.push({
      operator: 'NOT',
      conditions: filter.notWords.map(word => ({ text: word }))
    })
  }
  if (extra.length === 0) return condition
  const conditions =
    Object.keys(condition).length > 0 ? [condition, ...extra] : extra
  return conditions.length === 1 && conditions[0] !== undefined
    ? conditions[0]
    : { operator: 'AND', conditions }
}

const SORT_COMPARATORS: Readonly<
  Record<SortOrder, readonly EmailComparator[]>
> = {
  relevance: [],
  mostRecent: [{ property: 'receivedAt', isAscending: false }],
  oldest: [{ property: 'receivedAt', isAscending: true }],
  senderAscending: [{ property: 'from', isAscending: true }],
  senderDescending: [{ property: 'from', isAscending: false }],
  subjectAscending: [{ property: 'subject', isAscending: true }],
  subjectDescending: [{ property: 'subject', isAscending: false }],
  sizeAscending: [{ property: 'size', isAscending: true }],
  sizeDescending: [{ property: 'size', isAscending: false }]
}

/** The `Email/query` of a search: its filter and its comparators */
export function toSearchRequest(
  filter: SearchFilter,
  context: SearchContext
): SearchRequest {
  return {
    filter: toJmapFilter(filter, context),
    sort: SORT_COMPARATORS[filter.sort]
  }
}
