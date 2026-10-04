import type { ThreadMember } from './queries'
import { summarizeThread } from './threadSummary'

const ME = 'alice@example.com'

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
    hasAttachment: false,
    ...overrides
  }
}

describe('summarizeThread', () => {
  it('names each participant once, in order, the user as "me"', () => {
    const summary = summarizeThread(
      [
        member('m1', { name: 'Bob Dupont', email: 'bob@example.com' }),
        member('m2', { email: 'ALICE@example.com' }),
        member('m3', { name: 'Bob Dupont', email: 'bob@example.com' }),
        member('m4', { email: 'carol@example.com' })
      ],
      ME,
      'Me'
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
      ME,
      'Me'
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
      ME,
      'Me'
    )

    expect(summary).toMatchObject({
      isUnread: false,
      isStarred: false,
      hasAttachment: false
    })
  })
})
