import { Trash, FolderOutlined, Paperplane } from '@linagora/twake-icons'

import { makeMailbox, makeTeamMailboxes } from '@common/testing/fakeJmapServer'

import { getMailboxIcon } from './mailboxDisplay'

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
