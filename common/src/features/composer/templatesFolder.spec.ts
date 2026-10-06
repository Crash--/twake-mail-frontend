import {
  makeDefaultMailboxes,
  makeMailbox,
  makeTeamMailboxes
} from '@common/testing/fakeJmapServer'

import {
  chooseTemplatesTarget,
  listReadableTemplatesMailboxIds,
  listTemplatesMailboxIds
} from './templatesFolder'

const OWN = makeMailbox({ id: 'own-templates', name: 'Templates' })

describe('chooseTemplatesTarget', () => {
  it('uses the Templates of the user, to be created when there is none, without a team identity', () => {
    expect(chooseTemplatesTarget(makeDefaultMailboxes(), null)).toEqual({
      mailboxId: null,
      parentId: null
    })
    expect(
      chooseTemplatesTarget(
        [...makeDefaultMailboxes(), OWN, ...makeTeamMailboxes()],
        'alice@example.com'
      )
    ).toEqual({ mailboxId: 'own-templates', parentId: null })
  })

  it('uses the Templates of the team mailbox whose address is the identity, whatever the case', () => {
    expect(
      chooseTemplatesTarget(
        [...makeDefaultMailboxes(), OWN, ...makeTeamMailboxes()],
        'Team@Example.com'
      )
    ).toEqual({ mailboxId: 'team-templates', parentId: 'team' })
  })

  it('creates it under the root of the team mailbox when it has none', () => {
    const mailboxes = makeTeamMailboxes().filter(
      mailbox => mailbox.id !== 'team-templates'
    )
    expect(chooseTemplatesTarget(mailboxes, 'team@example.com')).toEqual({
      mailboxId: null,
      parentId: 'team'
    })
  })

  it('falls back to the own Templates when the rights do not allow it', () => {
    const readOnly = makeTeamMailboxes({
      rights: { mayAddItems: false, mayCreateChild: false }
    })
    expect(
      chooseTemplatesTarget([OWN, ...readOnly], 'team@example.com')
    ).toEqual({ mailboxId: 'own-templates', parentId: null })
    expect(
      chooseTemplatesTarget(
        readOnly.filter(mailbox => mailbox.id !== 'team-templates'),
        'team@example.com'
      )
    ).toEqual({ mailboxId: null, parentId: null })
  })
})

describe('Templates folders', () => {
  it('lists the own one and the ones of the team mailboxes, the readable ones for the picker', () => {
    const mailboxes = [
      ...makeDefaultMailboxes(),
      OWN,
      ...makeTeamMailboxes(),
      ...makeTeamMailboxes({
        id: 'other',
        address: 'other@example.com',
        rights: { mayReadItems: false }
      })
    ]

    expect(listTemplatesMailboxIds(mailboxes)).toEqual([
      'own-templates',
      'team-templates',
      'other-templates'
    ])
    expect(listReadableTemplatesMailboxIds(mailboxes)).toEqual([
      'own-templates',
      'team-templates'
    ])
  })
})
