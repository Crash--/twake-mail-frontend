import { makeEmail } from '@common/testing/fakeJmapServer'

import { patchConversation } from './patchConversation'
import type { ConversationData } from './queries'

function conversation(): ConversationData {
  return {
    state: 's1',
    emails: [
      makeEmail({ id: 'a', threadId: 't', receivedAt: '2026-10-01T08:00:00Z' }),
      makeEmail({ id: 'b', threadId: 't', receivedAt: '2026-10-02T08:00:00Z' })
    ]
  }
}

const NEW_STATES = new Map([['s1', 's2']])

describe('patchConversation', () => {
  it('adds a reply of the thread in date order, and ignores other threads', () => {
    const patched = patchConversation(conversation(), 't', {
      changed: [
        makeEmail({
          id: 'c',
          threadId: 't',
          receivedAt: '2026-10-03T08:00:00Z'
        }),
        makeEmail({ id: 'x', threadId: 'other' })
      ],
      destroyed: [],
      newStates: NEW_STATES
    })

    expect(patched.emails.map(email => email.id)).toEqual(['a', 'b', 'c'])
    expect(patched.state).toBe('s2')
  })

  it('updates the keywords of a message and removes a destroyed one', () => {
    const patched = patchConversation(conversation(), 't', {
      changed: [
        makeEmail({
          id: 'b',
          threadId: 't',
          receivedAt: '2026-10-02T08:00:00Z',
          keywords: { $seen: true }
        })
      ],
      destroyed: ['a'],
      newStates: NEW_STATES
    })

    expect(patched.emails.map(email => email.id)).toEqual(['b'])
    expect(patched.emails[0]?.keywords).toEqual({ $seen: true })
  })
})
