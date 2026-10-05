import {
  makeDefaultMailboxes,
  makeMailbox
} from '@common/testing/fakeJmapServer'

import { availableEmailActions } from './emailActionItems'
import { findActionDestination } from './useEmailActions'

const MAILBOXES = [
  ...makeDefaultMailboxes(),
  makeMailbox({ id: 'mailbox-archive', name: 'Archive', role: 'archive' })
]
const unread = { id: 'a', mailboxIds: { x: true as const }, keywords: {} }
const readStarred = {
  id: 'b',
  mailboxIds: { x: true as const },
  keywords: { $seen: true as const, $flagged: true as const }
}

function ids(
  role: string | null,
  emails = [unread],
  mailboxes = MAILBOXES
): string[] {
  return availableEmailActions(
    emails,
    { role, name: role ?? 'Folder', namespace: 'Personal' },
    mailboxes
  ).map(item => item.id)
}

describe('availableEmailActions', () => {
  it('offers the actions of tmail-flutter in the Inbox, in its order', () => {
    expect(ids('inbox')).toEqual([
      'move-to-trash',
      'archive',
      'mark-as-read',
      'star',
      'move',
      'mark-as-spam'
    ])
  })

  it('deletes forever in the Trash, Spam and Drafts, and offers "not spam" in Spam', () => {
    expect(ids('trash')).toContain('delete-permanently')
    expect(ids('drafts')).toEqual(
      expect.not.arrayContaining(['mark-as-spam', 'move-to-trash'])
    )
    expect(ids('junk')).toEqual([
      'not-spam',
      'delete-permanently',
      'archive',
      'mark-as-read',
      'star',
      'move'
    ])
  })

  it('offers "Label as" when labels show', () => {
    expect(
      availableEmailActions(
        [unread],
        { role: 'inbox', name: 'Inbox', namespace: 'Personal' },
        MAILBOXES,
        { canLabel: true }
      ).map(item => item.id)
    ).toContain('label-as')
    expect(ids('inbox')).not.toContain('label-as')
  })

  it('offers no archive from Archive nor without an Archive folder', () => {
    expect(ids('archive')).not.toContain('archive')
    expect(ids('inbox', [unread], makeDefaultMailboxes())).not.toContain(
      'archive'
    )
  })

  it('offers the toggles that change something for the whole selection', () => {
    expect(ids(null, [readStarred])).toEqual(
      expect.arrayContaining(['mark-as-unread', 'unstar'])
    )
    expect(ids(null, [readStarred, unread])).toEqual(
      expect.arrayContaining(['mark-as-read', 'star'])
    )
    expect(ids(null, [])).toEqual([])
  })

  it('offers neither Archive nor Spam in a team mailbox, deletes forever from its Trash', () => {
    const team = 'TeamMailbox[team@example.com]'
    const inTeam = availableEmailActions(
      [unread],
      { role: null, name: 'INBOX', namespace: team },
      MAILBOXES
    ).map(item => item.id)
    const inTeamTrash = availableEmailActions(
      [unread],
      { role: null, name: 'Trash', namespace: team },
      MAILBOXES
    ).map(item => item.id)

    expect(inTeam).toEqual(['move-to-trash', 'mark-as-read', 'star', 'move'])
    expect(inTeamTrash).toContain('delete-permanently')
  })
})

describe('findActionDestination', () => {
  const team = 'TeamMailbox[team@example.com]'
  const mailboxes = [
    ...MAILBOXES,
    makeMailbox({ id: 'team', name: 'team', namespace: team }),
    makeMailbox({
      id: 'team-inbox',
      name: 'INBOX',
      parentId: 'team',
      namespace: team
    }),
    makeMailbox({
      id: 'team-trash',
      name: 'Trash',
      parentId: 'team',
      namespace: team
    })
  ]

  it('sends emails of a team mailbox to its own Trash', () => {
    expect(findActionDestination(mailboxes, 'moveToTrash', 'team-inbox')).toBe(
      'team-trash'
    )
    expect(
      findActionDestination(mailboxes, 'moveToTrash', 'mailbox-inbox')
    ).toBe('mailbox-trash')
    expect(findActionDestination(mailboxes, 'archive', null)).toBe(
      'mailbox-archive'
    )
  })
})
