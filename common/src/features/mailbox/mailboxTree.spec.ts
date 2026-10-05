import { makeMailbox } from '@common/testing/fakeJmapServer'

import {
  findTemplatesMailboxId,
  isTemplatesMailbox,
  buildMailboxSections,
  buildMailboxTree,
  findAncestorIds,
  findDescendantIds,
  findMailboxIdByRole,
  listVisibleMailboxes,
  type MailboxNode
} from './mailboxTree'

function names(nodes: MailboxNode[]): string[] {
  return nodes.map(node => node.mailbox.name)
}

describe('buildMailboxTree', () => {
  it('puts system folders first, in the tmail-flutter order', () => {
    const tree = buildMailboxTree([
      makeMailbox({ id: '1', name: 'Projects', sortOrder: 1 }),
      makeMailbox({ id: '2', name: 'Archive', role: 'archive', sortOrder: 0 }),
      makeMailbox({ id: '3', name: 'Sent', role: 'sent', sortOrder: 50 }),
      makeMailbox({ id: '4', name: 'Spam', role: 'junk', sortOrder: 70 }),
      makeMailbox({ id: '5', name: 'INBOX', role: 'inbox', sortOrder: 10 }),
      makeMailbox({ id: '6', name: 'Drafts', role: 'drafts', sortOrder: 30 }),
      makeMailbox({ id: '7', name: 'Trash', role: 'trash', sortOrder: 60 }),
      makeMailbox({ id: '8', name: 'Templates', role: 'templates' }),
      makeMailbox({ id: '9', name: 'Outbox', role: 'outbox' })
    ])

    expect(names(tree)).toEqual([
      'INBOX',
      'Drafts',
      'Outbox',
      'Sent',
      'Trash',
      'Spam',
      'Templates',
      'Archive',
      'Projects'
    ])
  })

  it('orders the other folders by sortOrder, then by name', () => {
    const tree = buildMailboxTree([
      makeMailbox({ id: '1', name: 'zebra', sortOrder: 5 }),
      makeMailbox({ id: '2', name: 'Beta', sortOrder: 10 }),
      makeMailbox({ id: '3', name: 'alpha', sortOrder: 10 })
    ])

    expect(names(tree)).toEqual(['zebra', 'alpha', 'Beta'])
  })

  it('nests the folders under their parent, at any depth', () => {
    const tree = buildMailboxTree([
      makeMailbox({ id: 'c', name: 'Child', parentId: 'p' }),
      makeMailbox({ id: 'g', name: 'Grandchild', parentId: 'c' }),
      makeMailbox({ id: 'p', name: 'Parent' })
    ])

    expect(names(tree)).toEqual(['Parent'])
    expect(names(tree[0]?.children ?? [])).toEqual(['Child'])
    expect(names(tree[0]?.children[0]?.children ?? [])).toEqual(['Grandchild'])
  })

  it('keeps orphans and cycles at the top level', () => {
    const tree = buildMailboxTree([
      makeMailbox({ id: 'o', name: 'Orphan', parentId: 'missing' }),
      makeMailbox({ id: 'a', name: 'A', parentId: 'b' }),
      makeMailbox({ id: 'b', name: 'B', parentId: 'a' })
    ])

    expect(names(tree)).toEqual(['A', 'B', 'Orphan'])
  })
})

describe('listVisibleMailboxes', () => {
  const mailboxes = [
    makeMailbox({ id: 'inbox', name: 'INBOX', role: 'inbox' }),
    makeMailbox({ id: 'work', name: 'Work' }),
    makeMailbox({ id: 'a', name: 'A', parentId: 'work' }),
    makeMailbox({ id: 'b', name: 'B', parentId: 'work' }),
    makeMailbox({ id: 'a1', name: 'A1', parentId: 'a' })
  ]
  const tree = buildMailboxTree(mailboxes)

  it('leaves out the children of collapsed folders', () => {
    const rows = listVisibleMailboxes(tree, () => false)

    expect(rows.map(row => row.mailbox.id)).toEqual(['inbox', 'work'])
    expect(rows[1]).toEqual(
      expect.objectContaining({
        level: 1,
        hasChildren: true,
        isExpanded: false,
        position: 2,
        siblingCount: 2
      })
    )
  })

  it('lists the expanded folders depth first, with their level', () => {
    const rows = listVisibleMailboxes(tree, id => id === 'work' || id === 'a')

    expect(rows.map(row => [row.mailbox.id, row.level])).toEqual([
      ['inbox', 1],
      ['work', 1],
      ['a', 2],
      ['a1', 3],
      ['b', 2]
    ])
  })

  it('finds the ancestors of a folder and the folder of a role', () => {
    expect(findAncestorIds(mailboxes, 'a1')).toEqual(['a', 'work'])
    expect(findAncestorIds(mailboxes, 'inbox')).toEqual([])
    expect(findMailboxIdByRole(mailboxes, 'inbox')).toBe('inbox')
    expect(findMailboxIdByRole(mailboxes, 'trash')).toBe(null)
  })
})

