import {
  makeDefaultMailboxes,
  makeMailbox
} from '@common/testing/fakeJmapServer'

import { availableFolderActions } from './folderActionItems'
import { validateFolderName } from './folderName'

const TEAM = 'TeamMailbox[team@example.com]'
const TEAM_RIGHTS = {
  mayReadItems: true,
  mayAddItems: true,
  mayRemoveItems: true,
  maySetSeen: true,
  maySetKeywords: true,
  mayCreateChild: false,
  mayRename: false,
  mayDelete: false,
  maySubmit: true
}

const MAILBOXES = [
  ...makeDefaultMailboxes(),
  makeMailbox({ id: 'work', name: 'Work', unreadEmails: 2, totalEmails: 3 }),
  makeMailbox({ id: 'clients', name: 'Clients', parentId: 'work' }),
  makeMailbox({
    id: 'team',
    name: 'team',
    namespace: TEAM,
    myRights: TEAM_RIGHTS
  }),
  makeMailbox({
    id: 'team-trash',
    name: 'Trash',
    parentId: 'team',
    namespace: TEAM,
    totalEmails: 1,
    myRights: TEAM_RIGHTS
  })
]

function ids(
  mailboxId: string,
  options: Parameters<typeof availableFolderActions>[2] = {}
): string[] {
  const mailbox = MAILBOXES.find(candidate => candidate.id === mailboxId)
  if (!mailbox) throw new Error(`No ${mailboxId}`)
  return availableFolderActions(mailbox, MAILBOXES, options).map(
    item => item.id
  )
}

describe('availableFolderActions', () => {
  it('offers the menu of tmail-flutter for each kind of folder', () => {
    expect(ids('work')).toEqual([
      'open-in-new-tab',
      'new-subfolder',
      'mark-as-read',
      'move',
      'move-content',
      'rename',
      'hide',
      'delete'
    ])
    // Inbox: 2 unread in the default mailboxes
    expect(ids('mailbox-inbox')).toEqual([
      'open-in-new-tab',
      'new-subfolder',
      'mark-as-read',
      'move-content'
    ])
    expect(ids('mailbox-sent')).toEqual(['open-in-new-tab', 'new-subfolder'])
  })

  it('empties the Trash and Spam only when they hold something', () => {
    expect(ids('mailbox-trash')).toEqual(['open-in-new-tab', 'new-subfolder'])
    const trash = makeMailbox({
      id: 'trash',
      name: 'Trash',
      role: 'trash',
      totalEmails: 3
    })
    expect(
      availableFolderActions(trash, [trash]).map(item => item.id)
    ).toContain('empty-trash')
  })

  it('offers to create a filter from a personal folder, when the server has filters', () => {
    expect(ids('work')).not.toContain('create-filter')
    expect(ids('work', { canFilter: true })).toContain('create-filter')
    expect(ids('mailbox-sent', { canFilter: true })).toEqual([
      'open-in-new-tab',
      'new-subfolder',
      'create-filter'
    ])
    // Not a team folder
    expect(ids('team', { canFilter: true })).not.toContain('create-filter')
  })

  it('offers to move the content of a folder that holds emails, as tmail-flutter', () => {
    // A personal folder
    expect(ids('work')).toContain('move-content')
    expect(ids('clients')).not.toContain('move-content')
    // Trash and Spam with emails
    const trash = makeMailbox({
      id: 'trash',
      name: 'Trash',
      role: 'trash',
      totalEmails: 3
    })
    expect(availableFolderActions(trash, [trash]).map(item => item.id)).toEqual(
      ['open-in-new-tab', 'new-subfolder', 'move-content', 'empty-trash']
    )
    // The other system folders, only with unread emails
    const inbox = makeMailbox({
      id: 'inbox',
      name: 'Inbox',
      role: 'inbox',
      totalEmails: 3,
      unreadEmails: 1
    })
    expect(availableFolderActions(inbox, [inbox]).map(item => item.id)).toEqual(
      ['open-in-new-tab', 'new-subfolder', 'mark-as-read', 'move-content']
    )
    expect(
      availableFolderActions({ ...inbox, unreadEmails: 0 }, [inbox]).map(
        item => item.id
      )
    ).not.toContain('move-content')
    // Taking emails out needs the right to remove them
    const locked = {
      ...makeMailbox({ id: 'locked', name: 'Locked', totalEmails: 3 }),
      myRights: {
        ...makeMailbox({ id: 'x', name: 'x' }).myRights,
        mayRemoveItems: false
      }
    }
    expect(
      availableFolderActions(locked, MAILBOXES).map(item => item.id)
    ).not.toContain('move-content')
    // Never for a team folder
    expect(ids('team-trash')).not.toContain('move-content')
  })

  it('does not offer to open a hidden folder in a new tab', () => {
    const hidden = makeMailbox({
      id: 'h',
      name: 'H',
      isSubscribed: false
    })
    expect(
      availableFolderActions(hidden, [hidden]).map(item => item.id)
    ).not.toContain('open-in-new-tab')
  })

  it('follows the rights of a team mailbox', () => {
    expect(ids('team')).toEqual(['open-in-new-tab', 'hide'])
    expect(ids('team-trash')).toEqual(['open-in-new-tab', 'empty-trash'])
  })
})

describe('validateFolderName', () => {
  const at = (
    parentId: string | null
  ): Parameters<typeof validateFolderName>[1] => ({
    mailboxes: MAILBOXES,
    parentId
  })

  it('refuses what tmail-flutter refuses', () => {
    expect(validateFolderName('', at(null))).toBe('folders.validation.required')
    expect(validateFolderName('   ', at(null))).toBe(
      'folders.validation.spaces'
    )
    expect(validateFolderName('#tag', at(null))).toBe(
      'folders.validation.characters'
    )
    expect(validateFolderName('100%', at(null))).toBe(
      'folders.validation.characters'
    )
    expect(validateFolderName('work', at(null))).toBe(
      'folders.validation.taken'
    )
    expect(
      validateFolderName('clients', { ...at('work'), renamedId: 'other' })
    ).toBe('folders.validation.sameName')
  })

  it('accepts a slash, and a name taken elsewhere or by the folder renamed', () => {
    expect(validateFolderName('2026/Q4', at(null))).toBe(null)
    expect(validateFolderName('Clients', at(null))).toBe(null)
    expect(validateFolderName('Work', { ...at(null), renamedId: 'work' })).toBe(
      null
    )
  })
})

describe('availableFolderActions and the rights to mark as read', () => {
  const inbox = (maySetSeen: boolean): ReturnType<typeof makeMailbox> =>
    makeMailbox({
      id: 'team-inbox',
      name: 'INBOX',
      parentId: 'team',
      namespace: TEAM,
      unreadEmails: 3,
      myRights: { ...TEAM_RIGHTS, maySetSeen }
    })
  const ids = (mailbox: ReturnType<typeof makeMailbox>): string[] =>
    availableFolderActions(mailbox, [mailbox]).map(item => item.id)

  it('offers "Mark as read" on a team folder to who may set the seen flag', () => {
    expect(ids(inbox(true))).toContain('mark-as-read')
    expect(ids(inbox(false))).not.toContain('mark-as-read')
  })
})
