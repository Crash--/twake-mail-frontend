import type { ThreadMember } from './queries'
import {
  isReceivedFromOthers,
  summarizeThread,
  type ThreadContext
} from './threadSummary'

const ME = 'alice@example.com'

function context(rowEmailId = 'm1'): ThreadContext {
  return { ownAddress: ME, meLabel: 'Me', sentId: 'sent', rowEmailId }
}

function member(
  id: string,
  from: { name?: string; email: string },
  overrides: Partial<ThreadMember> = {}
): ThreadMember {
  return {
    id,
    threadId: 't',
    mailboxIds: { inbox: true },
    keywords: { $seen: true },
    receivedAt: `2026-10-0${id.slice(-1)}T08:00:00Z`,
    from: [{ name: from.name ?? null, email: from.email }],
    to: [{ name: null, email: 'dan@example.com' }],
    hasAttachment: false,
    ...overrides
  }
}

describe('isReceivedFromOthers', () => {
  const BOB = { email: 'bob@example.com' }
  const isReceived = (email: ThreadMember): boolean =>
    isReceivedFromOthers(email, 'sent', ME)

  it('is true for an email someone else sent to the user', () => {
    expect(isReceived(member('m1', BOB))).toBe(true)
  })

  it('is false for an email in Sent, from the user or a draft', () => {
    const emails = [
      member('m1', BOB, { mailboxIds: { sent: true } }),
      member('m2', { email: 'Alice@Example.com' }),
      member('m3', BOB, { keywords: { $draft: true } })
    ]

    expect(emails.map(isReceived)).toEqual([false, false, false])
  })
})

describe('summarizeThread', () => {
  it('names each participant once, in order, the user as "me"', () => {
    const summary = summarizeThread(
      [
        member('m1', { name: 'Bob Dupont', email: 'bob@example.com' }),
        member('m2', { email: 'ALICE@example.com' }),
        member('m3', { name: 'Bob Dupont', email: 'bob@example.com' }),
        member('m4', { email: 'carol@example.com' })
      ],
      context()
    )

    expect(summary.participants).toEqual([
      'Bob Dupont',
      'Me',
      'carol@example.com'
    ])
    expect(summary.count).toBe(4)
  })

  it('takes the state of any of its emails', () => {
    const summary = summarizeThread(
      [
        member('m1', { email: 'bob@example.com' }, { hasAttachment: true }),
        member(
          'm2',
          { email: 'bob@example.com' },
          { keywords: { $flagged: true } }
        )
      ],
      context()
    )

    expect(summary).toMatchObject({
      isUnread: true,
      isStarred: true,
      hasAttachment: true
    })
  })

  it('is read and not starred when none of its emails is', () => {
    const summary = summarizeThread(
      [member('m1', { email: 'bob@example.com' })],
      context()
    )

    expect(summary).toMatchObject({
      isUnread: false,
      isStarred: false,
      hasAttachment: false
    })
  })

  it('does not count the copy in Sent of an email sent to oneself', () => {
    const toMe = { to: [{ name: null, email: ME }] }
    const members = [
      member('m1', { email: 'bob@example.com' }),
      member('m2', { email: ME }, { ...toMe, mailboxIds: { inbox: true } }),
      member('m3', { email: ME }, { ...toMe, mailboxIds: { sent: true } })
    ]

    expect(summarizeThread(members, context('m1')).count).toBe(2)
    expect(summarizeThread(members.slice(1), context('m2')).count).toBe(1)
    // Opened from Sent, the copy is the row: counted
    expect(summarizeThread(members, context('m3')).count).toBe(3)
    expect(summarizeThread(members, context('m1')).members).toHaveLength(3)
  })
})