describe('buildMailboxSections', () => {
  const TEAM = 'TeamMailbox[team@example.com]'
  const team = (
    overrides: Partial<Parameters<typeof makeMailbox>[0]> &
      Pick<Parameters<typeof makeMailbox>[0], 'id' | 'name'>
  ): ReturnType<typeof makeMailbox> =>
    makeMailbox({ namespace: TEAM, parentId: 'team', ...overrides })

  const mailboxes = [
    makeMailbox({ id: 'inbox', name: 'INBOX', role: 'inbox' }),
    makeMailbox({ id: 'hidden', name: 'Hidden', isSubscribed: false }),
    makeMailbox({ id: 'under-hidden', name: 'Under', parentId: 'hidden' }),
    makeMailbox({
      id: 'trash',
      name: 'Trash',
      role: 'trash',
      isSubscribed: false
    }),
    makeMailbox({ id: 'team', name: 'team', namespace: TEAM }),
    team({ id: 'team-projects', name: 'Projects' }),
    team({ id: 'team-sent', name: 'Sent' }),
    team({ id: 'team-inbox', name: 'INBOX' })
  ]

  it('leaves hidden folders and their subfolders out, not the system ones', () => {
    const { personal, hiddenCount } = buildMailboxSections(mailboxes, false)

    expect(personal.map(node => node.mailbox.id)).toEqual(['inbox', 'trash'])
    expect(hiddenCount).toBe(2)
    expect(
      buildMailboxSections(mailboxes, true).personal.map(
        node => node.mailbox.id
      )
    ).toEqual(['inbox', 'trash', 'hidden'])
  })

  it('puts team mailboxes apart, their system folders first by name', () => {
    const { team: roots } = buildMailboxSections(mailboxes, false)

    expect(roots.map(node => node.mailbox.id)).toEqual(['team'])
    expect(roots[0]?.children.map(node => node.mailbox.name)).toEqual([
      'INBOX',
      'Sent',
      'Projects'
    ])
  })
})

describe('findDescendantIds', () => {
  it('lists the descendants, the deepest first', () => {
    const mailboxes = [
      makeMailbox({ id: 'a', name: 'A' }),
      makeMailbox({ id: 'b', name: 'B', parentId: 'a' }),
      makeMailbox({ id: 'c', name: 'C', parentId: 'b' }),
      makeMailbox({ id: 'd', name: 'D', parentId: 'a' })
    ]

    expect(findDescendantIds(mailboxes, 'a')).toEqual(['c', 'b', 'd'])
  })
})

describe('isTemplatesMailbox', () => {
  it('knows the Templates folder by its role, or by the name tmail-flutter gives it', () => {
    expect(
      isTemplatesMailbox(makeMailbox({ id: 't', name: 'x', role: 'templates' }))
    ).toBe(true)
    expect(
      isTemplatesMailbox(makeMailbox({ id: 't', name: 'TEMPLATES' }))
    ).toBe(true)
    expect(
      isTemplatesMailbox(
        makeMailbox({ id: 't', name: 'Templates', parentId: 'work' })
      )
    ).toBe(false)
    expect(
      isTemplatesMailbox(
        makeMailbox({ id: 't', name: 'Templates', namespace: 'Delegated' })
      )
    ).toBe(false)
    expect(
      findTemplatesMailboxId([
        makeMailbox({ id: 'a', name: 'Inbox', role: 'inbox' }),
        makeMailbox({ id: 'b', name: 'Templates' })
      ])
    ).toBe('b')
  })
})
