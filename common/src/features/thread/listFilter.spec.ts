import {
  availableListFilters,
  mailboxFilterRequest,
  withListFilter
} from './listFilter'

describe('list filters', () => {
  it('offers every filter, except starred in Starred', () => {
    expect(availableListFilters({ isStarredView: false })).toEqual([
      'attachments',
      'unread',
      'starred'
    ])
    expect(availableListFilters({ isStarredView: true })).toEqual([
      'attachments',
      'unread'
    ])
  })

  it('has no unread filter in Action required, which lists unread emails', () => {
    expect(
      availableListFilters({ isStarredView: false, isActionRequiredView: true })
    ).toEqual(['attachments', 'starred'])
  })

  it('leaves a request alone for "all"', () => {
    const request = { filter: { hasKeyword: '$flagged' }, sort: [] }

    expect(withListFilter(request, 'all')).toBe(request)
  })

  it('ands the condition of the filter to the request', () => {
    expect(
      withListFilter({ filter: { hasKeyword: 'label' }, sort: [] }, 'unread')
        .filter
    ).toEqual({
      operator: 'AND',
      conditions: [{ hasKeyword: 'label' }, { notKeyword: '$seen' }]
    })
  })

  it('makes a folder request that remembers its folder', () => {
    expect(mailboxFilterRequest('inbox', 'attachments', true)).toEqual({
      filter: {
        operator: 'AND',
        conditions: [{ inMailbox: 'inbox' }, { hasAttachment: true }]
      },
      sort: [{ property: 'receivedAt', isAscending: false }],
      collapseThreads: true,
      isListFiltered: true,
      mailboxId: 'inbox'
    })
  })
})
