import { ownName } from './ownName'

describe('ownName', () => {
  it('takes the name of the identity sending from the own address, without case', () => {
    expect(
      ownName(
        [
          { name: 'Support', email: 'support@example.com' },
          { name: ' Alice Martin ', email: 'Alice@Example.com' }
        ],
        'alice@example.com'
      )
    ).toBe('Alice Martin')
  })

  it('skips the identities of the own address without a name', () => {
    expect(
      ownName(
        [
          { name: '  ', email: 'alice@example.com' },
          { name: 'Alice', email: 'alice@example.com' }
        ],
        'alice@example.com'
      )
    ).toBe('Alice')
  })

  it('is null when no identity of the own address has a name', () => {
    expect(
      ownName(
        [
          { name: '', email: 'alice@example.com' },
          { name: 'Support', email: 'support@example.com' }
        ],
        'alice@example.com'
      )
    ).toBe(null)
    expect(ownName([], 'alice@example.com')).toBe(null)
  })
})
