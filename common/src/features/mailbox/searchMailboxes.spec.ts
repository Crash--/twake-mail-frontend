import { makeMailbox } from '@common/testing/fakeJmapServer'

import { searchMailboxes } from './searchMailboxes'

const TEAM = 'TeamMailbox[team@example.com]'
const MAILBOXES = [
  makeMailbox({ id: 'inbox', name: 'INBOX', role: 'inbox' }),
  makeMailbox({ id: 'work', name: 'Work' }),
  makeMailbox({ id: 'clients', name: 'Clients', parentId: 'work' }),
  makeMailbox({ id: 'hidden', name: 'Clients 2019', isSubscribed: false }),
  makeMailbox({ id: 'team', name: 'sales', namespace: TEAM }),
  makeMailbox({
    id: 'team-clients',
    name: 'Clients',
    parentId: 'team',
    namespace: TEAM
  })
]
const getName = (mailbox: { name: string; role: string | null }): string =>
  mailbox.role === 'inbox' ? 'Inbox' : mailbox.name

describe('searchMailboxes', () => {
  it('finds nothing without a query', () => {
    expect(searchMailboxes(MAILBOXES, '', getName)).toEqual([])
    expect(searchMailboxes(MAILBOXES, '   ', getName)).toEqual([])
  })

  it('matches the displayed name, not the real one', () => {
    const found = searchMailboxes(MAILBOXES, 'inbox', getName)

    expect(found.map(({ row }) => row.mailbox.id)).toEqual(['inbox'])
  })

  it('gives the path of a subfolder, none for a top level folder', () => {
    const found = searchMailboxes(MAILBOXES, 'sales', getName)
    expect(found.map(({ path }) => path)).toEqual([null])

    const clients = searchMailboxes(MAILBOXES, 'clients', getName)
    expect(clients.map(({ row, path }) => [row.mailbox.id, path])).toEqual([
      ['hidden', null],
      ['clients', 'Work/Clients'],
      ['team-clients', 'sales/Clients']
    ])
  })

  it('numbers the flat rows for the tree semantics', () => {
    const rows = searchMailboxes(MAILBOXES, 'clients', getName).map(
      ({ row }) => row
    )

    expect(
      rows.map(row => [row.level, row.position, row.siblingCount])
    ).toEqual([
      [1, 1, 3],
      [1, 2, 3],
      [1, 3, 3]
    ])
    expect(rows.every(row => !row.hasChildren && !row.isExpanded)).toBe(true)
  })
})
