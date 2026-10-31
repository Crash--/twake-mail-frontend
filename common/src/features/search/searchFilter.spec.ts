import {
  elapsedMs,
  randomTexts,
  STRESS_TIME_LIMIT_MS
} from '@common/testing/redos'

import {
  EMPTY_SEARCH_FILTER,
  isEmptySearch,
  usesAdvancedFields,
  parseSearchParams,
  searchPath,
  splitWords,
  toJmapFilter,
  toSearchParams,
  toSearchRequest,
  withTypedText,
  type SearchFilter
} from './searchFilter'

const CONTEXT = {
  trashAndSpamIds: ['trash', 'spam'],
  teamFolderIds: { team: ['team-inbox', 'team-sent'], empty: [] },
  today: '2026-10-04'
}

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
      notIncludeEvents: true,
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

  it('searches the folders of a team mailbox picked by its root', () => {
    expect(
      toJmapFilter(
        filter({
          text: 'TEAM',
          scope: { kind: 'mailbox', mailboxId: 'team' }
        }),
        CONTEXT
      )
    ).toEqual({
      operator: 'AND',
      conditions: [
        { text: 'TEAM' },
        {
          operator: 'OR',
          conditions: [{ inMailbox: 'team-inbox' }, { inMailbox: 'team-sent' }]
        }
      ]
    })
    expect(
      toJmapFilter(
        filter({ scope: { kind: 'mailbox', mailboxId: 'empty' } }),
        CONTEXT
      )
    ).toEqual({ inMailbox: 'empty' })
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

  it('leaves the invitations out in a condition of their own, next to unread', () => {
    expect(
      toJmapFilter(filter({ notIncludeEvents: true }), {
        ...CONTEXT,
        trashAndSpamIds: []
      })
    ).toEqual({ notKeyword: 'event' })
    expect(
      toJmapFilter(filter({ notIncludeEvents: true, unread: true }), {
        ...CONTEXT,
        trashAndSpamIds: []
      })
    ).toEqual({
      operator: 'AND',
      conditions: [{ notKeyword: '$seen' }, { notKeyword: 'event' }]
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

  it('drops a custom bound a JMAP UTCDate cannot express', () => {
    const range = filter({
      scope: { kind: 'everywhere' },
      dateRange: 'custom',
      startDate: '2026-09-01',
      endDate: '9999-12-31'
    })

    expect(toJmapFilter(range, CONTEXT)).toEqual({
      after: midnight(2026, 9, 1)
    })
  })

  it('reads a two-digit year as itself, not as a 1900s year', () => {
    const range = filter({
      scope: { kind: 'everywhere' },
      dateRange: 'custom',
      startDate: '0050-03-01'
    })

    expect(toJmapFilter(range, CONTEXT)).toEqual({
      after: '0050-03-01T00:00:00Z'
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

  it('never sends a date bound outside the 4-digit years of a JMAP UTCDate', () => {
    const UTC_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    const params = new URLSearchParams(
      'date=custom&start=0000-01-01&end=9999-12-31'
    )
    const { filter: jmapFilter } = toSearchRequest(
      parseSearchParams(params),
      CONTEXT
    )
    const bounds = JSON.stringify(jmapFilter).match(/"(after|before)":"[^"]*"/g)

    expect(bounds).toEqual(['"after":"0000-01-01T00:00:00Z"'])
    expect(bounds?.[0]?.split('":"')[1]?.slice(0, -1)).toMatch(UTC_DATE)
  })

  it('tells a search using what only the advanced search sets', () => {
    expect(usesAdvancedFields(filter({ text: 'x', starred: true }))).toBe(false)
    expect(usesAdvancedFields(filter({ subject: 'report' }))).toBe(true)
    expect(usesAdvancedFields(filter({ notWords: ['draft'] }))).toBe(true)
    expect(
      usesAdvancedFields(
        filter({
          dateRange: 'custom',
          startDate: '2026-01-01',
          endDate: '2026-02-01'
        })
      )
    ).toBe(true)
  })
})

describe('withTypedText against ReDoS', () => {
  it('reads an address as the original pattern did', () => {
    const original = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/
    for (const typed of randomTexts(['a', '.', '@', ' ', ','], {
      count: 5000
    })) {
      expect([typed, withTypedText(EMPTY_SEARCH_FILTER, typed).from]).toEqual([
        typed,
        original.test(typed.trim()) ? [typed.trim()] : []
      ])
    }
  })

  it('reads a long text in a linear time', () => {
    const typed = 'a@a' + '.a'.repeat(25_000) + '.@..'
    expect(
      elapsedMs(() => withTypedText(EMPTY_SEARCH_FILTER, typed))
    ).toBeLessThan(STRESS_TIME_LIMIT_MS)
  })
})

describe('toJmapFilter bound to a team mailbox', () => {
  const BOUND = { ...CONTEXT, boundTeamRootId: 'team' }

  it('looks in the folders of the team mailbox by default and everywhere', () => {
    const inTeam = {
      operator: 'AND',
      conditions: [
        { text: 'report' },
        {
          operator: 'OR',
          conditions: [{ inMailbox: 'team-inbox' }, { inMailbox: 'team-sent' }]
        }
      ]
    }

    expect(toJmapFilter(filter({ text: 'report' }), BOUND)).toEqual(inTeam)
    expect(
      toJmapFilter(
        filter({ text: 'report', scope: { kind: 'everywhere' } }),
        BOUND
      )
    ).toEqual(inTeam)
    // A folder of the user: still the team mailbox
    expect(
      toJmapFilter(
        filter({
          text: 'report',
          scope: { kind: 'mailbox', mailboxId: 'personal-inbox' }
        }),
        BOUND
      )
    ).toEqual(inTeam)
  })

  it('keeps a folder of the team mailbox', () => {
    expect(
      toJmapFilter(
        filter({
          text: 'report',
          scope: { kind: 'mailbox', mailboxId: 'team-sent' }
        }),
        BOUND
      )
    ).toEqual({ text: 'report', inMailbox: 'team-sent' })
  })
})
