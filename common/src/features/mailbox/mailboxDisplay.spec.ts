import { Trash, FolderOutlined, Paperplane } from '@linagora/twake-icons'

import { makeMailbox, makeTeamMailboxes } from '@common/testing/fakeJmapServer'

import {
  getMailboxIcon,
  getRoleNameKey,
  showsTotalCount,
  showsUnreadCount
} from './mailboxDisplay'

describe('getMailboxIcon', () => {
  const team = makeTeamMailboxes()
  const folder = (name: string): (typeof team)[number] => {
    const found = team.find(mailbox => mailbox.name === name)
    if (found === undefined) throw new Error(`No ${name}`)
    return found
  }

  it('gives the system folders of a team mailbox the icon of their role, by name', () => {
    expect(getMailboxIcon(folder('Trash'))).toBe(Trash)
    expect(getMailboxIcon(folder('Sent'))).toBe(Paperplane)
  })

  it('gives its root and its own folders the folder icon', () => {
    expect(getMailboxIcon(folder('team'))).toBe(FolderOutlined)
    expect(
      getMailboxIcon({
        ...folder('Trash'),
        name: 'Trash',
        myRights: { ...folder('Trash').myRights, mayDelete: true }
      })
    ).toBe(FolderOutlined)
    expect(getMailboxIcon(makeMailbox({ id: 'f', name: 'Trash' }))).toBe(
      FolderOutlined
    )
  })
})

describe('getRoleNameKey', () => {
  const team = makeTeamMailboxes()
  const folder = (name: string): (typeof team)[number] => {
    const found = team.find(mailbox => mailbox.name === name)
    if (found === undefined) throw new Error(`No ${name}`)
    return found
  }

  it('translates the Inbox of a team mailbox, which has no role, by its name', () => {
    expect(getRoleNameKey(folder('INBOX'))).toBe('mailbox.roles.inbox')
  })

  it('translates the system folders of the user by their role', () => {
    expect(
      getRoleNameKey(makeMailbox({ id: 'i', name: 'INBOX', role: 'inbox' }))
    ).toBe('mailbox.roles.inbox')
  })

  it('keeps the name of a personal folder and of a team mailbox root', () => {
    expect(getRoleNameKey(makeMailbox({ id: 'f', name: 'INBOX' }))).toBe(null)
    expect(getRoleNameKey(folder('team'))).toBe(null)
  })
})

describe('showsUnreadCount', () => {
  const team = makeTeamMailboxes()
  const withCounts = (
    mailbox: (typeof team)[number]
  ): (typeof team)[number] => ({
    ...mailbox,
    unreadEmails: 3,
    totalEmails: 5
  })

  it('shows the unread count of the Inbox and of other folders', () => {
    expect(
      showsUnreadCount(
        makeMailbox({ id: 'i', name: 'F', role: 'inbox', unreadEmails: 2 })
      )
    ).toBe(true)
    expect(
      showsUnreadCount(makeMailbox({ id: 'w', name: 'Work', unreadEmails: 2 }))
    ).toBe(true)
  })

  it('shows nothing when nothing is unread', () => {
    expect(
      showsUnreadCount(makeMailbox({ id: 'i', name: 'F', role: 'inbox' }))
    ).toBe(false)
  })

  it.each(['trash', 'junk', 'drafts', 'templates', 'sent'])(
    'hides the unread count of the %s folder',
    role => {
      expect(
        showsUnreadCount(
          makeMailbox({ id: role, name: 'F', role, unreadEmails: 4 })
        )
      ).toBe(false)
    }
  )

  it('hides the unread count of the Trash, Drafts and Templates of a team mailbox, by name', () => {
    for (const name of ['Trash', 'Drafts', 'Templates']) {
      const mailbox = team.find(candidate => candidate.name === name)
      if (mailbox === undefined) continue
      expect(showsUnreadCount(withCounts(mailbox))).toBe(false)
    }
  })
})

describe('showsTotalCount', () => {
  it('shows the number of drafts, as tmail-flutter', () => {
    expect(
      showsTotalCount(
        makeMailbox({ id: 'd', name: 'F', role: 'drafts', totalEmails: 2 })
      )
    ).toBe(true)
    expect(
      showsTotalCount(makeMailbox({ id: 'd', name: 'F', role: 'drafts' }))
    ).toBe(false)
    expect(
      showsTotalCount(
        makeMailbox({ id: 'i', name: 'F', role: 'inbox', totalEmails: 2 })
      )
    ).toBe(false)
  })
})
