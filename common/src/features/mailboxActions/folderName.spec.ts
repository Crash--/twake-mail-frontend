import { makeMailbox } from '@common/testing/fakeJmapServer'

import { findClashingParentIds, validateFolderName } from './folderName'

const mailboxes = [
  makeMailbox({ id: 'work', name: 'Work' }),
  makeMailbox({ id: 'work-archive', name: 'Archive', parentId: 'work' }),
  makeMailbox({ id: 'archive', name: 'archive' }),
  makeMailbox({ id: 'projects', name: 'Projects' }),
  makeMailbox({
    id: 'projects-archive',
    name: 'ARCHIVE',
    parentId: 'projects'
  }),
  makeMailbox({ id: 'notes', name: 'Notes', parentId: 'projects' })
]

function find(id: string): (typeof mailboxes)[number] {
  const found = mailboxes.find(mailbox => mailbox.id === id)
  if (found === undefined) throw new Error(`No mailbox ${id}`)
  return found
}

describe('validateFolderName', () => {
  it('refuses the name of another folder at the same place, whatever the case', () => {
    expect(
      validateFolderName('NOTES', { mailboxes, parentId: 'projects' })
    ).toBe('folders.validation.taken')
    expect(validateFolderName('NOTES', { mailboxes, parentId: null })).toBe(
      null
    )
  })
})

describe('findClashingParentIds', () => {
  it('lists the places holding a folder of the same name, whatever the case', () => {
    expect(findClashingParentIds(mailboxes, find('work-archive'))).toEqual([
      null,
      'projects'
    ])
  })

  it('leaves out the current place and the folder itself', () => {
    expect(findClashingParentIds(mailboxes, find('archive'))).toEqual([
      'work',
      'projects'
    ])
  })

  it('lists nothing when no other folder has the name', () => {
    expect(findClashingParentIds(mailboxes, find('notes'))).toEqual([])
  })
})
