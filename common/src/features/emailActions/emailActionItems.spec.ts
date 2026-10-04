import {
  makeDefaultMailboxes,
  makeMailbox
} from '@common/testing/fakeJmapServer'

import { availableEmailActions } from './emailActionItems'

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
  return availableEmailActions(emails, { role }, mailboxes).map(item => item.id)
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
})
