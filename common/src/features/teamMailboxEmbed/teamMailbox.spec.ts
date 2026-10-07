import { makeMailbox, makeTeamMailboxes } from '@common/testing/fakeJmapServer'

import {
  findTeamInboxId,
  findTeamMailboxBadges,
  findTeamMailboxRoot,
  isInTeamMailbox
} from './teamMailbox'

const MAILBOXES = [
  makeMailbox({ id: 'inbox', name: 'Inbox', role: 'inbox' }),
  ...makeTeamMailboxes({ id: 'sales', address: 'sales@example.com' }),
  ...makeTeamMailboxes({ id: 'team', address: 'team@example.com' })
]

describe('team mailbox of the facade', () => {
  it('finds the root by its id, none for a mailbox the user cannot see', () => {
    expect(findTeamMailboxRoot(MAILBOXES, 'team')?.name).toBe('team')
    expect(findTeamMailboxRoot(MAILBOXES, 'other')).toBe(null)
  })

  it('takes neither a folder of the team mailbox nor one of the user for its root', () => {
    expect(findTeamMailboxRoot(MAILBOXES, 'team-inbox')).toBe(null)
    expect(findTeamMailboxRoot(MAILBOXES, 'inbox')).toBe(null)
  })

  it('tells the folders of one team mailbox', () => {
    const root = findTeamMailboxRoot(MAILBOXES, 'sales')
    if (root === null) throw new Error('No root')

    expect(
      MAILBOXES.filter(mailbox => isInTeamMailbox(mailbox, root)).map(
        ({ id }) => id
      )
    ).toEqual([
      'sales',
      'sales-inbox',
      'sales-drafts',
      'sales-outbox',
      'sales-sent',
      'sales-trash',
      'sales-templates'
    ])
  })

  it('opens on the Inbox of the team mailbox, never the one of the user', () => {
    expect(findTeamInboxId(MAILBOXES, 'sales')).toBe('sales-inbox')
    expect(findTeamInboxId(MAILBOXES, 'other')).toBe(null)
  })

  it('falls back to the first folder when the Inbox is missing', () => {
    const withoutInbox = MAILBOXES.filter(({ id }) => id !== 'team-inbox')

    expect(findTeamInboxId(withoutInbox, 'team')).toBe('team-drafts')
  })

  it('reports the unread emails of the Inbox of every team mailbox, not of its other folders', () => {
    const mailboxes = [
      makeMailbox({
        id: 'inbox',
        name: 'Inbox',
        role: 'inbox',
        unreadEmails: 7
      }),
      ...makeTeamMailboxes({ id: 'sales', address: 'sales@example.com' }).map(
        mailbox =>
          mailbox.id === 'sales-inbox' || mailbox.id === 'sales-trash'
            ? { ...mailbox, unreadEmails: 3 }
            : mailbox
      ),
      ...makeTeamMailboxes({ id: 'team', address: 'team@example.com' })
    ]

    expect(findTeamMailboxBadges(mailboxes)).toEqual([
      { resourceId: 'sales', count: 3 },
      { resourceId: 'team', count: 0 }
    ])
  })

  it('reports no unread email for a team mailbox without an Inbox', () => {
    const withoutInbox = MAILBOXES.filter(({ id }) => id !== 'team-inbox')

    expect(findTeamMailboxBadges(withoutInbox)).toContainEqual({
      resourceId: 'team',
      count: 0
    })
  })
})
