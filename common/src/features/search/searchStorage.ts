import { DEFAULT_SORT_ORDER, SORT_ORDERS, type SortOrder } from './searchFilter'

/**
 * What the search remembers in this browser, as tmail-flutter does: the
 * order last picked for the results, and the recent searches of each
 * account.
 */
export const SORT_ORDER_STORAGE_KEY = 'twake-mail.search.sort-order'
const RECENT_SEARCHES_STORAGE_PREFIX = 'twake-mail.search.recent.'

/** Recent searches kept per account, the newest first */
export const MAX_RECENT_SEARCHES = 10

type SearchStorage = Pick<Storage, 'getItem' | 'setItem'>

function getStorage(): SearchStorage | null {
  try {
    return window.localStorage
  } catch {
    // Storage disabled by the browser settings
    return null
  }
}

function write(
  storage: SearchStorage | null,
  key: string,
  value: string
): void {
  try {
    storage?.setItem(key, value)
  } catch (error: unknown) {
    console.warn('[search] Cannot remember the search', error)
  }
}

/** The order the user last picked, relevance otherwise */
export function readSortOrder(
  storage: SearchStorage | null = getStorage()
): SortOrder {
  const stored = storage?.getItem(SORT_ORDER_STORAGE_KEY) ?? null
  return SORT_ORDERS.find(order => order === stored) ?? DEFAULT_SORT_ORDER
}

export function storeSortOrder(
  order: SortOrder,
  storage: SearchStorage | null = getStorage()
): void {
  write(storage, SORT_ORDER_STORAGE_KEY, order)
}

/** A recent search and when it was made, null for one stored without a date */
export interface RecentSearch {
  text: string
  at: number | null
}

function parseRecentSearch(item: unknown): RecentSearch | null {
  if (typeof item === 'string') return { text: item, at: null }
  if (
    typeof item === 'object' &&
    item !== null &&
    'text' in item &&
    typeof item.text === 'string'
  ) {
    const at = 'at' in item && typeof item.at === 'number' ? item.at : null
    return { text: item.text, at }
  }
  return null
}

/**
 * The recent searches of an account with their date, the newest first. A
 * list stored before the dates existed (plain strings) is still read.
 */
export function readRecentSearchEntries(
  accountId: string,
  storage: SearchStorage | null = getStorage()
): RecentSearch[] {
  try {
    const raw = storage?.getItem(RECENT_SEARCHES_STORAGE_PREFIX + accountId)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed
          .map(parseRecentSearch)
          .filter((item): item is RecentSearch => item !== null)
          .slice(0, MAX_RECENT_SEARCHES)
      : []
  } catch {
    // A broken value is as good as none
    return []
  }
}

/** The recent searches of an account, the newest first */
export function readRecentSearches(
  accountId: string,
  storage: SearchStorage | null = getStorage()
): string[] {
  return readRecentSearchEntries(accountId, storage).map(item => item.text)
}

/** Puts `text` first among the recent searches of an account */
export function addRecentSearch(
  accountId: string,
  text: string,
  storage: SearchStorage | null = getStorage(),
  now: number = Date.now()
): void {
  const trimmed = text.trim()
  if (trimmed === '') return
  const recent = [
    { text: trimmed, at: now },
    ...readRecentSearchEntries(accountId, storage).filter(
      item => item.text !== trimmed
    )
  ].slice(0, MAX_RECENT_SEARCHES)
  write(
    storage,
    RECENT_SEARCHES_STORAGE_PREFIX + accountId,
    JSON.stringify(recent)
  )
}
