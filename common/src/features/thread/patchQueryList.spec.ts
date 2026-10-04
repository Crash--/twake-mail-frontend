import type { EmailChanges } from './patchEmailList'
import type { EmailListData, EmailListItemData, EmailListPage } from './queries'
import { makeEmail } from '@common/testing/fakeJmapServer'

import { patchQueryList } from './patchQueryList'

const INBOX = 'mailbox-inbox'
const ARCHIVE = 'mailbox-archive'

function email(
  id: string,
  overrides: Partial<EmailListItemData> = {}
): EmailListItemData {
  return makeEmail({ id, ...overrides })
}

function page(
  emails: EmailListItemData[],
  position: number,
  state = 's1'
): EmailListPage {
  return {
    emails,
    position,
    count: emails.length,
    total: 4,
    isLast: false,
    state,
    snippets: { [emails[0]?.id ?? '']: { subject: 'x', preview: null } }
  }
}

function results(): EmailListData {
  return {
    pages: [page([email('a'), email('b')], 0), page([email('c')], 2)],
    pageParams: [0, 2]
  }
}

function changes(overrides: Partial<EmailChanges> = {}): EmailChanges {
  return {
    changed: [],
    destroyed: [],
    newStates: new Map([['s1', 's2']]),
    ...overrides
  }
}

function ids(data: EmailListData): string[][] {
  return data.pages.map(item => item.emails.map(({ id }) => id))
}

describe('patchQueryList', () => {
  it('keeps an archived result in place, with its new mailboxes', () => {
    const archived = email('b', { mailboxIds: { [ARCHIVE]: true } })

    const { data, needsRefresh } = patchQueryList(
      results(),
      changes({ changed: [archived] })
    )

    expect(ids(data)).toEqual([['a', 'b'], ['c']])
    expect(data.pages[0]?.emails[1]?.mailboxIds).toEqual({ [ARCHIVE]: true })
    expect(data.pages[0]?.state).toBe('s2')
    expect(data.pages[0]?.snippets).toEqual({
      a: { subject: 'x', preview: null }
    })
    expect(needsRefresh).toBe(false)
  })

  it('removes a destroyed result and moves the next pages up', () => {
    const { data } = patchQueryList(results(), changes({ destroyed: ['a'] }))

    expect(ids(data)).toEqual([['b'], ['c']])
    expect(data.pages[1]?.position).toBe(1)
    expect(data.pageParams).toEqual([0, 1])
    expect(data.pages[0]?.total).toBe(3)
  })

  it('reports the changed emails the results do not list', () => {
    const arrived = email('z', { mailboxIds: { [INBOX]: true } })

    const { data, needsRefresh } = patchQueryList(
      results(),
      changes({ changed: [arrived] })
    )

    expect(ids(data)).toEqual([['a', 'b'], ['c']])
    expect(needsRefresh).toBe(true)
  })

  it('removes an email that left the mailbox of the list', () => {
    const archived = email('b', { mailboxIds: { [ARCHIVE]: true } })

    const { data, needsRefresh } = patchQueryList(
      results(),
      changes({ changed: [archived] }),
      { mailboxId: INBOX }
    )

    expect(ids(data)).toEqual([['a'], ['c']])
    expect(needsRefresh).toBe(false)
  })

  it('asks for a refresh when a conversation loses its email', () => {
    const { needsRefresh } = patchQueryList(
      results(),
      changes({ destroyed: ['a'] }),
      { mailboxId: INBOX, isCollapsed: true }
    )

    expect(needsRefresh).toBe(true)
  })
})
