import { makeEmail } from '@common/testing/fakeJmapServer'

import {
  patchThreadList,
  threadRowMember,
  type ThreadListChanges
} from './patchThreadList'
import type {
  EmailListData,
  EmailListItemData,
  EmailListPage,
  ThreadMember
} from './queries'

const INBOX = 'mailbox-inbox'
const ARCHIVE = 'mailbox-archive'
const SENT = 'mailbox-sent'

/** An email of thread `threadId` received on day `day` of October 2026 */
function email(
  id: string,
  threadId: string,
  day: number,
  overrides: Partial<EmailListItemData> = {}
): EmailListItemData {
  return makeEmail({
    id,
    threadId,
    receivedAt: `2026-10-${String(day).padStart(2, '0')}T08:00:00Z`,
    ...overrides
  })
}

function member(source: EmailListItemData): ThreadMember {
  const {
    id,
    threadId,
    mailboxIds,
    keywords,
    receivedAt,
    from,
    to,
    hasAttachment
  } = source
  return {
    id,
    threadId,
    mailboxIds,
    keywords,
    receivedAt,
    from,
    to,
    hasAttachment
  }
}

/** A page of conversations: each row with every email of its thread */
function page(
  rows: { row: EmailListItemData; others?: EmailListItemData[] }[],
  position: number,
  { isLast = false } = {}
): EmailListPage {
  return {
    emails: rows.map(({ row }) => row),
    position,
    count: rows.length,
    total: 10,
    isLast,
    state: 's1',
    threads: Object.fromEntries(
      rows.map(({ row, others = [] }) => [
        row.threadId,
        [...others, row].map(member)
      ])
    )
  }
}

// Conversations: "a" (a1 on the 10th, a2 on the 20th), "b" (b1 on the 18th,
// with b0 in Sent on the 19th), "c" (c1 on the 16th), "d" (d1 on the 14th)
const a1 = email('a1', 'a', 10)
const a2 = email('a2', 'a', 20)
const b0 = email('b0', 'b', 19, { mailboxIds: { [SENT]: true } })
const b1 = email('b1', 'b', 18)
const c1 = email('c1', 'c', 16)
const d1 = email('d1', 'd', 14)

function conversations({ isLast = false } = {}): EmailListData {
  return {
    pages: [
      page(
        [
          { row: a2, others: [a1] },
          { row: b1, others: [b0] }
        ],
        0
      ),
      page([{ row: c1 }, { row: d1 }], 2, { isLast })
    ],
    pageParams: [0, 2]
  }
}

function changes(
  overrides: Partial<ThreadListChanges> = {}
): ThreadListChanges {
  return {
    changed: [],
    destroyed: [],
    newStates: new Map([['s1', 's2']]),
    ...overrides
  }
}

function rows(data: EmailListData): string[] {
  return data.pages.flatMap(current => current.emails.map(row => row.id))
}

function memberIds(data: EmailListData, threadId: string): string[] {
  const list = data.pages.find(current => current.threads?.[threadId])
    ?.threads?.[threadId]
  return list?.map(item => item.id) ?? []
}

describe('patchThreadList', () => {
  it('moves a conversation to the top when a reply arrives', () => {
    const reply = email('c2', 'c', 21, { subject: 'Re: c' })

    const { data, unknownThreadIds, missingRowIds } = patchThreadList(
      conversations(),
      INBOX,
      changes({ changed: [reply] })
    )

    expect(rows(data)).toEqual(['c2', 'a2', 'b1', 'd1'])
    expect(memberIds(data, 'c')).toEqual(['c1', 'c2'])
    expect(data.pages.map(current => current.position)).toEqual([0, 3])
    expect(data.pages.map(current => current.count)).toEqual([3, 1])
    expect(data.pages[0]?.total).toBe(10)
    expect(data.pages.map(current => current.state)).toEqual(['s2', 's2'])
    expect(unknownThreadIds).toEqual([])
    expect(missingRowIds).toEqual([])
  })

  it('updates the members of a conversation in place', () => {
    const read = { ...a1, keywords: { $seen: true as const } }

    const { data } = patchThreadList(
      conversations(),
      INBOX,
      changes({ changed: [read] })
    )

    expect(rows(data)).toEqual(['a2', 'b1', 'c1', 'd1'])
    const thread = data.pages[0]?.threads?.a
    expect(thread?.find(item => item.id === 'a1')?.keywords).toEqual({
      $seen: true
    })
  })

  it('keeps the row of a partial update (an optimistic one) whole', () => {
    const { data } = patchThreadList(
      conversations(),
      INBOX,
      changes({
        changed: [
          {
            id: 'b1',
            mailboxIds: { [INBOX]: true },
            keywords: { $flagged: true }
          }
        ]
      })
    )

    const row = data.pages[0]?.emails[1]
    expect(row?.id).toBe('b1')
    expect(row?.subject).toBe('Subject b1')
    expect(row?.keywords).toEqual({ $flagged: true })
  })

  it('removes a conversation that has no email left in the mailbox', () => {
    const archived = [a1, a2].map(item => ({
      ...item,
      mailboxIds: { [ARCHIVE]: true as const }
    }))

    const { data } = patchThreadList(
      conversations(),
      INBOX,
      changes({ changed: archived })
    )

    expect(rows(data)).toEqual(['b1', 'c1', 'd1'])
    expect(data.pages[0]?.total).toBe(9)
    expect(data.pages[1]?.position).toBe(1)
  })

  it('asks for the row of the email now standing for a conversation', () => {
    const before = conversations()

    const asking = patchThreadList(
      before,
      INBOX,
      changes({ destroyed: ['a2'] })
    )
    expect(asking.missingRowIds).toEqual(['a1'])
    expect(rows(asking.data)).toEqual(['a2', 'b1', 'c1', 'd1'])

    const { data } = patchThreadList(
      before,
      INBOX,
      changes({ destroyed: ['a2'], rows: new Map([['a1', a1]]) })
    )
    // a1 (the 10th) sorts after the loaded rows: it comes with its page
    expect(rows(data)).toEqual(['b1', 'c1', 'd1'])
  })

  it('brings in a new conversation once its members are known', () => {
    const fresh = email('e1', 'e', 17)
    const before = conversations()

    const asking = patchThreadList(before, INBOX, changes({ changed: [fresh] }))
    expect(asking.unknownThreadIds).toEqual(['e'])
    expect(rows(asking.data)).toEqual(['a2', 'b1', 'c1', 'd1'])

    const older = email('e0', 'e', 2, { mailboxIds: { [ARCHIVE]: true } })
    const { data } = patchThreadList(
      before,
      INBOX,
      changes({
        changed: [fresh],
        threads: new Map([['e', [member(older), member(fresh)]]])
      })
    )
    expect(rows(data)).toEqual(['a2', 'b1', 'e1', 'c1', 'd1'])
    expect(memberIds(data, 'e')).toEqual(['e0', 'e1'])
  })

  it('does not ask for a conversation that sorts below the loaded rows', () => {
    const old = email('f1', 'f', 3)

    const { unknownThreadIds } = patchThreadList(
      conversations(),
      INBOX,
      changes({ changed: [old] })
    )

    expect(unknownThreadIds).toEqual([])
  })

  it('finds the most recent email of a conversation in a mailbox', () => {
    expect(threadRowMember([a1, a2, b0].map(member), INBOX)?.id).toBe('a2')
    expect(threadRowMember([member(b0)], INBOX)).toBe(null)
  })
})
