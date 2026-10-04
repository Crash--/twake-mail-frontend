import { makeMailbox } from '@common/testing/fakeJmapServer'

import { patchMailboxes, type MailboxChanges } from './patchMailboxes'
import type { MailboxListData } from './queries'

function data(state = 'm1'): MailboxListData {
  return {
    state,
    list: [
      makeMailbox({
        id: 'inbox',
        name: 'INBOX',
        role: 'inbox',
        unreadEmails: 2
      }),
      makeMailbox({ id: 'projects', name: 'Projects' })
    ]
  }
}

function changes(overrides: Partial<MailboxChanges> = {}): MailboxChanges {
  return {
    changed: [],
    destroyed: [],
    oldState: 'm1',
    newState: 'm2',
    ...overrides
  }
}

describe('patchMailboxes', () => {
  it('replaces the updated mailboxes and moves to the new state', () => {
    const patched = patchMailboxes(
      data(),
      changes({
        changed: [
          makeMailbox({
            id: 'inbox',
            name: 'INBOX',
            role: 'inbox',
            unreadEmails: 5
          })
        ]
      })
    )

    expect(patched.state).toBe('m2')
    expect(
      patched.list.map(mailbox => [mailbox.id, mailbox.unreadEmails])
    ).toEqual([
      ['inbox', 5],
      ['projects', 0]
    ])
  })

  it('adds the created mailboxes and removes the destroyed ones', () => {
    const patched = patchMailboxes(
      data(),
      changes({
        changed: [makeMailbox({ id: 'travel', name: 'Travel' })],
        destroyed: ['projects']
      })
    )

    expect(patched.list.map(mailbox => mailbox.id)).toEqual(['inbox', 'travel'])
  })

  it('keeps the state of mailboxes refetched since the changes started', () => {
    const patched = patchMailboxes(data('m9'), changes())

    expect(patched.state).toBe('m9')
  })
})
