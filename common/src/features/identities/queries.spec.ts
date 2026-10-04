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
})
