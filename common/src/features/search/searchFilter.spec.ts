import {
  EMPTY_SEARCH_FILTER,
  isEmptySearch,
  parseSearchParams,
  searchPath,
  splitWords,
  toJmapFilter,
  toSearchParams,
  toSearchRequest,
  withTypedText,
  type SearchFilter
} from './searchFilter'

const CONTEXT = { trashAndSpamIds: ['trash', 'spam'], today: '2026-10-04' }

function filter(overrides: Partial<SearchFilter>): SearchFilter {
  return { ...EMPTY_SEARCH_FILTER, ...overrides }
}

/** Midnight in the time zone of the test run, as JMAP UTCDate */
function midnight(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day).toISOString().replace('.000Z', 'Z')
}

describe('search filter URL', () => {
  it('round trips every criterion through the URL', () => {
    const original = filter({
      text: 'invoice',
      from: ['alice@example.com', 'bob'],
      to: ['carol'],
      subject: 'Q3',
      notWords: ['draft', 'old'],
      scope: { kind: 'mailbox', mailboxId: 'inbox' },
      dateRange: 'custom',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      hasAttachment: true,
      unread: true,
      starred: true,
      sort: 'oldest'
    })

    const params = toSearchParams(original)

    expect(parseSearchParams(params)).toEqual(original)
    expect(params.get('q')).toBe('invoice')
    expect(params.getAll('from')).toEqual(['alice@example.com', 'bob'])
  })

  it('reads missing or invalid values as the defaults', () => {
    const params = new URLSearchParams('date=tomorrow&sort=random&start=x')

    expect(parseSearchParams(params)).toEqual(EMPTY_SEARCH_FILTER)
  })

  it('takes the order the user last picked when the URL has none', () => {
    expect(parseSearchParams(new URLSearchParams(), 'oldest').sort).toBe(
      'oldest'
    )
  })

  it('searches everywhere with in=all', () => {
    const everywhere = filter({ scope: { kind: 'everywhere' } })

    expect(searchPath(everywhere)).toBe('/search?in=all&sort=relevance')
    expect(parseSearchParams(toSearchParams(everywhere)).scope).toEqual({
      kind: 'everywhere'
    })
  })
})

describe('search filter helpers', () => {
  it('splits comma separated words', () => {
    expect(splitWords(' a, b ,,c ')).toEqual(['a', 'b', 'c'])
  })

  it('searches the sender of a typed email address', () => {
    expect(withTypedText(EMPTY_SEARCH_FILTER, ' bob@example.com ')).toEqual(
      filter({ from: ['bob@example.com'] })
    )
    expect(withTypedText(filter({ hasAttachment: true }), 'report')).toEqual(
      filter({ text: 'report', hasAttachment: true })
    )
  })

  it('tells an empty search, whatever its order', () => {
    expect(isEmptySearch(filter({ sort: 'oldest' }))).toBe(true)
    expect(isEmptySearch(filter({ unread: true }))).toBe(false)
  })
})

describe('toJmapFilter', () => {
  it('leaves the trash and the spam out by default', () => {
    expect(toJmapFilter(filter({ text: 'hello' }), CONTEXT)).toEqual({
      text: 'hello',
      inMailboxOtherThan: ['trash', 'spam']
    })
  })

  it('searches one mailbox, or everywhere', () => {
    expect(
      toJmapFilter(
        filter({ scope: { kind: 'mailbox', mailboxId: 'inbox' } }),
        CONTEXT
      )
    ).toEqual({ inMailbox: 'inbox' })
    expect(
      toJmapFilter(filter({ scope: { kind: 'everywhere' } }), CONTEXT)
    ).toEqual({})
  })

  it('maps the quick filters to keywords and attachments', () => {
    expect(
      toJmapFilter(
        filter({ hasAttachment: true, unread: true, starred: true }),
        { ...CONTEXT, trashAndSpamIds: [] }
      )
    ).toEqual({
      hasAttachment: true,
      notKeyword: '$seen',
      hasKeyword: '$flagged'
    })
  })

  it('searches the emails of a label, in a condition of its own when starred too', () => {
    expect(
      toJmapFilter(filter({ label: 'work' }), {
        ...CONTEXT,
        trashAndSpamIds: []
      })
    ).toEqual({ hasKeyword: 'work' })
    expect(
      toJmapFilter(filter({ label: 'work', starred: true }), {
        ...CONTEXT,
        trashAndSpamIds: []
      })
    ).toEqual({
      operator: 'AND',
      conditions: [{ hasKeyword: '$flagged' }, { hasKeyword: 'work' }]
    })
  })

  it('counts relative ranges from midnight, without an end', () => {
    expect(toJmapFilter(filter({ dateRange: 'last7Days' }), CONTEXT)).toEqual({
      after: midnight(2026, 9, 27),
      inMailboxOtherThan: ['trash', 'spam']
    })
  })

  it('includes both days of a custom range', () => {
    const range = filter({
      scope: { kind: 'everywhere' },
      dateRange: 'custom',
      startDate: '2026-09-01',
      endDate: '2026-09-30'
    })

    expect(toJmapFilter(range, CONTEXT)).toEqual({
      after: midnight(2026, 9, 1),
      before: midnight(2026, 10, 1)
    })
  })

  it('combines senders, recipients and excluded words with operators', () => {
    const advanced = filter({
      scope: { kind: 'everywhere' },
      subject: 'report',
      from: ['alice', 'bob'],
      to: ['carol'],
      notWords: ['draft']
    })

    expect(toJmapFilter(advanced, CONTEXT)).toEqual({
      operator: 'AND',
      conditions: [
        { subject: 'report' },
        { operator: 'OR', conditions: [{ from: 'alice' }, { from: 'bob' }] },
        {
          operator: 'OR',
          conditions: [{ to: 'carol' }, { cc: 'carol' }, { bcc: 'carol' }]
        },
        { operator: 'NOT', conditions: [{ text: 'draft' }] }
      ]
    })
  })

  it('keeps a single sender in the main condition', () => {
    expect(
      toJmapFilter(
        filter({ from: ['alice'], scope: { kind: 'everywhere' } }),
        CONTEXT
      )
    ).toEqual({ from: 'alice' })
  })
})

describe('toSearchRequest', () => {
  it('sends no comparator for relevance, the server ranks', () => {
    expect(toSearchRequest(EMPTY_SEARCH_FILTER, CONTEXT).sort).toEqual([])
    expect(
      toSearchRequest(filter({ sort: 'senderDescending' }), CONTEXT).sort
    ).toEqual([{ property: 'from', isAscending: false }])
  })
})
