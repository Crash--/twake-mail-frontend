import {
  invertEmailChanges,
  planEmailChanges,
  toEmailPatch,
  type TargetEmail
} from './planEmailChanges'

const inInbox: TargetEmail = {
  id: 'e1',
  mailboxIds: { inbox: true },
  keywords: {}
}
const readInInbox: TargetEmail = {
  id: 'e2',
  mailboxIds: { inbox: true },
  keywords: { $seen: true }
}

describe('planEmailChanges', () => {
  it('moves an email out of the folder shown, path by path', () => {
    const [change] = planEmailChanges([inInbox], {
      kind: 'move',
      from: 'inbox',
      to: 'archive'
    })

    expect(change?.after).toEqual({
      id: 'e1',
      mailboxIds: { archive: true },
      keywords: {}
    })
    expect(change && toEmailPatch(change)).toEqual({
      'mailboxIds/inbox': null,
      'mailboxIds/archive': true
    })
  })

  it('keeps the other mailboxes of an email moved out of one of them', () => {
    const [change] = planEmailChanges(
      [{ ...inInbox, mailboxIds: { inbox: true, work: true } }],
      { kind: 'move', from: 'work', to: 'archive' }
    )

    expect(change?.after?.mailboxIds).toEqual({ inbox: true, archive: true })
  })

  it('takes an email out of all its mailboxes when not in the one given', () => {
    const [change] = planEmailChanges(
      [{ ...inInbox, mailboxIds: { a: true, b: true } }],
      { kind: 'move', from: null, to: 'trash' }
    )

    expect(change && toEmailPatch(change)).toEqual({
      'mailboxIds/a': null,
      'mailboxIds/b': null,
      'mailboxIds/trash': true
    })
  })

  it('marks an email read when moving it to spam', () => {
    const [change] = planEmailChanges([inInbox], {
      kind: 'move',
      from: 'inbox',
      to: 'spam',
      markSeen: true
    })

    expect(change && toEmailPatch(change)).toEqual({
      'mailboxIds/inbox': null,
      'mailboxIds/spam': true,
      'keywords/$seen': true
    })
  })

  it('leaves out the emails already in the state asked', () => {
    const changes = planEmailChanges([inInbox, readInInbox, inInbox], {
      kind: 'keyword',
      keyword: '$seen',
      isSet: true
    })

    expect(changes.map(change => change.before.id)).toEqual(['e1'])
    expect(changes[0] && toEmailPatch(changes[0])).toEqual({
      'keywords/$seen': true
    })
  })

  it('destroys emails with no patch', () => {
    const [change] = planEmailChanges([inInbox], { kind: 'destroy' })

    expect(change?.after).toBe(null)
    expect(change && toEmailPatch(change)).toBe(null)
  })
})

describe('invertEmailChanges', () => {
  it('undoes moves and keywords, not destructions', () => {
    const moved = planEmailChanges([inInbox], {
      kind: 'move',
      from: 'inbox',
      to: 'archive'
    })
    const destroyed = planEmailChanges([readInInbox], { kind: 'destroy' })

    const inverse = invertEmailChanges([...moved, ...destroyed])

    expect(inverse).toHaveLength(1)
    expect(inverse[0]?.after).toEqual(inInbox)
    expect(inverse[0] && toEmailPatch(inverse[0])).toEqual({
      'mailboxIds/archive': null,
      'mailboxIds/inbox': true
    })
  })
})
