import { sortIdentities, type IdentitySummary } from './queries'

function identity(
  id: string,
  patch: Partial<IdentitySummary> = {}
): IdentitySummary {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    replyTo: null,
    bcc: null,
    textSignature: '',
    htmlSignature: '',
    mayDelete: true,
    ...patch
  }
}

describe('sortIdentities', () => {
  it('puts the lowest sortOrder first', () => {
    expect(
      sortIdentities([
        identity('b', { sortOrder: 1 }),
        identity('a', { sortOrder: 0 }),
        identity('c')
      ]).map(item => item.id)
    ).toEqual(['a', 'b', 'c'])
  })

  it('puts the identity of the account first among equals, then by name', () => {
    expect(
      sortIdentities([
        identity('work', { sortOrder: 100 }),
        identity('zoe', { sortOrder: 100, mayDelete: false }),
        identity('alias', { sortOrder: 100 })
      ]).map(item => item.id)
    ).toEqual(['zoe', 'alias', 'work'])
  })

  it('puts the identity of the user before a team mailbox one among equals', () => {
    expect(
      sortIdentities(
        [
          identity('bob-guests', { sortOrder: 100, mayDelete: false }),
          identity('bob', { sortOrder: 100, mayDelete: false })
        ],
        'Bob@example.com'
      ).map(item => item.id)
    ).toEqual(['bob', 'bob-guests'])
  })

  it('still follows sortOrder before the address of the user', () => {
    expect(
      sortIdentities(
        [
          identity('bob', { sortOrder: 100, mayDelete: false }),
          identity('bob-guests', { sortOrder: 0, mayDelete: false })
        ],
        'bob@example.com'
      ).map(item => item.id)
    ).toEqual(['bob-guests', 'bob'])
  })
})
