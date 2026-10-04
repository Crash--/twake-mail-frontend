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
  makeMailbox({ id: 'work', name: 'Work', unreadEmails: 2 }),
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

function ids(mailboxId: string): string[] {
  const mailbox = MAILBOXES.find(candidate => candidate.id === mailboxId)
  if (!mailbox) throw new Error(`No ${mailboxId}`)
  return availableFolderActions(mailbox, MAILBOXES).map(item => item.id)
}

describe('availableFolderActions', () => {
  it('offers the menu of tmail-flutter for each kind of folder', () => {
    expect(ids('work')).toEqual([
      'new-subfolder',
      'mark-as-read',
      'move',
      'rename',
      'hide',
      'delete'
    ])
    // Inbox: 2 unread in the default mailboxes
    expect(ids('mailbox-inbox')).toEqual(['new-subfolder', 'mark-as-read'])
    expect(ids('mailbox-sent')).toEqual(['new-subfolder'])
  })

  it('empties the Trash and Spam only when they hold something', () => {
    expect(ids('mailbox-trash')).toEqual(['new-subfolder'])
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

  it('follows the rights of a team mailbox', () => {
    expect(ids('team')).toEqual(['hide'])
    expect(ids('team-trash')).toEqual(['empty-trash'])
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
