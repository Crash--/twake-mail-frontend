import { afterMoveTarget, toAfterMovePreference } from './afterMovePreference'

describe('after move preference', () => {
  it('goes back to the list unless the user chose a neighbour', () => {
    expect(toAfterMovePreference(null)).toBe('list')
    expect(toAfterMovePreference('other')).toBe('list')
    expect(toAfterMovePreference('next')).toBe('next')
    expect(toAfterMovePreference('previous')).toBe('previous')
  })

  it('opens the chosen neighbour, else the other one, else the list', () => {
    const both = { previousId: 'above', nextId: 'below' }
    expect(afterMoveTarget('list', both)).toBe(null)
    expect(afterMoveTarget('next', both)).toEqual({
      emailId: 'below',
      direction: 'forward'
    })
    expect(afterMoveTarget('previous', both)).toEqual({
      emailId: 'above',
      direction: 'backward'
    })
    expect(
      afterMoveTarget('previous', { previousId: null, nextId: 'below' })
    ).toEqual({ emailId: 'below', direction: 'forward' })
    expect(afterMoveTarget('next', { previousId: null, nextId: null })).toBe(
      null
    )
  })
})
