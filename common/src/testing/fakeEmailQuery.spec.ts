import { isSupportedFilter } from './fakeEmailQuery'

describe('isSupportedFilter', () => {
  it('accepts the mailbox conditions at the top or in a top-level AND', () => {
    expect(isSupportedFilter({ inMailbox: 'a', text: 'x' })).toBe(true)
    expect(
      isSupportedFilter({
        operator: 'AND',
        conditions: [
          { inMailboxOtherThan: ['b'] },
          { operator: 'OR', conditions: [{ from: 'a' }, { from: 'b' }] }
        ]
      })
    ).toBe(true)
  })

  it('refuses the mailbox conditions under an OR or a NOT, as James', () => {
    expect(
      isSupportedFilter({
        operator: 'AND',
        conditions: [
          { text: 'x' },
          {
            operator: 'OR',
            conditions: [{ inMailbox: 'a' }, { inMailbox: 'b' }]
          }
        ]
      })
    ).toBe(false)
    expect(
      isSupportedFilter({
        operator: 'NOT',
        conditions: [{ inMailboxOtherThan: ['a'] }]
      })
    ).toBe(false)
  })

  it('refuses two inMailbox in a top-level AND', () => {
    expect(
      isSupportedFilter({
        operator: 'AND',
        conditions: [{ inMailbox: 'a' }, { inMailbox: 'b' }]
      })
    ).toBe(false)
  })
})
