import { makeEmail } from '@common/testing/fakeJmapServer'

import {
  keepFirstPage,
  patchEmailList,
  type EmailChanges
} from './patchEmailList'
import {
  getNextPosition,
  type EmailListData,
  type EmailListItemData,
  type EmailListPage
} from './queries'

const INBOX = 'mailbox-inbox'
const ARCHIVE = 'mailbox-archive'

/** An email of the inbox received on day `day` of October 2026 */
function email(
  id: string,
  day: number,
  overrides: Partial<EmailListItemData> = {}
): EmailListItemData {
  return makeEmail({
    id,
    receivedAt: `2026-10-${String(day).padStart(2, '0')}T08:00:00Z`,
    ...overrides
  })
}

function page(
  emails: EmailListItemData[],
  position: number,
  { isLast = false, state = 's1' }: { isLast?: boolean; state?: string } = {}
): EmailListPage {
  return {
    emails,
    position,
    count: emails.length,
    total: null,
    isLast,
    state
  }
}

/** Two pages of two emails: days 20, 18 then 16, 14 */
function twoPages({ isLast = false } = {}): EmailListData {
  const first = page([email('a', 20), email('b', 18)], 0)
  const second = page([email('c', 16), email('d', 14)], 2, { isLast })
  return { pages: [first, second], pageParams: [0, 2] }
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
  return data.pages.map(item => item.emails.map(row => row.id))
}

function nextPosition(data: EmailListData): number | undefined {
  const last = data.pages[data.pages.length - 1]
  return last ? getNextPosition(last) : undefined
}

describe('patchEmailList', () => {
  it('inserts a new email of the mailbox where receivedAt sorts it', () => {
    const data = patchEmailList(
      twoPages(),
      INBOX,
      changes({ changed: [email('new', 17)] })
    )

    expect(ids(data)).toEqual([
      ['a', 'b'],
      ['new', 'c', 'd']
    ])
    expect(data.pages.map(item => item.position)).toEqual([0, 2])
    expect(data.pageParams).toEqual([0, 2])
    // The server shifted the next results by one
    expect(nextPosition(data)).toBe(5)
  })

  it('puts the newest email at the top of the first page', () => {
    const data = patchEmailList(
      twoPages(),
      INBOX,
      changes({ changed: [email('new', 25)] })
    )

    expect(ids(data)).toEqual([
      ['new', 'a', 'b'],
      ['c', 'd']
    ])
    expect(data.pages.map(item => item.position)).toEqual([0, 3])
    expect(nextPosition(data)).toBe(5)
  })

  it('leaves out a new email older than the loaded ones, while more remain', () => {
    const data = patchEmailList(
      twoPages(),
      INBOX,
      changes({ changed: [email('old', 2)] })
    )

    expect(ids(data)).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
    expect(nextPosition(data)).toBe(4)
  })

  it('appends a new old email when the whole mailbox is loaded', () => {
    const data = patchEmailList(
      twoPages({ isLast: true }),
      INBOX,
      changes({ changed: [email('old', 2)] })
    )

    expect(ids(data)).toEqual([
      ['a', 'b'],
      ['c', 'd', 'old']
    ])
    expect(nextPosition(data)).toBe(undefined)
  })

  it('fills an empty mailbox', () => {
    const empty: EmailListData = {
      pages: [page([], 0, { isLast: true })],
      pageParams: [0]
    }

    const data = patchEmailList(
      empty,
      INBOX,
      changes({ changed: [email('first', 3)] })
    )

    expect(ids(data)).toEqual([['first']])
  })

  it('ignores a new email of another mailbox', () => {
    const data = patchEmailList(
      twoPages(),
      INBOX,
      changes({
        changed: [email('elsewhere', 17, { mailboxIds: { [ARCHIVE]: true } })]
      })
    )

    expect(ids(data)).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
  })

  it('updates the keywords of a listed email in place', () => {
    const data = patchEmailList(
      twoPages(),
      INBOX,
      changes({ changed: [email('c', 16, { keywords: { $seen: true } })] })
    )

    expect(ids(data)).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
    expect(data.pages[1]?.emails[0]?.keywords).toEqual({ $seen: true })
    expect(nextPosition(data)).toBe(4)
  })

  it('removes an email moved out of the mailbox, and shifts the next position', () => {
    const data = patchEmailList(
      twoPages(),
      INBOX,
      changes({
        changed: [email('b', 18, { mailboxIds: { [ARCHIVE]: true } })]
      })
    )

    expect(ids(data)).toEqual([['a'], ['c', 'd']])
    expect(data.pages.map(item => item.position)).toEqual([0, 1])
    expect(nextPosition(data)).toBe(3)
  })

  it('inserts an email moved into the mailbox', () => {
    const archive: EmailListData = {
      pages: [
        page([email('x', 21, { mailboxIds: { [ARCHIVE]: true } })], 0, {
          isLast: true
        })
      ],
      pageParams: [0]
    }

    const data = patchEmailList(
      archive,
      ARCHIVE,
      changes({
        changed: [email('b', 18, { mailboxIds: { [ARCHIVE]: true } })]
      })
    )

    expect(ids(data)).toEqual([['x', 'b']])
  })

  it('removes a destroyed email', () => {
    const data = patchEmailList(
      twoPages(),
      INBOX,
      changes({ destroyed: ['d'] })
    )

    expect(ids(data)).toEqual([['a', 'b'], ['c']])
    expect(nextPosition(data)).toBe(3)
  })

  it('updates the total the server counted, when it did', () => {
    const counted: EmailListData = {
      pages: [{ ...page([email('a', 20)], 0, { isLast: true }), total: 1 }],
      pageParams: [0]
    }

    const data = patchEmailList(
      counted,
      INBOX,
      changes({ changed: [email('new', 22)] })
    )

    expect(data.pages[0]?.total).toBe(2)
  })

  it('moves the pages to the new state of the state they were at, only', () => {
    const mixed: EmailListData = {
      pages: [
        page([email('a', 20)], 0),
        page([email('c', 16)], 1, { state: 'other' })
      ],
      pageParams: [0, 1]
    }

    const data = patchEmailList(mixed, INBOX, changes())

    expect(data.pages.map(item => item.state)).toEqual(['s2', 'other'])
  })

  it('lists an email once, even when two pages hold it', () => {
    const duplicated: EmailListData = {
      pages: [
        page([email('a', 20), email('b', 18)], 0),
        page([email('b', 18), email('c', 16)], 2)
      ],
      pageParams: [0, 2]
    }

    const data = patchEmailList(duplicated, INBOX, changes())

    expect(ids(data)).toEqual([['a', 'b'], ['c']])
  })
})

describe('keepFirstPage', () => {
  it('drops every page but the first one', () => {
    const data = keepFirstPage(twoPages())

    expect(ids(data)).toEqual([['a', 'b']])
    expect(data.pageParams).toEqual([0])
  })
})
