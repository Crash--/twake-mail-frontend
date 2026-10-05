import {
  makeDefaultMailboxes,
  makeMailbox,
  makeTeamMailboxes
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
    { role, name: role ?? 'Folder', namespace: 'Personal', parentId: null },
    mailboxes
  ).map(item => item.id)
}

describe('availableEmailActions, actions of one open email', () => {
  const ALL = ['unsubscribe', 'print', 'download-eml', 'edit-as-new'] as const
  function withExtras(
    role: string | null,
    emails = [unread],
    extras: readonly (typeof ALL)[number][] = ALL
  ): string[] {
    return availableEmailActions(
      emails,
      { role, name: role ?? 'Folder', namespace: 'Personal', parentId: null },
      MAILBOXES,
      { extras }
    ).map(item => item.id)
  }

  it('adds the asked ones after the others, in tmail-flutter order', () => {
    expect(withExtras('inbox')).toEqual([
      'move-to-trash',
      'archive',
      'mark-as-read',
      'star',
      'move',
      'mark-as-spam',
      'unsubscribe',
      'print',
      'download-eml',
      'edit-as-new'
    ])
  })

  it('adds none for several emails', () => {
    expect(withExtras('inbox', [unread, readStarred])).not.toContain('print')
  })

  it('does not edit as new a draft, nor a template', () => {
    expect(withExtras('drafts')).not.toContain('edit-as-new')
    expect(
      withExtras('inbox', [
        { id: 'd', mailboxIds: { x: true }, keywords: { $draft: true } }
      ])
    ).not.toContain('edit-as-new')
    const templates = makeMailbox({ id: 'tpl', name: 'Templates' })
    expect(
      availableEmailActions(
        [{ id: 't', mailboxIds: { tpl: true }, keywords: {} }],
        null,
        [...MAILBOXES, templates],
        { extras: ALL }
      ).map(item => item.id)
    ).not.toContain('edit-as-new')
  })
})

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
        { role: 'inbox', name: 'Inbox', namespace: 'Personal', parentId: null },
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
      { role: null, name: 'INBOX', namespace: team, parentId: 'team' },
      MAILBOXES
    ).map(item => item.id)
    const inTeamTrash = availableEmailActions(
      [unread],
      { role: null, name: 'Trash', namespace: team, parentId: 'team' },
      MAILBOXES
    ).map(item => item.id)

    expect(inTeam).toEqual(['move-to-trash', 'mark-as-read', 'star', 'move'])
    expect(inTeamTrash).toContain('delete-permanently')
  })
})

describe('availableEmailActions out of a folder', () => {
  const team = makeTeamMailboxes()
  const mailboxes = [...MAILBOXES, ...team]
  const mine = {
    id: 'm',
    mailboxIds: { 'mailbox-inbox': true as const },
    keywords: {}
  }
  const theirs = {
    id: 't',
    mailboxIds: { 'team-inbox': true as const },
    keywords: {}
  }

  it('offers Archive and Spam on the emails of the user', () => {
    const items = availableEmailActions([mine], null, mailboxes).map(
      item => item.id
    )

    expect(items).toEqual(expect.arrayContaining(['archive', 'mark-as-spam']))
  })

  it('offers neither Archive nor Spam as soon as an email is a team one', () => {
    const items = availableEmailActions([mine, theirs], null, mailboxes).map(
      item => item.id
    )

    expect(items).toEqual(['move-to-trash', 'mark-as-read', 'star', 'move'])
  })
})

describe('availableEmailActions and the rights of the folder', () => {
  const rights = (
    overrides: Partial<ReturnType<typeof makeMailbox>['myRights']>
  ): ReturnType<typeof makeTeamMailboxes> =>
    makeTeamMailboxes({ rights: overrides })
  const idsIn = (
    overrides: Partial<ReturnType<typeof makeMailbox>['myRights']>
  ): string[] => {
    const team = rights(overrides)
    const inbox = team.find(mailbox => mailbox.id === 'team-inbox')
    if (inbox === undefined) throw new Error('No inbox')
    const email = {
      id: 'x',
      mailboxIds: { 'team-inbox': true as const },
      keywords: {}
    }
    return availableEmailActions([email], inbox, [...MAILBOXES, ...team]).map(
      item => item.id
    )
  }

  it('offers everything to a member with all the rights', () => {
    expect(idsIn({})).toEqual(['move-to-trash', 'mark-as-read', 'star', 'move'])
  })

  it('leaves out what needs a right the member does not have', () => {
    expect(idsIn({ mayRemoveItems: false })).toEqual(['mark-as-read', 'star'])
    expect(idsIn({ maySetSeen: false })).toEqual([
      'move-to-trash',
      'star',
      'move'
    ])
    expect(idsIn({ maySetKeywords: false })).toEqual([
      'move-to-trash',
      'mark-as-read',
      'move'
    ])
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
