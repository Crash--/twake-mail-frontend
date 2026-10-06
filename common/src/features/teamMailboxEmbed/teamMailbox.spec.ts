import { makeMailbox, makeTeamMailboxes } from '@common/testing/fakeJmapServer'

import {
  findTeamInboxId,
  findTeamMailboxRoot,
  isInTeamMailbox
} from './teamMailbox'

const MAILBOXES = [
  makeMailbox({ id: 'inbox', name: 'Inbox', role: 'inbox' }),
  ...makeTeamMailboxes({ id: 'sales', address: 'Sales@example.com' }),
  ...makeTeamMailboxes({ id: 'team', address: 'team@example.com' })
]

describe('team mailbox of the facade', () => {
  it('tells the folders of one team mailbox, without case', () => {
    const sales = MAILBOXES.filter(mailbox =>
      isInTeamMailbox(mailbox, 'sales@example.com')
    )

    expect(sales.map(({ id }) => id)).toEqual([
      'sales',
      'sales-inbox',
      'sales-drafts',
      'sales-outbox',
      'sales-sent',
      'sales-trash',
      'sales-templates'
    ])
  })

  it('finds the root, none for a mailbox the user is not a member of', () => {
    expect(findTeamMailboxRoot(MAILBOXES, 'team@example.com')?.id).toBe('team')
    expect(findTeamMailboxRoot(MAILBOXES, 'other@example.com')).toBe(null)
  })

  it('opens on the Inbox of the team mailbox, never the one of the user', () => {
    expect(findTeamInboxId(MAILBOXES, 'sales@example.com')).toBe('sales-inbox')
    expect(findTeamInboxId(MAILBOXES, 'other@example.com')).toBe(null)
  })

  it('falls back to the first folder when the Inbox is missing', () => {
    const withoutInbox = MAILBOXES.filter(({ id }) => id !== 'team-inbox')

    expect(findTeamInboxId(withoutInbox, 'team@example.com')).toBe(
      'team-drafts'
    )
  })
})
