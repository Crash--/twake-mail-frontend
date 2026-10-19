import {
  addRecentSearch,
  clearRecentSearches,
  MAX_RECENT_SEARCHES,
  readRecentSearchEntries,
  readRecentSearches,
  readSortOrder,
  storeSortOrder
} from './searchStorage'

function makeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    }
  }
}

describe('search storage', () => {
  it('remembers the sort order, relevance by default', () => {
    const storage = makeStorage()

    expect(readSortOrder(storage)).toBe('relevance')
    storeSortOrder('oldest', storage)
    expect(readSortOrder(storage)).toBe('oldest')
  })

  it('ignores an unknown stored order', () => {
    const storage = makeStorage()
    storage.setItem('twake-mail.search.sort-order', 'random')

    expect(readSortOrder(storage)).toBe('relevance')
  })

  it('keeps the recent searches of each account, newest first, once', () => {
    const storage = makeStorage()

    addRecentSearch('a', 'invoice', storage)
    addRecentSearch('a', 'report', storage)
    addRecentSearch('a', ' invoice ', storage)
    addRecentSearch('b', 'other', storage)
    addRecentSearch('a', '  ', storage)

    expect(readRecentSearches('a', storage)).toEqual(['invoice', 'report'])
    expect(readRecentSearches('b', storage)).toEqual(['other'])
  })

  it('dates each recent search and still reads the ones stored without a date', () => {
    const storage = makeStorage()
    storage.setItem('twake-mail.search.recent.a', JSON.stringify(['old']))

    addRecentSearch('a', 'new', storage, 1_000)

    expect(readRecentSearchEntries('a', storage)).toEqual([
      { text: 'new', at: 1_000 },
      { text: 'old', at: null }
    ])
  })

  it('keeps the ten most recent searches', () => {
    const storage = makeStorage()
    for (let index = 0; index < 12; index++) {
      addRecentSearch('a', `search ${index}`, storage)
    }

    const recent = readRecentSearches('a', storage)
    expect(recent).toHaveLength(MAX_RECENT_SEARCHES)
    expect(recent[0]).toBe('search 11')
  })

  it('forgets the recent searches of every account and keeps the sort order', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string): string | null => values.get(key) ?? null,
      setItem: (key: string, value: string): void => {
        values.set(key, value)
      },
      removeItem: (key: string): void => {
        values.delete(key)
      },
      key: (index: number): string | null => [...values.keys()][index] ?? null,
      get length(): number {
        return values.size
      }
    }
    addRecentSearch('a', 'invoice', storage)
    addRecentSearch('b', 'report', storage)
    storeSortOrder('oldest', storage)
    storage.setItem('twake-mail.theme', 'dark')

    clearRecentSearches(storage)

    expect(readRecentSearches('a', storage)).toEqual([])
    expect(readRecentSearches('b', storage)).toEqual([])
    expect(readSortOrder(storage)).toBe('oldest')
    expect(storage.getItem('twake-mail.theme')).toBe('dark')
  })
})
